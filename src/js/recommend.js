import { getAiRecommendation } from "./api/ai.js";
import { showLoading, hideLoading } from "./components/loading.js";
import {
  formatCurrency,
  stripDigits,
  formatDate,
  getCurrencySymbol,
} from "./utils/format.js";
import { sanitizePlan } from "./utils/sanitizePlan.js";

// XSS 방어를 위한 HTML 이스케이프 함수
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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
  // 시간대별 우선순위 (실제 시간 흐름 순서)
  static TIME_SLOT_ORDER = {
    morning: 1, // 07:00~09:00 (아침 식사, 공항 도착)
    late_morning: 2, // 09:00~12:00 (오전 관광)
    afternoon: 3, // 12:00~14:00 (점심 식사)
    tea: 4, // 14:00~17:00 (오후 활동, 카페)
    evening: 5, // 17:00~20:00 (저녁 식사)
    night: 6, // 20:00~23:00 (야간 활동)
  };

  // category를 기반으로 기본 timeSlot 추론
  static inferTimeSlot(category) {
    const categoryToTimeSlot = {
      // 식사 (반드시 시간대 고정)
      breakfast: "morning", // 아침 = morning
      lunch: "afternoon", // 점심 = afternoon
      dinner: "evening", // 저녁 = evening

      // 간식/카페
      snack: "tea", // 간식 = tea (오후)
      cafe: "tea", // 카페 = tea (오후)

      // 교통/이동
      airport: "morning", // 공항 = morning (첫날) 또는 late_morning (마지막날)
      transfer: "late_morning", // 이동 = late_morning

      // 활동
      sightseeing: "late_morning", // 관광 = 오전 (기본값)
      shopping: "tea", // 쇼핑 = 오후 (기본값)
      activity: "tea", // 액티비티 = 오후 (기본값)
      nightlife: "night", // 야간활동 = night
    };
    return categoryToTimeSlot[category] || "late_morning";
  }

  // stops를 시간 순서대로 정렬
  static sortByTimeSlot(stops) {
    if (!Array.isArray(stops) || stops.length === 0) {
      return stops;
    }

    return [...stops].sort((a, b) => {
      const timeSlotA =
        a.timeSlot || ItineraryPlanner.inferTimeSlot(a.category);
      const timeSlotB =
        b.timeSlot || ItineraryPlanner.inferTimeSlot(b.category);

      const orderA = ItineraryPlanner.TIME_SLOT_ORDER[timeSlotA] || 99;
      const orderB = ItineraryPlanner.TIME_SLOT_ORDER[timeSlotB] || 99;

      return orderA - orderB;
    });
  }

  static optimizeDay(stops, { maxStops = 15, maxTravelKm = 75 } = {}) {
    // 1. 먼저 시간순으로 정렬 (가장 중요!)
    const timeSorted = ItineraryPlanner.sortByTimeSlot(stops);
    const pts = timeSorted.filter((s) => isFinite(s.lat) && isFinite(s.lng));

    if (pts.length <= 1) return pts;

    // 2. 시간순 정렬을 유지하면서 최대 개수만 제한
    // (동선 최적화는 시간 순서를 깨뜨릴 수 있으므로 적용하지 않음)
    const limited = pts.slice(0, maxStops);

    // 3. 거리 제한 체크 (시간순 유지하면서)
    let total = 0;
    const pruned = [limited[0]];

    for (let i = 1; i < limited.length; i++) {
      const d = GeoUtils.haversine(
        [pruned[pruned.length - 1].lat, pruned[pruned.length - 1].lng],
        [limited[i].lat, limited[i].lng]
      );

      // 거리 제한을 초과하더라도 식사는 반드시 포함
      const isMeal = ["breakfast", "lunch", "dinner"].includes(
        limited[i].category
      );

      if (total + d <= maxTravelKm || isMeal) {
        total += d;
        pruned.push(limited[i]);
      }
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

  // 모든 여정의 경로 맵 구성 로직
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

  // 해당 Day선택 시 맵 구성 로직
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
          stopSum === 0 ? "무료" : formatCurrency(stopSum)
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

/**
 * 날씨 정보를 화면에 렌더링하는 클래스
 */
class WeatherRenderer {
  constructor(container) {
    this.container = container;
  }

  /**
   * 날씨 상태에 따른 아이콘을 반환합니다.
   */
  getWeatherIcon(season, rainyDays) {
    if (rainyDays > 15) return "🌧️";

    const seasonIconMap = {
      겨울: "❄️",
      여름: "☀️",
      더위: "☀️",
      우기: "🌧️",
      건기: "☀️",
      봄: "🌸",
      가을: "🍂",
    };

    return seasonIconMap[season] || "🌤️";
  }

  /**
   * 날씨 정보를 기반으로 HTML 카드를 생성합니다.
   */
  renderWeatherCard(weather) {
    const icon = this.getWeatherIcon(weather.season, weather.rainyDays);
    const isRealTime = weather.isRealTime || false;
    const title = isRealTime
      ? `${escapeHtml(weather.city)} 실시간 예보`
      : `${escapeHtml(weather.city)} ${weather.month}월 평균 날씨`;

    const precipitationLabel = isRealTime ? "강수 확률" : "강수량";
    const precipitationValue = isRealTime
      ? `${weather.precipitation}%`
      : `${weather.precipitation}mm`;

    return `
      <div class="weather-card ${isRealTime ? "weather-card--realtime" : ""}">
        <div class="weather-header">
          <div class="weather-icon">${icon}</div>
          <div class="weather-title">
            <h4>${title}</h4>
            <span class="weather-season">${escapeHtml(weather.season)}</span>
          </div>
        </div>

        ${isRealTime ? `<div class="weather-badge">⚡ 실시간 예보</div>` : ""}

        <div class="weather-temp">
          <div class="temp-item">
            <span class="temp-label">최저</span>
            <span class="temp-value temp-value-left">${weather.tempLow}°C</span>
          </div>
          <div class="temp-divider"></div>
          <div class="temp-item">
            <span class="temp-label">최고</span>
            <span class="temp-value temp-value-right">${
              weather.tempHigh
            }°C</span>
          </div>
        </div>

        <div class="weather-details">
          <div class="detail-item">
            <span class="detail-icon">💧</span>
            <span class="detail-text">${precipitationLabel} ${precipitationValue}</span>
          </div>
          ${
            !isRealTime
              ? `<div class="detail-item">
                  <span class="detail-icon">🌂</span>
                  <span class="detail-text">강수일 약 ${weather.rainyDays}일</span>
                </div>`
              : ""
          }
        </div>

        <div class="weather-tip">
          <div class="tip-icon">💡</div>
          <div class="tip-content">
            <strong>여행 TIP</strong>
            <p>${escapeHtml(weather.tip)}</p>
          </div>
        </div>

        ${
          !isRealTime
            ? `<div class="weather-notice">
                ℹ️ 평균 날씨 데이터입니다. 여행일이 5일 이내면 실시간 예보가 표시됩니다.
              </div>`
            : `<div class="weather-notice weather-notice--success">
                ✅ OpenWeatherMap 실시간 예보 데이터입니다.
              </div>`
        }
      </div>
    `;
  }

  render(weather) {
    if (!weather) {
      this.container.innerHTML = "<p>날씨 정보를 불러올 수 없습니다.</p>";
      return;
    }
    this.container.innerHTML = this.renderWeatherCard(weather);
  }

  showLoading() {
    this.container.innerHTML = `
      <div class="loading__spinner">
        <div class="spinner"></div>
        <span>날씨 정보를 불러오는 중입니다...</span>
      </div>
    `;
  }

  showError(message) {
    this.container.innerHTML = `<p style="color: #ef4444;">${escapeHtml(
      message
    )}</p>`;
  }
}

class AppController {
  constructor() {
    this.result = document.getElementById("recommendResult");
    this.loading = document.getElementById("loadingIndicator");
    this.rightPanel = document.getElementById("rightPanel");
    this.mapContainer = document.querySelector(".panel--map");
    this.weatherPanel = document.getElementById("weatherPanel");
    this.weatherResults = document.getElementById("weatherResults");

    this.map = new MapRenderer("mapContainer");
    this.cards = new RecommendationRenderer(this.result);
    this.weather = new WeatherRenderer(this.weatherResults);

    this.form = document.getElementById("travelForm");
    this.start = document.getElementById("travelStart");
    this.end = document.getElementById("travelEnd");
    this.people = document.getElementById("travelPeople");
    this.budget = document.getElementById("travelBudget");
    this.city = document.getElementById("travelCity");
    this.reviewBtn = document.getElementById("reviewBtn");
  }
  init() {
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

    // sessionStorage에서 city 정보 복원
    this.restoreCityFromStorage();

    // URL 파라미터 확인 및 자동 실행
    this.checkUrlParams();
  }

  restoreCityFromStorage() {
    const savedCity = sessionStorage.getItem("travelCity");
    if (savedCity && this.city && !this.city.value) {
      this.city.value = savedCity;
    }
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const city = params.get("city");
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");
    const people = params.get("people");
    const budget = params.get("budget");

    if (city && startDate && endDate && people && budget) {
      // 폼에 값 채우기
      if (this.city) this.city.value = city;
      if (this.start) this.start.value = startDate;
      if (this.end) this.end.value = endDate;
      if (this.people) this.people.value = people;
      if (this.budget)
        this.budget.value = Number(budget).toLocaleString("ko-KR");

      // city 정보를 sessionStorage에 저장
      sessionStorage.setItem("travelCity", city);

      // 자동으로 검색 실행
      this.autoSubmit(city, startDate, endDate, people, Number(budget));
    }
  }

  async autoSubmit(city, startDate, endDate, people, budgetNum) {
    showLoading(this.loading);
    this.rightPanel.style.display = "none";

    try {
      const itinerary = await getAiRecommendation({
        city,
        startDate,
        endDate,
        people,
        budget: budgetNum,
      });

      if (!itinerary || !itinerary.dayPlans || !itinerary.dayPlans.length) {
        throw new Error("서버에서 유효하지 않은 응답을 받았습니다.");
      }

      const fx = 9.5;
      sanitizePlan(itinerary, fx);

      const optimized = ItineraryPlanner.optimizeAll(itinerary.dayPlans || []);
      const finalItin = { city: itinerary.city || city, dayPlans: optimized };

      sanitizePlan(finalItin, fx);

      this.map.init([34.6937, 135.5023], 11);
      this.cards.render(finalItin, this.map);
      this.map.renderDayPlans(finalItin.dayPlans);

      // 오른쪽 패널 표시 (맵 + 날씨 영역 표시)
      this.rightPanel.style.display = null;
      setTimeout(() => this.map.map.invalidateSize(), 0);

      // 날씨 정보 로딩 시작
      this.weather.showLoading();

      // AI 응답의 첫 번째 장소 좌표 추출
      const firstStop = finalItin.dayPlans?.[0]?.stops?.[0];
      const weatherLat = firstStop?.lat || 34.6937;
      const weatherLng = firstStop?.lng || 135.5023;

      this.fetchAndRenderWeather({
        city: finalItin.city,
        lat: weatherLat,
        lng: weatherLng,
        startDate: startDate,
        averageWeather: itinerary.averageWeather,
      });

      this.reviewBtn.hidden = false;
      this.reviewBtn.addEventListener("click", () => {
        sessionStorage.setItem("reviewCourse", JSON.stringify(finalItin));
        window.location.href = "/src/review-form.html";
      });
    } catch (err) {
      console.error("AI 추천 오류:", err);

      let errorMessage = "추천 데이터를 불러오지 못했습니다.";
      if (err.message.includes("Failed to fetch")) {
        errorMessage =
          "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
      } else if (err.message.includes("AI 추천 요청 실패")) {
        errorMessage = `서버 오류가 발생했습니다: ${err.message}`;
      } else if (err.message) {
        errorMessage += `<br/><small>${escapeHtml(err.message)}</small>`;
      }

      this.result.innerHTML = `<p style="color: #ef4444;">${errorMessage}</p>`;
    } finally {
      hideLoading(this.loading);
    }
  }

  /**
   * 날씨 정보를 가져와서 화면에 렌더링합니다.
   * - 5일 이내: OpenWeatherMap 실시간 예보
   * - 5일 이후: AI가 제공한 평균 날씨 사용
   */
  async fetchAndRenderWeather({ city, lat, lng, startDate, averageWeather }) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const travelDate = new Date(startDate);
      travelDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((travelDate - today) / (1000 * 60 * 60 * 24));

      const apiBaseUrl = "http://localhost:3000";

      console.log(`[날씨 로직] ${city}, 여행까지 ${diffDays}일`);

      // 5일 이내: 실시간 날씨 API 호출
      if (diffDays >= 0 && diffDays <= 5) {
        const params = new URLSearchParams({
          city,
          lat,
          lng,
          startDate,
        });

        const response = await fetch(
          `${apiBaseUrl}/api/routes/weather?${params}`
        );

        if (!response.ok) {
          throw new Error("실시간 날씨 API 오류");
        }

        const weatherData = await response.json();
        this.weather.render(weatherData);
        console.log(`[실시간 날씨 표시] ${city}`);
        return;
      }

      // 5일 이후: AI가 제공한 평균 날씨 사용
      if (averageWeather) {
        this.weather.render({
          ...averageWeather,
          city,
          isAverage: true,
          isRealTime: false,
        });
        console.log(`[AI 평균 날씨 표시] ${city} - ${averageWeather.month}월`);
      } else {
        this.weather.showError("날씨 정보를 불러올 수 없습니다.");
      }
    } catch (err) {
      console.error("날씨 정보 로드 오류:", err);

      // 실시간 날씨 실패 시 AI 평균 날씨로 폴백
      if (averageWeather) {
        this.weather.render({
          ...averageWeather,
          city,
          isAverage: true,
          isRealTime: false,
        });
        console.log(`[실시간 실패, AI 평균 날씨 표시] ${city}`);
      } else {
        this.weather.showError("날씨 정보를 불러올 수 없습니다.");
      }
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const start = this.start?.value;
    const end = this.end?.value;
    const people = (this.people?.value || "").trim();
    const budgetNum = Number(stripDigits(this.budget?.value || ""));
    const city = (
      this.city?.value ||
      sessionStorage.getItem("travelCity") ||
      "오사카"
    ).trim();
    const peopleNum = parseInt(people, 10);

    if (!start || !end || !people || !budgetNum) {
      alert("기간 / 인원 / 경비를 모두 입력해주세요.");
      return;
    }
    if (budgetNum <= 0) {
      alert("경비는 0보다 커야 합니다.");
      return;
    }
    if (isNaN(peopleNum) || peopleNum <= 0) {
      alert("인원은 양의 정수여야 합니다.");
      return;
    }
    if (new Date(end) < new Date(start)) {
      alert("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    // city 정보를 sessionStorage에 저장
    sessionStorage.setItem("travelCity", city);

    showLoading(this.loading);
    this.rightPanel.style.display = "none";

    try {
      const itinerary = await getAiRecommendation({
        city,
        startDate: start,
        endDate: end,
        people,
        budget: budgetNum,
      });

      if (!itinerary || !itinerary.dayPlans || !itinerary.dayPlans.length) {
        throw new Error("서버에서 유효하지 않은 응답을 받았습니다.");
      }

      const fx = 9.5;
      sanitizePlan(itinerary, fx);

      const optimized = ItineraryPlanner.optimizeAll(itinerary.dayPlans || []);
      const finalItin = { city: itinerary.city || city, dayPlans: optimized };

      sanitizePlan(finalItin, fx);

      this.map.init([34.6937, 135.5023], 11);
      this.cards.render(finalItin, this.map);
      this.map.renderDayPlans(finalItin.dayPlans);

      // 오른쪽 패널 표시 (맵 + 날씨 영역 표시)
      this.rightPanel.style.display = null;
      setTimeout(() => this.map.map.invalidateSize(), 0); // 지도 깨짐 방지

      // 날씨 정보 로딩 시작 (백그라운드에서 로드)
      this.weather.showLoading();

      // AI 응답의 첫 번째 장소 좌표 추출
      const firstStop = finalItin.dayPlans?.[0]?.stops?.[0];
      const weatherLat = firstStop?.lat || 34.6937; // 기본값: 오사카
      const weatherLng = firstStop?.lng || 135.5023;

      this.fetchAndRenderWeather({
        city: finalItin.city, // AI가 추천한 최종 도시명
        lat: weatherLat, // 첫 번째 장소의 위도
        lng: weatherLng, // 첫 번째 장소의 경도
        startDate: start, // 사용자가 입력한 여행 시작일
        averageWeather: itinerary.averageWeather, // AI가 제공한 평균 날씨
      });

      // 리뷰 버튼 표시 및 이벤트 리스너 설정
      this.reviewBtn.hidden = false;
      this.reviewBtn.addEventListener("click", () => {
        sessionStorage.setItem("reviewCourse", JSON.stringify(finalItin));
        window.location.href = "/src/review-form.html";
      });
    } catch (err) {
      console.error("AI 추천 오류:", err);

      let errorMessage = "추천 데이터를 불러오지 못했습니다.";
      if (err.message.includes("Failed to fetch")) {
        errorMessage =
          "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
      } else if (err.message.includes("AI 추천 요청 실패")) {
        errorMessage = `서버 오류가 발생했습니다: ${err.message}`;
      } else if (err.message) {
        errorMessage += `<br/><small>${escapeHtml(err.message)}</small>`;
      }

      this.result.innerHTML = `<p style="color: #ef4444;">${errorMessage}</p>`;
    } finally {
      hideLoading(this.loading);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => new AppController().init());
