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

// 시간대별 우선순위 정의
const TIME_SLOT_ORDER = {
  morning: 1,
  late_morning: 2,
  afternoon: 3,
  tea: 4,
  evening: 5,
  night: 6,
};

// category를 기반으로 기본 timeSlot 추론
function inferTimeSlot(category) {
  const categoryToTimeSlot = {
    breakfast: "morning",
    lunch: "afternoon",
    snack: "tea",
    cafe: "tea",
    dinner: "evening",
    nightlife: "night",
    airport: "morning",
    transfer: "morning",
  };
  return categoryToTimeSlot[category] || "late_morning";
}

// stops를 시간 순서대로 정렬
export function sortStopsByTime(stops) {
  return [...stops].sort((a, b) => {
    // timeSlot이 없으면 category로부터 추론
    const timeSlotA = a.timeSlot || inferTimeSlot(a.category);
    const timeSlotB = b.timeSlot || inferTimeSlot(b.category);

    const orderA = TIME_SLOT_ORDER[timeSlotA] || 99;
    const orderB = TIME_SLOT_ORDER[timeSlotB] || 99;

    return orderA - orderB;
  });
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
