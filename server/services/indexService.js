const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const candidateCountries = [
  // { name: "중국", currency: "CNH" },
  // { name: "프랑스", currency: "EUR" },
  // { name: "영국", currency: "GBP" },
  { name: "일본", currency: "JPY" },
  // { name: "태국", currency: "THB" },
  { name: "미국", currency: "USD" },
];

const currencyUnitMap = {
  JPY: 100, // 일본 엔화 100엔 단위
  CNH: 1, // 중국 위안 (CNH) — 1단위
  EUR: 1, // 유로화 — 1단위
  GBP: 1, // 영국 파운드 — 1단위
  THB: 1, // 태국 바트 — 1단위
  USD: 1, // 미국 달러 — 1단위
};

// 예시
const exchangeRatesData = {
  JPY: {
    current: 900.5, // 100엔 당 원화
    historical: [920.1, 915.6, 910.0, 905.4, 902.3, 898.9], // 6개월 전부터 1개월 전까지, 매월 1일 환율
  },
  USD: {
    current: 1350.8,
    historical: [1320.0, 1325.5, 1330.1, 1340.0, 1345.2, 1348.0],
  },
  // ... 다른 통화 데이터
};

function analyzeRateTrend(currentRate, historicalRates) {
  if (!historicalRates || historicalRates.length === 0) {
    return "N/A";
  }

  // 1. 과거 6개월 환율의 평균을 계산
  const sum = historicalRates.reduce((acc, rate) => acc + rate, 0);
  const average = sum / historicalRates.length;

  // 2. 평균 대비 현재 환율의 변동률 계산
  const trendPercentage = ((currentRate - average) / average) * 100;

  // 3. 추세 판단 (원화 기준)
  let trendDirection = "";
  if (trendPercentage < -1) {
    trendDirection = "약세/유리"; // 해당 통화가치가 하락 -> 여행자에게 유리
  } else if (trendPercentage > 1) {
    trendDirection = "강세/불리"; // 해당 통화가치가 상승 -> 여행자에게 불리
  } else {
    trendDirection = "보합세";
  }

  return `${trendPercentage.toFixed(2)}% (${trendDirection})`;
}

async function recommend({ startDate, endDate, budget, people }) {
  const contextDataForPrompt = candidateCountries.map((country) => {
    const rates = exchangeRatesData[country.currency];
    const unit = currencyUnitMap[country.currency];
    const trend = analyzeRateTrend(rates.current, rates.historical);

    return {
      name: country.name,
      currency: country.currency,
      current_exchange_rate: `${(rates.current / unit).toFixed(
        2
      )} KRW / ${unit} ${country.currency}`,
      exchange_rate_trend_6m_avg: trend,
      estimated_daily_spending: 100000, // 예: 10만원
    };
  });

  const contextDataString = JSON.stringify(contextDataForPrompt, null, 2);

  const prompt = `
      # 역할
      당신은 데이터 기반의 여행지 추천 전문가입니다. 당신의 임무는 사용자의 조건과 최신 경제 지표를 종합적으로 분석하여 최고의 가치를 제공하는 여행지를 추천하는 것입니다.

      # 임무
      사용자 요청과 아래 국가별 경제 데이터를 종합하여, 사용자에게 가장 적합한 여행 국가 3곳을 추천하고 그 이유를 간략히 설명해 주세요.

      # 사용자 정보
      - 여행 기간: ${startDate} 부터 ${endDate} 까지
      - 총 예산: ${budget}원(KRW)
      - 인원: ${people}명
      - 기준 통화: KRW

      # 국가별 환율 및 지표
      ${contextDataString}

      # 수행 규칙 및 논리
      1.  'exchange_rate_trend_6m_avg' 항목을 핵심적으로 분석하세요.
      2.  과거 6개월의 환율 데이터를 이용해, 단순 선형 추세를 기반으로 다음 달 예상 환율을 추정하세요.
          - 예: 최근 6개월 환율의 평균 변화율(%)을 계산해 미래 환율을 추정.
      3.  예측한 환율이 낮을수록(원화 기준 외화 약세) 여행비용이 절약되므로 점수를 높이세요.
      4.  사용자 예산과 국가별 예상 경비('estimated_daily_spending')를 함께 고려하세요.
      5.  최종적으로 '예상 환율'과 '예산 효율성'을 종합하여 상위 3개국을 추천하세요.

      # 출력 형식
      답변은 반드시 아래와 같은 JSON 형식으로만 제공해주세요. 다른 설명은 붙이지 마세요.
      {
        "recommendations": [
          {"rank": 1, "country": "추천 국가명", "current_rate": "입력 데이터에서 가져온 current_exchange_rate", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forcasted_exchange_rate": "예상 환율"},
          {"rank": 2, "country": "추천 국가명", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forcasted_exchange_rate": "예상 환율"},
          {"rank": 3, "country": "추천 국가명", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forcasted_exchange_rate": "예상 환율"}
        ]
      }
    `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text();

  try {
    // AI가 생성한 텍스트에서 불필요한 마크다운(` ```json `)을 제거
    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const jsonObject = JSON.parse(cleanedText);

    return jsonObject;
  } catch (error) {
    console.error("JSON 파싱 오류:", error);
    throw new Error("AI가 유효하지 않은 형식의 응답을 생성했습니다.");
  }
}

module.exports = {
  recommend,
};
