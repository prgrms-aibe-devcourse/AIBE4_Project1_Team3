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
    if (this.map) {
      this.map.remove();
    }
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

  //해당 Day선택 시 맵 구성 로직
  renderSingleDay(dayPlan) {
    if (!this.map || !this.layer) return;
    this.layer.clearLayers();

    const latLngs = [];
    const allPts = [];

    (dayPlan.stops || []).forEach((s, si) => {
      const latlng = [s.lat, s.lng];
      latLngs.push(latlng);
      allPts.push(latlng);
      L.marker(latlng)
        .bindPopup(
          `<b>Day ${dayPlan.day} · ${si + 1}. ${escapeHtml(
            s.placeName
          )}</b><br/>${escapeHtml(s.summary || "")}`
        )
        .addTo(this.layer);
    });

    if (latLngs.length >= 2) {
      L.polyline(latLngs, {
        color: "#0ea5ff", // Pin color (selected day)
        weight: 4,
        opacity: 0.9,
      }).addTo(this.layer);
    }

    if (allPts.length) {
      this.map.fitBounds(L.latLngBounds(allPts), { padding: [30, 30] });
    }
  }
}

class RecommendationRenderer {
  constructor(container, city = "") {
    this.container = container;
    this.city = city;
  }

  static calculateStopCost(stop) {
    // 백엔드에서 정규화된 estimatedCost를 항상 사용
    return Number(stop.estimatedCost) || 0;
  }

  renderCostBreakdown(stop, city) {
    const currencySymbol = getCurrencySymbol(city);

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
            원화: ${subKRW === 0 ? "무료" : formatCurrency(subKRW)}
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

  static getMealIcon(category) {
    const mealIcons = {
      breakfast: "🍳",
      lunch: "🍴",
      dinner: "🍽️",
      snack: "🍰",
      cafe: "☕",
    };
    return mealIcons[category] || "";
  }

  static getMealLabel(category) {
    const mealLabels = {
      breakfast: "아침",
      lunch: "점심",
      dinner: "저녁",
      snack: "간식",
      cafe: "카페",
    };
    return mealLabels[category] || "";
  }

  renderStop(stop, index, city) {
    const stopSum = RecommendationRenderer.calculateStopCost(stop);
    const cbHTML = this.renderCostBreakdown(stop, city);
    const category = stop.category || "";
    const isMeal = ["breakfast", "lunch", "dinner", "snack", "cafe"].includes(
      category
    );
    const mealIcon = isMeal ? RecommendationRenderer.getMealIcon(category) : "";
    const mealLabel = isMeal
      ? RecommendationRenderer.getMealLabel(category)
      : "";
    const mealClass = isMeal ? "meal-stop" : "";

    return `
      <li class="stops-row ${mealClass}" data-category="${escapeHtml(
      category
    )}">
        <span class="idx">${index + 1}</span>
        <div class="place">
          <div class="name">
            ${mealIcon ? `<span class="meal-icon">${mealIcon}</span>` : ""}
            ${mealLabel ? `<span class="meal-label">${mealLabel}</span>` : ""}
            ${escapeHtml(stop.placeName)}
          </div>
          <div class="sub">${escapeHtml(stop.summary || "")}</div>
          ${
            stop.stopReason
              ? `<p class="stop-reason">${escapeHtml(stop.stopReason)}</p>`
              : ""
          }
          ${cbHTML}
        </div>
        <span class="cost">${
          stopSum === 0 ? "무료" : `₩${stopSum.toLocaleString("ko-KR")}`
        }</span>
      </li>`;
  }

  renderDayCard(dayPlan, daySum, avgDaily, city) {
    const pct = avgDaily
      ? Math.min(100, Math.round((daySum / avgDaily) * 100))
      : 0;
    const rows = (dayPlan.stops || [])
      .map((s, i) => this.renderStop(s, i, city))
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
    // 실제 화면에 표시되는 stops의 합계를 기준으로 계산
    return days.map((dp) =>
      (dp.stops || []).reduce(
        (sum, s) => sum + (Number(s.estimatedCost) || 0),
        0
      )
    );
  }

  attachCardToggleEvents(dayPlans, map) {
    const cards = this.container.querySelectorAll(".route-card");
    cards.forEach((card, index) => {
      const head = card.querySelector(".route-card__head");
      const body = card.querySelector(".route-card__body");

      head.addEventListener("click", () => {
        const isOpening = body.style.display === "none";
        this.container.querySelectorAll(".route-card__body").forEach((b) => {
          if (b !== body) b.style.display = "none";
        });
        body.style.display = isOpening ? "block" : "none";

        if (isOpening && dayPlans[index]) {
          map.renderSingleDay(dayPlans[index]);
        }
      });
    });
  }

  render(itinerary, map) {
    const days = itinerary?.dayPlans || [];
    if (!days.length) {
      this.container.innerHTML = "<p>추천 결과가 없습니다.</p>";
      return;
    }

    // 도시 정보 업데이트
    const city = itinerary.city || this.city;
    if (itinerary.city) {
      this.city = itinerary.city;
    }

    const daySums = this.calculateDaySums(days);
    const avgDaily = daySums.length
      ? Math.round(daySums.reduce((a, b) => a + b, 0) / daySums.length)
      : 0;

    this.container.innerHTML = days
      .map((dp, idx) =>
        this.renderDayCard(dp, daySums[idx] || 0, avgDaily, city)
      )
      .join("");

    this.attachCardToggleEvents(days, map);
  }
}

const params = new URLSearchParams(window.location.search);
const draft = params.get("draft");

class AppController {
  constructor() {
    this.map = new MapRenderer("mapContainer");
    this.result = document.getElementById("recommendResult");
    this.cards = new RecommendationRenderer(this.result);
    this.courseInput = document.getElementById("course");
  }
  init() {
    this.map.init([34.6937, 135.5023], 11);

    if (draft) {
      const course = JSON.parse(window.localStorage.getItem("reviewCourse"));

      if (course) {
        console.log(course);
        this.courseInput.value = JSON.stringify(course);
        this.cards.render(course, this.map);
        this.map.renderDayPlans(course.dayPlans);
        setTimeout(() => this.map.map.invalidateSize(), 0);
      } else {
        console.log("no data");
        return;
      }
    } else {
      const course = JSON.parse(sessionStorage.getItem("reviewCourse"));

      if (course) {
        console.log(course);
        this.courseInput.value = JSON.stringify(course);
        this.cards.render(course, this.map);
        this.map.renderDayPlans(course.dayPlans);
        setTimeout(() => this.map.map.invalidateSize(), 0);
      } else {
        console.log("no data");
        return;
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => new AppController().init());

document.getElementById("reviewSaveBtn").addEventListener("click", async () => {
  if (
    confirm(
      "해당 경로를 임시저장하겠습니까?\n확인을 누르면 경로가 저장되며 리뷰게시판으로 이동합니다."
    )
  ) {
    const c = document.getElementById("course").value;

    window.localStorage.setItem("reviewCourse", c);

    alert("임시저장이 완료되었습니다!");
    window.location.href = "/review.html";
  }
});

document.getElementById("reviewForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Form → JSON 변환
  const formData = new FormData(e.target);
  const pwd = formData.get("password");

  if (pwd.length != 4) {
    alert("비밀번호는 4자리여야 합니다.");
    return;
  } else {
    const jsonData = Object.fromEntries(formData.entries());

    const url = "https://aibe4-project1-team3.onrender.com";

    // 서버에 전송
    const res = await fetch(url + "/api/review/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonData),
    });

    const result = await res.json();

    if (result.success) {
      // 임시저장된 리뷰 등록시 localstorage에 있는 데이터 삭제
      if (draft) {
        window.localStorage.removeItem("reviewCourse");
      }
      alert("리뷰가 등록되었습니다!");
      window.location.href = "/review.html";
    } else {
      alert("등록 실패: " + result.error);
    }
  }
});
