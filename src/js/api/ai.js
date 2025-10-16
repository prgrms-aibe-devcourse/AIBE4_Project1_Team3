const USE_MOCK = false;
const API_BASE = "http://localhost:10000";

/**
 * AI 여행 경로 추천 API 호출
 * @param {Object} params - 요청 파라미터
 * @returns {Promise<Object>} 추천 여행 일정
 */
export async function getAiRecommendation({
  city,
  startDate,
  endDate,
  people,
  budget,
}) {
  if (USE_MOCK) {
    return mockItinerary(city, budget);
  }

  const response = await fetch(`${API_BASE}/api/routes/ai/itinerary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, startDate, endDate, people, budget }),
  });

  if (!response.ok) {
    throw new Error(
      `AI 추천 요청 실패: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Day1만 먼저 받는 초경량 호출
 * @param {Object} params - 요청 파라미터
 * @returns {Promise<Object>} Day1 일정 { city, dayPlan }
 */
export async function getAiDay1Recommendation({
  city,
  startDate,
  endDate,
  people,
  budget,
}) {
  const response = await fetch(`${API_BASE}/api/routes/ai/itinerary/day1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, startDate, endDate, people, budget }),
  });

  if (!response.ok) {
    throw new Error(
      `AI Day1 요청 실패: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * 특정 Day만 빠르게 받는 호출 (Day 1~4)
 * @param {number} dayNum - 요청할 Day 번호 (1~4)
 * @param {Object} params - 요청 파라미터
 * @returns {Promise<Object>} Day N 일정 { city, dayPlan }
 */
export async function getAiDayNRecommendation(
  dayNum,
  { city, startDate, endDate, people, budget }
) {
  if (dayNum < 1 || dayNum > 4) {
    throw new Error("Day는 1~4 사이여야 합니다.");
  }

  const response = await fetch(
    `${API_BASE}/api/routes/ai/itinerary/day${dayNum}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, startDate, endDate, people, budget }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `AI Day${dayNum} 요청 실패: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Day 5 이상 나머지 일정을 한꺼번에 받는 호출
 * @param {Object} params - 요청 파라미터
 * @returns {Promise<Object>} 나머지 일정 { city, dayPlans }
 */
export async function getAiRemainingRecommendation({
  city,
  startDate,
  endDate,
  people,
  budget,
}) {
  const response = await fetch(
    `${API_BASE}/api/routes/ai/itinerary/remaining`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, startDate, endDate, people, budget }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `AI 나머지 일정 요청 실패: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Mock 데이터 생성 (개발/테스트용)
 */
function mockItinerary(city, budget) {
  const isOsaka =
    city.toLowerCase().includes("오사카") ||
    city.toLowerCase().includes("osaka");

  const places = isOsaka
    ? [
        ["도톤보리", "먹거리와 네온 사인", 34.6687, 135.5019],
        ["오사카성", "성곽과 공원 산책", 34.6873, 135.5262],
        ["신사이바시", "쇼핑 스트리트", 34.6735, 135.5013],
      ]
    : [
        ["아사쿠사 센소지", "가미나리몬", 35.7148, 139.7967],
        ["스카이트리", "전망대", 35.7101, 139.8107],
        ["시부야 스크램블", "랜드마크", 35.6595, 139.7005],
      ];

  const budgetNum = Number(String(budget).replace(/[^\d]/g, "")) || 300000;

  return {
    city,
    dayPlans: [
      {
        day: 1,
        title: `${city} 하루 코스`,
        stops: places.map(([name, desc, lat, lng], idx) => ({
          placeName: name,
          summary: desc,
          lat,
          lng,
          estimatedCost: Math.round(budgetNum / places.length / (idx + 1)),
        })),
      },
    ],
  };
}
