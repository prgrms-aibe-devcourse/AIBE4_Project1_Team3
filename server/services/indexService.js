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

  const anlysisProimprt = `
    # 역할
      당신은 글로벌 거시 경제 및 외환 시장 분석 전문가입니다. 당신의 임무는 주어진 데이터를 바탕으로 각 국가의 미래 환율 동향을 예측하고, 그 경제적 배경을 명확하게 설명하는 것입니다.

      # 임무
      아래에 제공된 국가별 데이터와 당신의 전문 지식 및 실시간 검색 능력을 활용하여, 각 국가의 원화(KRW) 대비 환율이 여행 시작 시점(${startDate})에 어떻게 변동할지 예측하고, 그 핵심 근거를 분석해 주세요.

      # 분석 대상 국가 데이터
      ${contextDataString}

      # 분석 규칙
      1.  **거시 경제 분석**: 각 국가의 중앙은행(예: 일본은행, 미국 연준) 통화정책, 인플레이션 전망, 주요 경제 지표 등을 종합적으로 고려하여 환율 변동의 핵심 원인을 분석합니다.
      2.  **전망 요약**: 분석 결과를 바탕으로, 각 국가별로 아래 형식에 맞춰 환율 전망과 그 근거를 간결한 문장으로 요약해 주세요.

      # 출력 형식 (반드시 아래와 같은 Markdown 형식으로만 답변)
      - **[국가명 1]**: [미래 시점의 예상 환율(current_rate 형식과 동일하게)] | [경제 상황에 기반한 구체적인 환율 예측 근거]
      - **[국가명 2]**: [미래 시점의 예상 환율(current_rate 형식과 동일하게)] | [경제 상황에 기반한 구체적인 환율 예측 근거]
      - **[국가명 3]**: [미래 시점의 예상 환율(current_rate 형식과 동일하게)] | [경제 상황에 기반한 구체적인 환율 예측 근거]
      ... (모든 후보 국가에 대해 반복) ...  
  `;

  // 1단계 실행: 환율 분석 결과 생성
  const analysisResult = await model.generateContent(anlysisProimprt);
  const analysisResponse = await analysisResult.response;
  const exchangeRateAnalysis = await analysisResponse.text();

  // --- 2단계: 최종 추천 JSON 생성 프롬프트 ---
  const recommendationPrompt = `
    # 역할
    당신은 데이터 기반의 여행지 추천 전문가입니다. 당신의 임무는 주어진 사용자 정보와 전문가의 환율 분석 데이터를 종합하여, 최종 여행지를 JSON 형식으로 추천하는 것입니다.

    # 임무
    아래에 제공된 '사용자 정보', '국가별 기본 데이터', 그리고 '외환 전문가의 환율 전망 분석' 내용을 종합하여, 사용자에게 가장 합리적인 여행지 3곳을 최종 추천해 주세요.

    # 사용자 정보
    - 조회 시점 (오늘 날짜): ${today}
    - 여행 기간: ${startDate} 부터 ${endDate} 까지
    - 총 예산: ${budget}원(KRW)
    - 1인당 예산: ${(budget / people).toLocaleString()}원 (KRW)
    - 인원: ${people}명

    # 국가별 기본 데이터
    ${contextDataString}

    # 외환 전문가의 환율 전망 분석
    ${exchangeRateAnalysis}

    # 추가 과업: 여행 경비 추정
    1.  **1인당 평균 왕복 항공권 비용**: ${startDate} ~ ${endDate} 기간의 일반적인 비용을 추정하세요.
    2.  **1박당 평균 숙소 비용**: 3성급 호텔 또는 에어비앤비 수준으로 추정하세요.
    3.  **1인당 일일 예상 경비**: 기본 100,000원을 기준으로 각 국가의 물가를 고려하여 조정하세요.

    # 최종 추천 논리
    1.  **예상 경비 계산**: '# 추가 과업'을 바탕으로 1인당 총 예상 경비의 범위('per_cost_range')를 계산합니다. (계산식: (항공권) + (숙소비 * (${durationDays}-1)) + (일일 경비 * ${durationDays}), 약 15% 변동폭 적용)
        - 출력은 120,000 ~ 140,000과 같이 작성합니다.
    
    2.  **추천 이유(reason) 생성 (가장 중요한 단계):**
        - **1단계 (경제적 배경 인용):** '# [중요] 외환 전문가의 환율 전망 분석' 섹션에 있는 국가별 '예측 근거'를 문장의 핵심 시작점으로 삼아야 합니다. 이 부분이 '왜' 환율이 유리한지에 대한 거시 경제적 설명입니다.
        - **2단계 (예산 적합성 연결):** 1단계에서 계산한 'per_cost_range'가 사용자의 예산에 얼마나 적합한지를 자연스럽게 연결하여 설명합니다.
        - **3단계 (최종 문장 생성):** 위 두 요소를 결합하여, 전문가의 분석이 담긴 설득력 있는 문장을 완성합니다.

        - **(✅ 좋은 예시):** "일본은행의 지속적인 금융완화 정책으로 엔화 약세가 전망되어 환율이 매우 유리하며, 예상 경비 또한 예산 범위 내에 있어 경제적인 선택입니다."
        - **(❌ 나쁜 예시):** "전반적으로 물가가 저렴하고 예상 경비가 예산보다 낮아 추천합니다." (-> 전문가 분석이 전혀 반영되지 않음)

    3.  **순위 결정**: 환율의 유리함(전망)과 예산 효율성을 종합적으로 고려하여 가장 가치 있는 여행지 순서대로 1, 2, 3위를 선정합니다.

    # 출력 형식 (다른 설명 없이 반드시 아래 JSON 형식으로만 답변)
    {
      "recommendations": [
        {"rank": 1, "country": "추천 국가명", "current_rate": "입력 데이터의 current_exchange_rate", "reason": "생성된 추천 이유", "forecasted_exchange_rate": "분석된 예상 환율", "per_cost_range": "계산된 1인당 총 예상 경비", "trend": "입력 데이터의 exchange_rate_trend_6m_avg"},
        {"rank": 2, "country": "추천 국가명", "current_rate": "입력 데이터의 current_exchange_rate", "reason": "생성된 추천 이유", "forecasted_exchange_rate": "분석된 예상 환율", "per_cost_range": "계산된 1인당 총 예상 경비", "trend": "입력 데이터의 exchange_rate_trend_6m_avg"},
        {"rank": 3, "country": "추천 국가명", "current_rate": "입력 데이터의 current_exchange_rate", "reason": "생성된 추천 이유", "forecasted_exchange_rate": "분석된 예상 환율", "per_cost_range": "계산된 1인당 총 예상 경비", "trend": "입력 데이터의 exchange_rate_trend_6m_avg"}
      ]
    }
  `;

  // 2단계 실행: 최종 JSON 결과 생성
  const result = await model.generateContent(recommendationPrompt);
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
