import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const candidateCountries = [
  { name: "중국", currency: "CNH" },
  { name: "유럽", currency: "EUR" },
  { name: "영국", currency: "GBP" },
  { name: "일본", currency: "JPY100" },
  { name: "태국", currency: "THB" },
  { name: "미국", currency: "USD" },
];

const currencyUnitMap = {
  JPY100: 100, // 일본 엔화 100엔 단위
  CNH: 1, // 중국 위안 (CNH) — 1단위
  EUR: 1, // 유로화 — 1단위
  GBP: 1, // 영국 파운드 — 1단위
  THB: 1, // 태국 바트 — 1단위
  USD: 1, // 미국 달러 — 1단위
};

function analyzeRateTrend(trend) {
  const trendPercentage = parseFloat(trend);

  let trendDirection = "";
  if (trendPercentage < -1) {
    trendDirection = "약세/유리"; // 해당 통화가치가 하락 -> 여행자에게 유리
  } else if (trendPercentage > 1) {
    trendDirection = "강세/불리"; // 해당 통화가치가 상승 -> 여행자에게 불리
  } else {
    trendDirection = "보합세";
  }

  return trendDirection;
}

export async function recommend({
  startDate,
  endDate,
  budget,
  people,
  exchangeRatesData,
}) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // 두 날짜 간의 차이(밀리초)를 일수로 변환 (시작일과 종료일 모두 포함)
  const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const today = new Date().toISOString().split("T")[0];

  const contextDataForPrompt = candidateCountries.map((country) => {
    const rates = exchangeRatesData[country.currency];
    const unit = currencyUnitMap[country.currency] || 1;
    const trend = exchangeRatesData[country.currency].trend || "N/A";
    const trendDirection = analyzeRateTrend(trend);

    const currentExchangeRateDisplay = `${unit} ${
      country.currency
    } / ${rates.current.toFixed(2)} KRW`;

    return {
      name: country.name, // 나라 이름
      currency: country.currency, // 나라 코드
      current_exchange_rate: currentExchangeRateDisplay, // 현재 환율
      exchange_rate_trend_6m_avg: trend, // 환율 추세
      exchange_rate_trend_direction: trendDirection, // 추세 방향
    };
  });

  const contextDataString = JSON.stringify(contextDataForPrompt, null, 2);

  const RecommendPrompt = `
    # 역할
    당신은 데이터와 거시 경제 분석을 기반으로 여행지를 추천하는 '데이터 기반 여행 추천 전문가'입니다.
    당신의 임무는 (1) 전문가 수준의 환율 분석을 먼저 수행하고, (2) 이 분석 결과와 사용자 데이터를 종합하여 (3) 최종 여행 추천 JSON을 생성하는 것입니다.

    # 임무
    아래에 제공된 '사용자 정보'와 '국가별 기본 데이터'를 바탕으로, 지금부터 여행 시작일(${startDate})까지의 환율 변동을 예측하고, 이를 기반으로 사용자에게 가장 합리적인 여행지 3곳을 최종 추천하는 JSON을 생성해 주세요.

    # 사용자 정보
    - 조회 시점 (오늘 날짜): ${today}
    - 여행 기간: ${startDate} 부터 ${endDate} 까지 (총 ${durationDays}일)
    - 총 예산: ${budget}원(KRW)
    - 1인당 예산: ${(budget / people).toLocaleString()}원 (KRW)
    - 인원: ${people}명

    # 국가별 기본 데이터
    ${contextDataString}

    # 과업 수행 절차 (Internal Process)
    최종 JSON을 출력하기 전에, 당신은 내부적으로 다음 2가지 핵심 분석을 반드시 수행해야 합니다.

    ## 1단계: 환율 전망 분석 (내부적 사고)
    - **분석 규칙**: 각 국가의 중앙은행(예: 일본은행, 미국 연준) 통화정책, 인플레이션 전망, 주요 경제 지표 등을 종합적으로 고려하여 ${startDate} 시점의 환율 변동 핵심 원인을 분석합니다. ${today}와 ${startDate}가 같을 경우 '예상 환율(forecasted_exchange_rate)'에는 변동이 없어야 합니다.
    - **결과 도출**: 이 분석을 통해 각 국가별로 '예상 환율(forecasted_exchange_rate)' 값과 '환율 예측 근거(economic_reasoning)' 문장을 내부적으로 도출합니다.

    ## 2단계: 여행 경비 추정 및 추천 논리 생성 (내부적 사고)
    - **경비 추정**:
        1.  **1인당 평균 왕복 항공권 비용**: ${startDate} ~ ${endDate} 기간의 일반적인 비용을 추정합니다.
        2.  **1박당 평균 숙소 비용**: 3성급 호텔 또는 에어비앤비 수준으로 추정합니다.
        3.  **1인당 일일 예상 경비**: 기본 100,000원을 기준으로 각 국가의 물가를 고려하여 조정합니다.
    - **예상 경비 계산**:
        - 위 추정치를 바탕으로 1인당 총 예상 경비의 범위('per_cost_range')를 계산합니다.
        - (계산식: (항공권) + (숙소비 * (${durationDays}-1)) + (일일 경비 * ${durationDays}), 약 15% 변동폭 적용)
        - (출력 형식 예: "1,200,000 ~ 1,400,000")
    - **추천 이유(reason) 생성 (가장 중요한 단계):**
        - **(A) 경제적 배경 인용:** [1단계: 환율 전망 분석]에서 당신이 내부적으로 도출한 국가별 '환율 예측 근거(economic_reasoning)'를 문장의 핵심 시작점으로 사용합니다.
        - **(B) 예산 적합성 연결:** (A)의 내용에 이어, [2단계: 예상 경비 계산]에서 도출한 'per_cost_range'가 사용자의 예산에 얼마나 적합한지를 자연스럽게 연결하여 설명합니다.
        - **(C) 최종 문장 생성:** 위 두 요소를 결합하여, 전문가의 분석이 담긴 설득력 있는 문장을 완성합니다. 두 요소간에 줄바꿈을 해줍니다.
            - (좋은 예시): "일본은행의 지속적인 금융완화 정책으로 엔화 약세가 전망되어 환율이 매우 유리하며, 예상 경비 또한 예산 범위 내에 있어 경제적인 선택입니다."
            - (나쁜 예시): "전반적으로 물가가 저렴하고 예상 경비가 예산보다 낮아 추천합니다." (-> 1단계 전문가 분석이 반영되지 않음)

    - **순위 결정**: 환율의 유리함(1단계 분석 결과)과 예산 효율성(2단계 분석 결과)을 종합적으로 고려하여 가장 가치 있는 여행지 순서대로 1, 2, 3위를 선정합니다.

    # 최종 출력 형식 (다른 설명 없이 반드시 아래 JSON 형식으로만 답변)
    {
      "recommendations": [
        {"rank": 1, "country": "추천 국가명", "current_rate": "입력 데이터의 current_exchange_rate", "reason": "[2단계 (C)]에서 생성된 추천 이유", "forecasted_exchange_rate": "[1단계]에서 분석된 예상 환율 (current_rate 형식과 동일하게)", "per_cost_range": "[2단계]에서 계산된 1인당 총 예상 경비", "trend": "입력 데이터의 exchange_rate_trend_6m_avg"},
        {"rank": 2, "country": "추천 국가명", "current_rate": "입력 데이터의 current_exchange_rate", "reason": "[2단계 (C)]에서 생성된 추천 이유", "forecasted_exchange_rate": "[1단계]에서 분석된 예상 환율 (current_rate 형식과 동일하게)", "per_cost_range": "[2단계]에서 계산된 1인당 총 예상 경비", "trend": "입력 데이터의 exchange_rate_trend_6m_avg"},
        {"rank": 3, "country": "추천 국가명", "current_rate": "입력 데이터의 current_exchange_rate", "reason": "[2단계 (C)]에서 생성된 추천 이유", "forecasted_exchange_rate": "[1단계]에서 분석된 예상 환율 (current_rate 형식과 동일하게)", "per_cost_range": "[2단계]에서 계산된 1인당 총 예상 경비", "trend": "입력 데이터의 exchange_rate_trend_6m_avg"}
      ]
    }
  `;

  // 2단계 실행: 최종 JSON 결과 생성
  const result = await model.generateContent(RecommendPrompt);
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

// 환률 api
const EXCHANGE_API_KEY = process.env.EXCHANGE_API_KEY;
const EXCHANGE_API_URL = process.env.EXCHANGE_API_URL;

export async function fetchExchangeRate(searchDate) {
  while (1) {
    let targetDate = new Date(
      searchDate.substring(0, 4),
      searchDate.substring(4, 6) - 1,
      searchDate.substring(6, 8)
    );

    const url = `${EXCHANGE_API_URL}?authkey=${EXCHANGE_API_KEY}&searchdate=${searchDate}&data=AP01`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.length === 0 || data.errCd) {
        console.warn(
          `[${searchDate}] 데이터 없음:`,
          data.errMsg ||
            "데이터가 비어있습니다. 그 당시 전일 데이터를 불러옵니다"
        );
        targetDate.setDate(targetDate.getDate() - 1);
        searchDate = formatDateToYYYYMMDD(targetDate);
      } else return data;
    } catch (error) {
      console.error(`API 호출 중 오류 발생 (${searchDate}):`, error);
      return null;
    }
  }
}

// 날짜 포멧팅 함수

export function formatDateToYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

// 30일 단위로 휴일제외한 날짜

export function subtractBusinessDays(startDate, daysToSubtract) {
  const businessDays = [];
  const date = new Date(startDate.getTime());
  let businessDaysCount = daysToSubtract;

  while (businessDaysCount > 0) {
    const dayOfWeek = date.getDay(); // 0: 일, 6: 토
    const isBusinessDay = dayOfWeek !== 0 && dayOfWeek !== 6;

    if (isBusinessDay) {
      businessDays.push(formatDateToYYYYMMDD(date));
      businessDaysCount--;
      date.setMonth(date.getMonth() - 1);
    } else date.setDate(date.getDate() - 1);
  }
  return businessDays.reverse();
}
