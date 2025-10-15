import { formatCurrency } from "../utils/format.js";

// XSS 방어를 위한 HTML 이스케이프 함수
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
            `<b>Day ${dp.day} · ${si + 1}. ${escapeHtml(
              s.placeName
            )}</b><br/>${escapeHtml(s.summary || "")}`
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
    if (!Array.isArray(stop.costBreakdown))
      return Number(stop.estimatedCost) || 0;
    return stop.costBreakdown.reduce(
      (acc, it) => acc + (Number(it.subtotalKRW) || 0),
      0
    );
  }

  static renderCostBreakdown(stop) {
    if (Array.isArray(stop.costBreakdown) && stop.costBreakdown.length) {
      const items = stop.costBreakdown
        .map((item) => {
          const unit = Number(item.unitJPY) || 0;
          const qty = Number(item.qty) || 1;
          const subJPY = Number(item.subtotalJPY) || unit * qty;
          const subKRW = Number(item.subtotalKRW) || 0;
          const basis = item.basis ? ` – ${escapeHtml(item.basis)}` : "";
          const conf = isFinite(item.confidence)
            ? ` (신뢰도 ${item.confidence})`
            : "";

          return `
          <li>
            <strong>${escapeHtml(
              item.category || "기타"
            )}</strong>${basis}${conf}<br/>
            단가: ¥${unit.toLocaleString()} × ${qty} = ¥${subJPY.toLocaleString()}<br/>
            원화: ${formatCurrency(subKRW)}
          </li>`;
        })
        .join("");

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
          <p>${escapeHtml(stop.costReason)}</p>
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
          <div class="name">${escapeHtml(stop.placeName)}</div>
          <div class="sub">${escapeHtml(stop.summary || "")}</div>
          ${
            stop.stopReason
              ? `<p class="stop-reason">${escapeHtml(stop.stopReason)}</p>`
              : ""
          }
          ${cbHTML}
        </div>
        <span class="cost">${formatCurrency(stopSum)}</span>
      </li>`;
  }

  static renderDayCard(dayPlan, daySum, avgDaily) {
    const pct = avgDaily
      ? Math.min(100, Math.round((daySum / avgDaily) * 100))
      : 0;
    const rows = (dayPlan.stops || [])
      .map((s, i) => RecommendationRenderer.renderStop(s, i))
      .join("");

    return `
      <article class="route-card">
        <header class="route-card__head">
          <h4>Day ${dayPlan.day} — ${escapeHtml(dayPlan.title || "")}</h4>
        </header>

        <div class="route-card__body" style="display: none;">
          <p class="route-card__reason">
            ${escapeHtml(
              dayPlan.dayReason ||
                "인기와 접근성을 고려해 효율적인 동선으로 구성했습니다."
            )}
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
      return (
        Number(dp.dayTotalKRW) ||
        (dp.stops || []).reduce(
          (a, s) => a + RecommendationRenderer.calculateStopCost(s),
          0
        )
      );
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
      .map((dp, idx) =>
        RecommendationRenderer.renderDayCard(dp, daySums[idx] || 0, avgDaily)
      )
      .join("");

    this.attachCardToggleEvents();
  }
}

class AppController {
  constructor() {
    this.map = new MapRenderer("mapContainer");
    this.course = JSON.parse(sessionStorage.getItem("reviewCourse"));
    this.result = document.getElementById("recommendResult");
    this.cards = new RecommendationRenderer(this.result);
    this.courseInput = document.getElementById("course");
  }
  init() {
    this.map.init([34.6937, 135.5023], 11);
    if (this.course) {
      console.log(this.course);
      this.cards.render(this.course);
      this.map.renderDayPlans(this.course.dayPlans);
      setTimeout(() => this.map.map.invalidateSize(), 0); //지도 깨짐 방지
      this.courseInput.value = JSON.stringify(this.course);
    } else {
      console.log("no data");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => new AppController().init());

document.getElementById("reviewForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Form → JSON 변환
  const formData = new FormData(e.target);
  const jsonData = Object.fromEntries(formData.entries());

  const url = "http://localhost:3000";

  // 서버에 전송
  const res = await fetch(url + "/api/review/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jsonData),
  });

  const result = await res.json();

  if (result.success) {
    alert("리뷰가 등록되었습니다!");
    window.location.href = "/src/review.html";
  } else {
    alert("등록 실패: " + result.error);
  }
});
