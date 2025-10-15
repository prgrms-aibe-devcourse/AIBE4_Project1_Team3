import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const candidateCountries = [
  { name: "중국", currency: "CNH" },
  { name: "프랑스", currency: "EUR" },
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

  const contextDataForPrompt = candidateCountries.map((country) => {
    const rates = exchangeRatesData[country.currency];
    const unit = currencyUnitMap[country.currency] || 1;
    const trend = analyzeRateTrend(rates.current, rates.historical);

    const currentExchangeRateDisplay = `${rates.current.toFixed(
      2
    )} KRW / ${unit} ${country.currency}`;

    return {
      name: country.name,
      currency: country.currency,
      current_exchange_rate: currentExchangeRateDisplay,
      exchange_rate_trend_6m_avg: trend,
    };
  });

  const contextDataString = JSON.stringify(contextDataForPrompt, null, 2);

  const prompt = `
      # 역할
      당신은 데이터 기반의 여행지 추천 전문가입니다. 당신의 임무는 사용자의 조건과 최신 경제 지표를 종합적으로 분석하여 최고의 가치를 제공하는 여행지를 추천하는 것입니다.

      # 임무
      사용자 요청과 아래 국가별 경제 데이터를 종합하여, 사용자에게 가장 적합한 여행 국가 3곳을 추천하고 그 이유를 간략히 설명해 주세요.

      # 제한 조건
      당신은 반드시 아래에 제공된 국가 데이터만 고려해야 합니다.
      candidateCountries 배열에 없는 국가는 어떤 이유로든 추천하지 마세요.

      # 사용자 정보
      - 여행 기간: ${startDate} 부터 ${endDate} 까지
      - 총 예산: ${budget}원(KRW)
      - 인원: ${people}명
      - 기준 통화: KRW

      # 국가별 환율 및 지표
      ${contextDataString}

      # 추가 과업: 여행 경비 추정
      주어진 환율 데이터 외에, 당신의 지식 기반을 활용하여 아래 항목을 추정해주세요.
      1.  **1인당 평균 왕복 항공권 비용**: ${startDate} ~ ${endDate} 기간의 일반적인 비용을 추정하세요.
      2.  **1박당 평균 숙소 비용**: 해당 국가의 에어비앤비 수준의 비용을 추정하세요.
      3.  **1인당 일일 예상 경비**: 식비, 교통비, 관광비 등을 포함하여 약 100,000원을 기준으로 하되, 각 국가의 물가를 고려하여 적절히 조정하세요.

      # 수행 규칙 및 논리
      1.  'exchange_rate_trend_6m_avg' 항목을 핵심적으로 분석하세요. 환율이 여행자에게 유리할수록 높은 점수를 부여하세요.
      2.  과거 6개월의 환율 데이터를 이용해, 단순 선형 추세를 기반으로 다음 달 예상 환율을 추정하여 'forcasted_exchange_rate' 항목에 반영하세요.
      3.  위 '# 추가 과업'에서 추정한 비용들을 바탕으로 **1인당 총 예상 경비('per_cost')**를 계산하세요.
          -   **계산식: (추정 항공권 비용) + (추정 1박 숙소 비용 * ${durationDays}-1) + (조정된 일일 경비 * ${durationDays})**
      4.  계산된 'per_cost'가 사용자의 1인당 예산(${
        budget / people
      }원) 내에 들어오는지 확인하여 '예산 효율성'을 평가하세요.
      5.  최종적으로 '예상 환율(유리함)', '예산 효율성'을 종합하여 가장 합리적인 상위 3개국을 추천하세요

      # 출력 형식
      답변은 반드시 아래와 같은 JSON 형식으로만 제공해주세요. 다른 설명은 붙이지 마세요.
      {
        "recommendations": [
          {"rank": 1, "country": "추천 국가명", "current_rate": "입력 데이터에서 가져온 current_exchange_rate", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forecasted_exchange_rate": "예상 환율", "per_cost": "계산된 1인당 총 예상 경비"},
          {"rank": 2, "country": "추천 국가명", "current_rate": "입력 데이터에서 가져온 current_exchange_rate", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forecasted_exchange_rate": "예상 환율", "per_cost": "계산된 1인당 총 예상 경비"},
          {"rank": 3, "country": "추천 국가명", "current_rate": "입력 데이터에서 가져온 current_exchange_rate", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forecasted_exchange_rate": "예상 환율", "per_cost": "계산된 1인당 총 예상 경비"}
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
