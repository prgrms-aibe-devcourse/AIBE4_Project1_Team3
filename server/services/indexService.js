const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const EXCHANGE_API_KEY = process.env.EXCHANGE_API_KEY;
const EXCHANGE_API_URL = process.env.EXCHANGE_API_URL;

async function recommend({ startDate, endDate, budget, people }) {
  const prompt = `
      당신은 여행 전문가입니다. 아래 조건에 맞는 여행지를 추천해주세요.

      - 여행 기간: ${startDate} 부터 ${endDate} 까지
      - 총 예산: ${budget}원
      - 인원: ${people}명

      가장 중요한 추천 기준은 '해당 여행 기간의 미래 예측 환율'입니다.
      주어진 예산으로 가장 가치 있는 소비를 할 수 있는, 즉 환율이 유리할 것으로 예상되는 나라 순서대로 1, 2, 3위를 추천해주세요.

      답변은 반드시 아래와 같은 JSON 형식으로만 제공해주세요. 다른 설명은 붙이지 마세요.

      {
        "recommendations": [
          {"rank": 1, "country": "추천 국가명", "current_rate": "해당 나라의 현재 환율", "future_rate": "여행 출발 날짜의 예측 환율"},
          {"rank": 2, "country": "추천 국가명", "current_rate": "해당 나라의 현재 환율", "future_rate": "여행 출발 날짜의 예측 환율"},
          {"rank": 3, "country": "추천 국가명", "current_rate": "해당 나라의 현재 환율", "future_rate": "여행 출발 날짜의 예측 환율"}
        ]
      }
    `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text();

  return text;
}

// 환률 api

async function fetchExchangeRate(searchDate) {
  const url = `${EXCHANGE_API_URL}?authkey=${EXCHANGE_API_KEY}&searchdate=${searchDate}&data=AP01`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.length === 0 || data.errCd) {
      console.warn(
        `[${searchDate}] 데이터 없음:`,
        data.errMsg || "데이터가 비어있습니다."
      );
      return null;
    }
    return data;
  } catch (error) {
    console.error(`API 호출 중 오류 발생 (${searchDate}):`, error);
    return null;
  }
}

// 날짜 포멧팅 함수

function formatDateToYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

// 30일 단위로 휴일제외한 날짜

function subtractBusinessDays(startDate, daysToSubtract) {
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
  return businessDays;
}

module.exports = {
  recommend,
  fetchExchangeRate,
  subtractBusinessDays,
};
