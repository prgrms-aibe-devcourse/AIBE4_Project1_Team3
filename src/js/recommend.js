// js/recommend.js
import { getAiRecommendation } from "./api/ai.js";
import { showLoading, hideLoading } from "./components/loading.js";
import { formatCurrency } from "./utils/format.js";

class NumberUtils {
  static stripDigits(v) { return String(v || "").replace(/[^\d]/g, ""); }
  static formatInputCurrency(input) {
    const posFromEnd = input.value.length - input.selectionStart;
    const onlyNum = NumberUtils.stripDigits(input.value);
    input.value = onlyNum ? Number(onlyNum).toLocaleString("ko-KR") : "";
    const newPos = input.value.length - posFromEnd;
    input.setSelectionRange(newPos, newPos);
  }
}

class DateUtils {
  static toYmdDot(v) {
    const d = new Date(v);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
  }
  static days(start, end) {
    const s = new Date(start), e = new Date(end);
    if (isNaN(s) || isNaN(e)) return 1;
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
  }
}

class GeoUtils {
  static haversine([lat1, lon1], [lat2, lon2]) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

class ItineraryPlanner {
  static optimizeDay(stops, { maxStops = 5, maxTravelKm = 25 } = {}) {
    const pts = stops.filter(s => isFinite(s.lat) && isFinite(s.lng));
    if (pts.length <= 1) return pts;

    const ordered = [pts[0]];
    const remaining = pts.slice(1);
    while (remaining.length) {
      const last = ordered[ordered.length - 1];
      let idx = 0, best = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = GeoUtils.haversine([last.lat, last.lng], [remaining[i].lat, remaining[i].lng]);
        if (d < best) { best = d; idx = i; }
      }
      ordered.push(remaining.splice(idx, 1)[0]);
      if (ordered.length >= maxStops) break;
    }

    let total = 0;
    const pruned = [ordered[0]];
    for (let i = 1; i < ordered.length; i++) {
      const d = GeoUtils.haversine([pruned[pruned.length - 1].lat, pruned[pruned.length - 1].lng], [ordered[i].lat, ordered[i].lng]);
      if (total + d > maxTravelKm) break;
      total += d;
      pruned.push(ordered[i]);
    }
    return pruned;
  }

  static optimizeAll(dayPlans) {
    return dayPlans.map(dp => ({
      ...dp,
      stops: ItineraryPlanner.optimizeDay(dp.stops)
    }));
  }
}

class MapRenderer {
  constructor(mapId) { this.mapId = mapId; this.map = null; this.layer = null; }
  init(center, zoom = 12) {
    this.map = L.map(this.mapId, { scrollWheelZoom: false }).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors", maxZoom: 19
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
  }
  renderDayPlans(dayPlans) {
    if (!this.map || !this.layer) return;
    this.layer.clearLayers();
    const colors = ["#0ea5ff", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

    const allPts = [];
    dayPlans.forEach((dp, di) => {
      const latLngs = [];
      dp.stops.forEach((s, si) => {
        const latlng = [s.lat, s.lng];
        latLngs.push(latlng);
        allPts.push(latlng);
        L.marker(latlng)
          .bindPopup(`<b>Day ${dp.day} · ${si + 1}. ${s.placeName}</b><br/>${s.summary}`)
          .addTo(this.layer);
      });
      if (latLngs.length >= 2) {
        L.polyline(latLngs, { color: colors[di % colors.length], weight: 4, opacity: 0.9 }).addTo(this.layer);
      }
    });

    if (allPts.length) {
      this.map.fitBounds(L.latLngBounds(allPts), { padding: [30, 30] });
    }
  }
}

class RecommendationRenderer {
  constructor(container) { this.container = container; }
  render(itinerary) {
    const dayPlans = itinerary?.dayPlans || [];
    if (!dayPlans.length) {
      this.container.innerHTML = "<p>추천 결과가 없습니다.</p>";
      return;
    }
    this.container.innerHTML = dayPlans.map(dp => `
      <article class="route-card">
        <h4>Day ${dp.day} - ${dp.title || ""}</h4>
        <ol class="stops">
          ${dp.stops.map((s, i) => `
            <li>
              <strong>${i + 1}. ${s.placeName}</strong>
              <div>${s.summary || ""}</div>
              <div class="cost">${formatCurrency(s.estimatedCost || 0)}</div>
            </li>
          `).join("")}
        </ol>
      </article>
    `).join("");
  }
}

class AppController {
  constructor() {
    this.result = document.getElementById("recommendResult");
    this.loading = document.getElementById("loadingIndicator");
    this.map = new MapRenderer("mapContainer");
    this.cards = new RecommendationRenderer(this.result);

    this.form = document.getElementById("travelForm");
    this.start = document.getElementById("travelStart");
    this.end = document.getElementById("travelEnd");
    this.people = document.getElementById("travelPeople");
    this.budget = document.getElementById("travelBudget");
    this.city = document.getElementById("travelCity"); // 없으면 기본값 사용
  }

  init() {
    this.map.init([35.6762, 139.6503], 11);
    if (this.budget) {
      this.budget.addEventListener("input", () => NumberUtils.formatInputCurrency(this.budget));
    }
    if (this.start && this.end) {
      this.start.addEventListener("change", () => {
        this.end.min = this.start.value || "";
        if (this.end.value && this.end.value < this.end.min) this.end.value = this.end.min;
      });
    }
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
  }

  async handleSubmit(e) {
    e.preventDefault();
    const start = this.start?.value;
    const end = this.end?.value;
    const people = (this.people?.value || "").trim();
    const budgetNum = NumberUtils.stripDigits(this.budget?.value || "");
    const city = (this.city?.value || "오사카").trim();

    if (!start || !end || !people || !budgetNum) {
      alert("기간 / 인원 / 경비를 모두 입력해주세요.");
      return;
    }

    showLoading(this.loading);
    try {
      const itinerary = await getAiRecommendation({
        city,
        period: `${DateUtils.toYmdDot(start)} ~ ${DateUtils.toYmdDot(end)}`,
        startDate: start,
        endDate: end,
        people,
        budget: budgetNum
      });

      const optimized = ItineraryPlanner.optimizeAll(itinerary.dayPlans);
      const finalItin = { city: itinerary.city, dayPlans: optimized };

      this.cards.render(finalItin);
      this.map.renderDayPlans(finalItin.dayPlans);
    } catch (err) {
      console.error(err);
      this.result.innerHTML = "<p>추천 데이터를 불러오지 못했습니다.</p>";
    } finally {
      hideLoading(this.loading);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => new AppController().init());
