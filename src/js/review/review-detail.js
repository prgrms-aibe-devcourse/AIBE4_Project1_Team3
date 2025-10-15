import { formatCurrency, getCurrencySymbol } from "../utils/format.js";

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
  constructor(container, city = "") {
    this.container = container;
    this.city = city;
  }

  static calculateStopCost(stop) {
    if (!Array.isArray(stop.costBreakdown))
      return Number(stop.estimatedCost) || 0;
    return stop.costBreakdown.reduce(
      (acc, it) => acc + (Number(it.subtotalKRW) || 0),
      0
    );
  }

  renderCostBreakdown(stop) {
    const currencySymbol = getCurrencySymbol(this.city);

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
            단가: ${currencySymbol}${unit.toLocaleString()} × ${qty} = ${currencySymbol}${subJPY.toLocaleString()}<br/>
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

  renderStop(stop, index) {
    const stopSum = RecommendationRenderer.calculateStopCost(stop);
    const cbHTML = this.renderCostBreakdown(stop);

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
        <span class="cost">${stopSum === 0 ? "무료" : formatCurrency(stopSum)}</span>
      </li>`;
  }

  renderDayCard(dayPlan, daySum, avgDaily) {
    const pct = avgDaily
      ? Math.min(100, Math.round((daySum / avgDaily) * 100))
      : 0;
    const rows = (dayPlan.stops || [])
      .map((s, i) => this.renderStop(s, i))
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

    // 도시 정보 업데이트
    if (itinerary.city) {
      this.city = itinerary.city;
    }

    const daySums = this.calculateDaySums(days);
    const avgDaily = daySums.length
      ? Math.round(daySums.reduce((a, b) => a + b, 0) / daySums.length)
      : 0;

    this.container.innerHTML = days
      .map((dp, idx) =>
        this.renderDayCard(dp, daySums[idx] || 0, avgDaily)
      )
      .join("");

    this.attachCardToggleEvents();
  }
}

const params = new URLSearchParams(window.location.search);
const reviewId = params.get("id");
let pwd = "";

class AppController {
  constructor() {
    this.map = new MapRenderer("mapContainer");
    this.result = document.getElementById("recommendResult");
    this.cards = new RecommendationRenderer(this.result);
  }
  async init() {
    this.map.init([34.6937, 135.5023], 11);

    const url = "http://localhost:3000";
    const res = await fetch(url + `/api/review/receive/${reviewId}`);
    const data = await res.json();

    document.getElementById("title").textContent = data.title;
    document.getElementById("rating").textContent = makeStars(data.rating);
    document.getElementById("content").textContent = data.content;
    document.getElementById("createdAt").textContent = new Date(
      data.created_at
    ).toLocaleString();
    pwd = data.password;

    const course = JSON.parse(data.course);
    this.cards.render(course);
    this.map.renderDayPlans(course.dayPlans);
    setTimeout(() => this.map.map.invalidateSize(), 0);
  }
}

function makeStars(rating) {
  const full = "★".repeat(rating);
  const empty = "☆".repeat(5 - rating);
  return `${full}${empty}`;
}

document.addEventListener("DOMContentLoaded", () => new AppController().init());

document.getElementById("deleteForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const pwdInput = formData.get("password");

  if (pwd === pwdInput) {
    // 서버에 전송
    const response = await fetch(
      `http://localhost:3000/api/review/delete/${reviewId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log("삭제 성공:", data);
      alert("리뷰가 삭제되었습니다.");
      window.location.href = "/src/review.html";
    } else {
      console.error("삭제 실패:", data);
    }
  } else {
    alert("비밀번호가 일치하지 않습니다");
  }
});
