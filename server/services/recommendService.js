// JSON 파싱 유틸리티 (강화된 버전)
export const parseJSON = (text) => {
  if (!text || typeof text !== 'string') {
    console.error('[parseJSON] 입력이 유효하지 않음:', typeof text);
    return null;
  }

  // 5차 시도: 좌표 필드 수정 (잘못된 형식 자동 수정)
  const fixCoordinates = (jsonText) => {
    // 패턴: "lat":13.7563,100.5018,"lng": 형태를 "lat":13.7563,"lng":100.5018, 형태로 수정
    let fixed = jsonText.replace(/"lat"\s*:\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*"lng"\s*:/g, '"lat":$1,"lng":$2,');

    // 패턴2: "lng":값 뒤에 바로 다른 숫자가 오는 경우 제거
    fixed = fixed.replace(/"lng"\s*:\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,/g, '"lng":$1,');

    return fixed;
  };

  // 1차 시도: 원본 텍스트 직접 파싱
  try {
    const parsed = JSON.parse(text);
    console.log('[parseJSON] ✅ 1차 시도 성공 (직접 파싱)');
    return parsed;
  } catch (e1) {
    console.warn('[parseJSON] 1차 시도 실패 (직접 파싱):', e1.message);
  }

  // 2차 시도: 마크다운 코드블록 제거 후 파싱
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    console.log('[parseJSON] ✅ 2차 시도 성공 (코드블록 제거)');
    return parsed;
  } catch (e2) {
    console.warn('[parseJSON] 2차 시도 실패 (코드블록 제거):', e2.message);
  }

  // 3차 시도: 좌표 필드 수정 후 파싱
  const fixedCoords = fixCoordinates(cleaned);
  try {
    const parsed = JSON.parse(fixedCoords);
    console.log('[parseJSON] ✅ 3차 시도 성공 (좌표 수정)');
    return parsed;
  } catch (e3) {
    console.warn('[parseJSON] 3차 시도 실패 (좌표 수정):', e3.message);
  }

  // 4차 시도: 첫 번째 { 부터 마지막 } 까지 추출
  const startIdx = fixedCoords.indexOf('{');
  const endIdx = fixedCoords.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const extracted = fixedCoords.substring(startIdx, endIdx + 1);
    try {
      const parsed = JSON.parse(extracted);
      console.log('[parseJSON] ✅ 4차 시도 성공 (중괄호 추출)');
      return parsed;
    } catch (e4) {
      console.warn('[parseJSON] 4차 시도 실패 (중괄호 추출):', e4.message);
    }
  }

  // 5차 시도: 정규식으로 JSON 구조 매칭
  const jsonMatch = fixedCoords.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[parseJSON] ✅ 5차 시도 성공 (정규식 매칭)');
      return parsed;
    } catch (e5) {
      console.warn('[parseJSON] 5차 시도 실패 (정규식 매칭):', e5.message);
    }
  }

  // 모든 시도 실패
  console.error('[parseJSON] ❌ 모든 파싱 시도 실패 (5번 시도)');
  console.error('[parseJSON] 원본 텍스트 (앞 500자):', text.substring(0, 500));
  console.error('[parseJSON] 수정된 텍스트 (앞 500자):', fixedCoords.substring(0, 500));
  return null;
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
  console.log(`[fetchRealTimeWeather] 호출됨 - city: ${city}, lat: ${lat}, lon: ${lon}, startDate: ${startDate}`);

  if (!isFinite(lat) || !isFinite(lon)) {
    console.warn(
      `[fetchRealTimeWeather] 유효하지 않은 좌표: lat=${lat}, lon=${lon}`
    );
    return null;
  }

  const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
  const OPENWEATHERMAP_API_URL = process.env.OPENWEATHERMAP_API_URL;

  console.log("[fetchRealTimeWeather] 환경 변수 체크:");
  console.log("  - API_KEY:", OPENWEATHERMAP_API_KEY ? `Loaded (${OPENWEATHERMAP_API_KEY.substring(0, 8)}...)` : "❌ Not found");
  console.log("  - API_URL:", OPENWEATHERMAP_API_URL || "❌ Not found");

  if (!OPENWEATHERMAP_API_KEY || !OPENWEATHERMAP_API_URL) {
    console.error("[fetchRealTimeWeather] ❌ 환경 변수가 설정되지 않았습니다!");
    return null;
  }

  const url = `${OPENWEATHERMAP_API_URL}?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;

  console.log("[fetchRealTimeWeather] API 요청 URL:", url);

  try {
    console.log("[fetchRealTimeWeather] API 요청 시작...");
    const response = await fetch(url);
    console.log("[fetchRealTimeWeather] API 응답 상태:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fetchRealTimeWeather] API 오류 응답:", errorText);
      throw new Error(`OpenWeatherMap API 오류: ${response.statusText} - ${errorText}`);
    }

    // 날씨 정보 API 결과값
    const data = await response.json();
    console.log("[fetchRealTimeWeather] API 응답 데이터:", JSON.stringify(data, null, 2).substring(0, 500) + "...");

    // 여행 시작일의 예보 필터링
    const targetDate = new Date(startDate).toISOString().split("T")[0];
    console.log("[fetchRealTimeWeather] 타겟 날짜:", targetDate);
    console.log("[fetchRealTimeWeather] 가용 예보 날짜들:", data.list?.slice(0, 3).map(item => item.dt_txt));

    const forecasts = data.list.filter((item) => {
      const forecastDate = item.dt_txt.split(" ")[0];
      return forecastDate === targetDate;
    });

    console.log("[fetchRealTimeWeather] 필터링된 예보 개수:", forecasts.length);

    if (forecasts.length === 0) {
      console.warn(`[fetchRealTimeWeather] ❌ 예보 없음: ${city}, ${targetDate}`);
      console.warn(`[fetchRealTimeWeather] 가용한 날짜 범위를 확인하세요. 현재 API는 최대 5일 후까지만 제공합니다.`);
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

    const result = {
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

    console.log("[fetchRealTimeWeather] ✅ 성공:", result);
    return result;
  } catch (err) {
    console.error("[fetchRealTimeWeather] ❌ API 호출 실패:", err.message);
    console.error("[fetchRealTimeWeather] 에러 스택:", err.stack);
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
