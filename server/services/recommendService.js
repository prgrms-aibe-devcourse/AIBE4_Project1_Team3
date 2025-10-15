// JSON 파싱 유틸리티
export const parseJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch {}

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
};

const COST_CONFIG = {
  MIN_DAY_BUDGET: 60000,
  MIN_PER_STOP: 3000,
  MAX_PER_STOP: 180000,
  WEIGHT_SETS: {
    1: [1],
    2: [0.55, 0.45],
    3: [0.4, 0.35, 0.25],
    4: [0.35, 0.3, 0.2, 0.15],
    5: [0.3, 0.25, 0.2, 0.15, 0.1],
  },
  SPECIAL_PLACES: {
    유니버설: 120000,
    성: 8000,
    타워: 8000,
    시장: 7000,
    거리: 7000,
  },
};

function adjustCostByPlace(baseCost, placeName) {
  const name = String(placeName || "").toLowerCase();
  let adjusted = baseCost;

  for (const [keyword, minCost] of Object.entries(COST_CONFIG.SPECIAL_PLACES)) {
    if (name.includes(keyword.toLowerCase())) {
      adjusted = Math.max(adjusted, minCost);
    }
  }

  return adjusted;
}

function clampCost(cost) {
  return (
    Math.round(
      Math.min(
        COST_CONFIG.MAX_PER_STOP,
        Math.max(COST_CONFIG.MIN_PER_STOP, cost)
      ) / 100
    ) * 100
  );
}

function normalizeDayCosts(dayPlan, dayBudget) {
  const stops = Array.isArray(dayPlan.stops) ? dayPlan.stops : [];
  const numStops = Math.min(5, Math.max(1, stops.length));
  const weights = COST_CONFIG.WEIGHT_SETS[numStops] || [];
  const sumWeights = weights.reduce((a, b) => a + b, 0) || 1;

  const initialCosts = stops.map((stop, i) => {
    const weight = weights[i] || 1 / stops.length;
    let baseCost = Math.round((weight / sumWeights) * dayBudget);
    baseCost = adjustCostByPlace(baseCost, stop.placeName);
    return { ...stop, estimatedCost: clampCost(baseCost) };
  });

  const currentSum = initialCosts.reduce((sum, s) => sum + s.estimatedCost, 0);
  const scale = currentSum > 0 ? dayBudget / currentSum : 1;

  const scaledStops = initialCosts.map((stop) => ({
    ...stop,
    estimatedCost: clampCost(stop.estimatedCost * scale),
  }));

  const dayCostKRW = scaledStops.reduce((sum, s) => sum + s.estimatedCost, 0);

  return { ...dayPlan, stops: scaledStops, dayCostKRW };
}

// 전체 일정의 비용 정규화
export function normalizeCosts(itinerary, totalBudget, days) {
  const dayBudget = Math.max(
    COST_CONFIG.MIN_DAY_BUDGET,
    Math.floor(totalBudget / Math.max(1, days))
  );

  itinerary.dayPlans = (itinerary.dayPlans || []).map((dayPlan) =>
    normalizeDayCosts(dayPlan, dayBudget)
  );

  itinerary.totalCostKRW = itinerary.dayPlans.reduce(
    (sum, day) => sum + (day.dayCostKRW || 0),
    0
  );

  return itinerary;
}

// 시간대별 우선순위 정의 (실제 시간 흐름 순서)
const TIME_SLOT_ORDER = {
  morning: 1,        // 07:00~09:00 (아침 식사, 공항 도착)
  late_morning: 2,   // 09:00~12:00 (오전 관광)
  afternoon: 3,      // 12:00~14:00 (점심 식사)
  tea: 4,            // 14:00~17:00 (오후 활동, 카페)
  evening: 5,        // 17:00~20:00 (저녁 식사)
  night: 6,          // 20:00~23:00 (야간 활동)
};

// category를 기반으로 기본 timeSlot 추론
function inferTimeSlot(category) {
  const categoryToTimeSlot = {
    // 식사 (반드시 시간대 고정)
    breakfast: "morning",        // 아침 = morning
    lunch: "afternoon",          // 점심 = afternoon
    dinner: "evening",           // 저녁 = evening

    // 간식/카페
    snack: "tea",                // 간식 = tea (오후)
    cafe: "tea",                 // 카페 = tea (오후)

    // 교통/이동
    airport: "morning",          // 공항 = morning (첫날) 또는 late_morning (마지막날)
    transfer: "late_morning",    // 이동 = late_morning

    // 활동
    sightseeing: "late_morning", // 관광 = 오전 (기본값)
    shopping: "tea",             // 쇼핑 = 오후 (기본값)
    activity: "tea",             // 액티비티 = 오후 (기본값)
    nightlife: "night",          // 야간활동 = night
  };
  return categoryToTimeSlot[category] || "late_morning";
}

// stops를 시간 순서대로 정렬
export function sortStopsByTime(stops) {
  if (!Array.isArray(stops) || stops.length === 0) {
    return stops;
  }

  // 정렬 전 순서 로깅
  const beforeOrder = stops.map(s => `${s.category}(${s.timeSlot || 'auto'})`).join(' → ');

  const sorted = [...stops].sort((a, b) => {
    // timeSlot이 없으면 category로부터 추론
    const timeSlotA = a.timeSlot || inferTimeSlot(a.category);
    const timeSlotB = b.timeSlot || inferTimeSlot(b.category);

    const orderA = TIME_SLOT_ORDER[timeSlotA] || 99;
    const orderB = TIME_SLOT_ORDER[timeSlotB] || 99;

    return orderA - orderB;
  });

  // 정렬 후 순서 로깅
  const afterOrder = sorted.map(s => {
    const ts = s.timeSlot || inferTimeSlot(s.category);
    return `${s.category}(${ts})`;
  }).join(' → ');

  // 순서가 바뀐 경우만 로그 출력
  if (beforeOrder !== afterOrder) {
    console.log('⏰ [시간순 정렬 적용됨]');
    console.log('  Before:', beforeOrder);
    console.log('  After: ', afterOrder);
  }

  return sorted;
}

// ===== 날씨 관련 상수 및 함수 =====

export const WEATHER_CONSTANTS = {
  REAL_TIME_THRESHOLD_DAYS: 5, // 실시간 예보를 사용할 날짜 범위 (Max 5일 이내)
  MS_PER_DAY: 1000 * 60 * 60 * 24, // 밀리초 단위 하루
  DEFAULT_TEMP_HIGH: 20,
  DEFAULT_TEMP_LOW: 10,
  DEFAULT_PRECIPITATION: 50,
  DEFAULT_RAINY_DAYS: 5,
};

/**
 * 날씨 코드를 기반으로 계절/팁 정보를 생성합니다.
 */
export function getWeatherSeasonAndTip(mainWeather, tempHigh) {
  const TEMP_HOT_THRESHOLD = 25;

  const weatherInfo = {
    Rain: {
      season: "우천",
      tip: "비가 올 예정입니다. 우산과 방수 옷을 준비하세요.",
    },
    Clear: {
      season: "맑음",
      tip:
        tempHigh > TEMP_HOT_THRESHOLD
          ? "맑고 더운 날씨입니다. 자외선 차단제를 챙기세요."
          : "맑고 쾌적한 날씨입니다. 여행하기 좋습니다!",
    },
    Clouds: {
      season: "흐림",
      tip: "구름 많은 날씨입니다. 가벼운 외투를 준비하세요.",
    },
    Snow: {
      season: "눈",
      tip: "눈이 올 예정입니다. 따뜻한 옷과 미끄럼 방지 신발을 준비하세요.",
    },
  };

  return (
    weatherInfo[mainWeather] || {
      season: mainWeather,
      tip: "날씨 변화에 대비하세요.",
    }
  );
}

/**
 * 날짜 차이를 계산합니다 (일 단위).
 */
export function calculateDaysDifference(date1, date2) {
  return Math.ceil((date1 - date2) / WEATHER_CONSTANTS.MS_PER_DAY);
}

/**
 * OpenWeatherMap API로부터 실시간 날씨 예보를 가져옵니다.
 */
export async function fetchRealTimeWeather(lat, lon, city, startDate) {
  if (!isFinite(lat) || !isFinite(lon)) {
    console.warn(`[fetchRealTimeWeather] 유효하지 않은 좌표: lat=${lat}, lon=${lon}`);
    return null;
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenWeatherMap API 오류: ${response.statusText}`);
    }

    const data = await response.json();

    // 여행 시작일의 예보 필터링
    const targetDate = new Date(startDate).toISOString().split("T")[0];
    const forecasts = data.list.filter((item) => {
      const forecastDate = item.dt_txt.split(" ")[0];
      return forecastDate === targetDate;
    });

    if (forecasts.length === 0) {
      console.warn(`[fetchRealTimeWeather] 예보 없음: ${city}, ${targetDate}`);
      return null;
    }

    // 최고/최저 온도 계산
    const temps = forecasts.map((f) => f.main.temp);
    const tempHigh = Math.round(Math.max(...temps));
    const tempLow = Math.round(Math.min(...temps));

    // 가장 빈번한 날씨 상태 추출
    const weatherCounts = {};
    forecasts.forEach((f) => {
      const weather = f.weather[0].main;
      weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;
    });
    const mainWeather = Object.keys(weatherCounts).reduce((a, b) =>
      weatherCounts[a] > weatherCounts[b] ? a : b
    );

    // 강수 확률 평균 계산
    const avgPop = Math.round(
      (forecasts.reduce((sum, f) => sum + (f.pop || 0), 0) / forecasts.length) *
        100
    );

    // 날씨별 팁과 계절 정보 생성
    const { season, tip } = getWeatherSeasonAndTip(mainWeather, tempHigh);

    return {
      city,
      tempHigh,
      tempLow,
      precipitation: avgPop,
      rainyDays: avgPop > 50 ? 1 : 0,
      season,
      tip,
      isAverage: false,
      isRealTime: true,
    };
  } catch (err) {
    console.error("[fetchRealTimeWeather] API 호출 실패:", err.message);
    return null;
  }
}

export function ensureReasons(itinerary) {
  itinerary.dayPlans = (itinerary.dayPlans || []).map((d) => {
    const stops = (d.stops || []).map((s) => {
      const reason =
        s.reason && String(s.reason).trim()
          ? s.reason
          : `${s.placeName}은(는) ${
              s.summary || "해당 지역의 대표 명소"
            }로, 인근 동선과 함께 방문하기 좋습니다.`;
      return { ...s, reason };
    });
    // 시간순으로 정렬
    const sortedStops = sortStopsByTime(stops);
    return { ...d, stops: sortedStops };
  });
  return itinerary;
}
