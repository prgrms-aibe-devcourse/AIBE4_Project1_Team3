const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

async function recommend({ startDate, endDate, budget, people }) {
  const prompt = `
      # 역할
      당신은 데이터 기반의 여행지 추천 전문가입니다. 당신의 임무는 사용자의 조건과 최신 경제 지표를 종합적으로 분석하여 최고의 가치를 제공하는 여행지를 추천하는 것입니다.

      # 임무
      주어진 데이터를 바탕으로 사용자의 여행 기간, 예산, 인원 수에 가장 적합한 여행 국가 3곳을 추천하고, 그 이유를 설명해 주세요. 설명은 간략하지만 쉽게 이해할 수 있게 해주세요. 추천 시에는 특히 환율 변동 추세를 중요하게 고려해야 합니다.

      # 사용자 요청 정보
      - 여행 기간: ${startDate} 부터 ${endDate} 까지
      - 총 예산: ${budget}원(KRW)
      - 인원: ${people}명
      - 기준 통화: KRW

      가장 중요한 추천 기준은 '해당 여행 기간의 미래 예측 환율'입니다.
      주어진 예산으로 가장 가치 있는 소비를 할 수 있는, 즉 환율이 유리할 것으로 예상되는 나라 순서대로 1, 2, 3위를 추천해주세요.

      답변은 반드시 아래와 같은 JSON 형식으로만 제공해주세요. 다른 설명은 붙이지 마세요.
      {
        "recommendations": [
          {"rank": 1, "country": "추천 국가명", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forcasted_exchange_rate": "예측되는 환율"},
          {"rank": 2, "country": "추천 국가명", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forcasted_exchange_rate": "예측되는 환율"},
          {"rank": 3, "country": "추천 국가명", "reason": "이 국가를 추천하는 상세한 이유(예산 및 환율 관점 포함)", "forcasted_exchange_rate": "예측되는 환율"}
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
