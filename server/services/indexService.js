const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

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
