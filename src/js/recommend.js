import { getAiRecommendation } from "./api/ai.js";
import { showLoading, hideLoading } from "./components/loading.js";
import { formatCurrency, stripDigits, formatDate } from "./utils/format.js";

class NumberUtils {
  static formatInputCurrency(input) {
    const posFromEnd = input.value.length - input.selectionStart;
    const onlyNum = stripDigits(input.value);
    input.value = onlyNum ? Number(onlyNum).toLocaleString("ko-KR") : "";
    const newPos = input.value.length - posFromEnd;
    input.setSelectionRange(newPos, newPos);
  }
}

class GeoUtils {
  static haversine([lat1, lon1], [lat2, lon2]) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

class ItineraryPlanner {
  static optimizeDay(stops, { maxStops = 5, maxTravelKm = 25 } = {}) {
    const pts = stops.filter((s) => isFinite(s.lat) && isFinite(s.lng));
    if (pts.length <= 1) return pts;
    const ordered = [pts[0]];
    const remaining = pts.slice(1);
    while (remaining.length) {
      const last = ordered[ordered.length - 1];
      let idx = 0,
        best = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = GeoUtils.haversine(
          [last.lat, last.lng],
          [remaining[i].lat, remaining[i].lng]
        );
        if (d < best) {
          best = d;
          idx = i;
        }
      }
      ordered.push(remaining.splice(idx, 1)[0]);
      if (ordered.length >= maxStops) break;
    }
    let total = 0;
    const pruned = [ordered[0]];
    for (let i = 1; i < ordered.length; i++) {
      const d = GeoUtils.haversine(
        [pruned[pruned.length - 1].lat, pruned[pruned.length - 1].lng],
        [ordered[i].lat, ordered[i].lng]
      );
      if (total + d > maxTravelKm) break;
      total += d;
      pruned.push(ordered[i]);
    }
    return pruned;
  }
  static optimizeAll(dayPlans) {
    return dayPlans.map((dp) => ({
      ...dp,
      stops: ItineraryPlanner.optimizeDay(dp.stops),
    }));
  }
}

class MapRenderer {
  constructor(mapId) {
    this.mapId = mapId;
    this.map = null;
    this.layer = null;
  }
  init(center, zoom = 12) {
    this.map = L.map(this.mapId, { scrollWheelZoom: false }).setView(
      center,
      zoom
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
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
      (dp.stops || []).forEach((s, si) => {
        const latlng = [s.lat, s.lng];
        latLngs.push(latlng);
        allPts.push(latlng);
        L.marker(latlng)
          .bindPopup(
            `<b>Day ${dp.day} · ${si + 1}. ${s.placeName}</b><br/>${
              s.summary || ""
            }`
          )
          .addTo(this.layer);
      });
      if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: colors[di % colors.length],
          weight: 4,
          opacity: 0.9,
        }).addTo(this.layer);
      }
    });
    if (allPts.length)
      this.map.fitBounds(L.latLngBounds(allPts), { padding: [30, 30] });
  }
}

class RecommendationRenderer {
  constructor(container) {
    this.container = container;
  }

  static calculateStopCost(stop) {
    if (!Array.isArray(stop.costBreakdown)) return Number(stop.estimatedCost) || 0;
    return stop.costBreakdown.reduce((acc, it) => acc + (Number(it.subtotalKRW) || 0), 0);
  }

  static renderCostBreakdown(stop) {
    if (Array.isArray(stop.costBreakdown) && stop.costBreakdown.length) {
      const items = stop.costBreakdown.map((item) => {
        const unit = Number(item.unitJPY) || 0;
        const qty = Number(item.qty) || 1;
        const subJPY = Number(item.subtotalJPY) || unit * qty;
        const subKRW = Number(item.subtotalKRW) || 0;
        const basis = item.basis ? ` – ${item.basis}` : "";
        const conf = isFinite(item.confidence) ? ` (신뢰도 ${item.confidence})` : "";

        return `
          <li>
            <strong>${item.category || "기타"}</strong>${basis}${conf}<br/>
            단가: ¥${unit.toLocaleString()} × ${qty} = ¥${subJPY.toLocaleString()}<br/>
            원화: ${formatCurrency(subKRW)}
          </li>`;
      }).join("");

      return `
        <details class="cost-detail">
          <summary>비용 근거 보기</summary>
          <ul style="margin:.4rem 0 0 .8rem; padding:0; list-style: disc;">
            ${items}
          </ul>
        </details>`;
    }

    if (stop.costReason) {
      return `
        <details class="cost-detail">
          <summary>비용 근거 보기</summary>
          <p>${stop.costReason}</p>
        </details>`;
    }

    return "";
  }

  static renderStop(stop, index) {
    const stopSum = RecommendationRenderer.calculateStopCost(stop);
    const cbHTML = RecommendationRenderer.renderCostBreakdown(stop);

    return `
      <li class="stops-row">
        <span class="idx">${index + 1}</span>
        <div class="place">
          <div class="name">${stop.placeName}</div>
          <div class="sub">${stop.summary || ""}</div>
          ${stop.stopReason ? `<p class="stop-reason">${stop.stopReason}</p>` : ""}
          ${cbHTML}
        </div>
        <span class="cost">${formatCurrency(stopSum)}</span>
      </li>`;
  }

  static renderDayCard(dayPlan, daySum, avgDaily) {
    const pct = avgDaily ? Math.min(100, Math.round((daySum / avgDaily) * 100)) : 0;
    const rows = (dayPlan.stops || []).map((s, i) => RecommendationRenderer.renderStop(s, i)).join("");

    return `
      <article class="route-card">
        <header class="route-card__head">
          <h4>Day ${dayPlan.day} — ${dayPlan.title || ""}</h4>
        </header>

        <div class="route-card__body" style="display: none;">
          <p class="route-card__reason">
            ${dayPlan.dayReason || "인기와 접근성을 고려해 효율적인 동선으로 구성했습니다."}
          </p>

          <div class="budgetbar">
            <div class="bar"><span style="width:${pct}%"></span></div>
            <div class="bar-meta">
              <span>일자 합계</span>
              <strong>${formatCurrency(daySum)}</strong>
            </div>
          </div>

          <ol class="stops-table">${rows}</ol>
        </div>
      </article>
    `;
  }

  calculateDaySums(days) {
    return days.map((dp) => {
      return Number(dp.dayTotalKRW) ||
        (dp.stops || []).reduce((a, s) => a + RecommendationRenderer.calculateStopCost(s), 0);
    });
  }

  attachCardToggleEvents() {
    const cards = this.container.querySelectorAll(".route-card");
    cards.forEach((card) => {
      const head = card.querySelector(".route-card__head");
      const body = card.querySelector(".route-card__body");

      head.addEventListener("click", () => {
        this.container.querySelectorAll(".route-card__body").forEach((b) => {
          if (b !== body) b.style.display = "none";
        });
        body.style.display = body.style.display === "none" ? "block" : "none";
      });
    });
  }

  render(itinerary) {
    const days = itinerary?.dayPlans || [];
    if (!days.length) {
      this.container.innerHTML = "<p>추천 결과가 없습니다.</p>";
      return;
    }

    const daySums = this.calculateDaySums(days);
    const avgDaily = daySums.length
      ? Math.round(daySums.reduce((a, b) => a + b, 0) / daySums.length)
      : 0;

    this.container.innerHTML = days
      .map((dp, idx) => RecommendationRenderer.renderDayCard(dp, daySums[idx] || 0, avgDaily))
      .join("");

    this.attachCardToggleEvents();
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
    this.city = document.getElementById("travelCity");
  }
  init() {
    this.map.init([34.6937, 135.5023], 11);
    if (this.budget)
      this.budget.addEventListener("input", () =>
        NumberUtils.formatInputCurrency(this.budget)
      );
    if (this.start && this.end) {
      this.start.addEventListener("change", () => {
        this.end.min = this.start.value || "";
        if (this.end.value && this.end.value < this.end.min)
          this.end.value = this.end.min;
      });
    }
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
  }
  async handleSubmit(e) {
    e.preventDefault();
    const start = this.start?.value;
    const end = this.end?.value;
    const people = (this.people?.value || "").trim();
    const budgetNum = Number(stripDigits(this.budget?.value || ""));
    const city = (this.city?.value || "오사카").trim();
    if (!start || !end || !people || !budgetNum) {
      alert("기간 / 인원 / 경비를 모두 입력해주세요.");
      return;
    }
    showLoading(this.loading);
    try {
      const itinerary = await getAiRecommendation({
        city,
        period: `${formatDate(start)} ~ ${formatDate(end)}`,
        startDate: start,
        endDate: end,
        people,
        budget: budgetNum,
      });
      const optimized = ItineraryPlanner.optimizeAll(itinerary.dayPlans || []);
      const finalItin = { city: itinerary.city || city, dayPlans: optimized };
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
