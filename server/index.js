import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = 3000;

app.use(express.static(path.resolve(__dirname, "../src")));
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

console.log(
  "GEMINI_API_KEY:",
  process.env.GEMINI_API_KEY ? "Loaded" : "Not found"
);

const pickJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
};

function normalizeCosts(itinerary, totalBudget, days) {
  const dayBudget = Math.max(
    60000,
    Math.floor(totalBudget / Math.max(1, days))
  );
  const weightSets = {
    1: [1],
    2: [0.55, 0.45],
    3: [0.4, 0.35, 0.25],
    4: [0.35, 0.3, 0.2, 0.15],
    5: [0.3, 0.25, 0.2, 0.15, 0.1],
  };
  const minPerStop = 3000;
  const maxPerStop = 180000;

  itinerary.dayPlans = (itinerary.dayPlans || []).map((d) => {
    const stops = Array.isArray(d.stops) ? d.stops : [];
    const weights = weightSets[Math.min(5, Math.max(1, stops.length))] || [];
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;

    const tuned = stops.map((s, i) => {
      let base = Math.round(
        ((weights[i] || 1 / stops.length) / sumW) * dayBudget
      );
      let name = String(s.placeName || "").toLowerCase();
      if (name.includes("유니버설")) base = Math.max(base, 120000);
      if (name.includes("성") || name.includes("타워"))
        base = Math.max(base, 8000);
      if (name.includes("시장") || name.includes("거리"))
        base = Math.max(base, 7000);
      const clamped = Math.min(maxPerStop, Math.max(minPerStop, base));
      return { ...s, estimatedCost: Math.round(clamped / 100) * 100 };
    });

    const currentSum = tuned.reduce(
      (sum, s) => sum + (Number(s.estimatedCost) || 0),
      0
    );
    const scale = currentSum > 0 ? dayBudget / currentSum : 1;

    const scaled = tuned.map((s) => ({
      ...s,
      estimatedCost:
        Math.round(
          Math.min(maxPerStop, Math.max(minPerStop, s.estimatedCost * scale)) /
            100
        ) * 100,
    }));

    return {
      ...d,
      stops: scaled,
      dayCostKRW: scaled.reduce((a, b) => a + b.estimatedCost, 0),
    };
  });

  itinerary.totalCostKRW = itinerary.dayPlans.reduce(
    (a, d) => a + (d.dayCostKRW || 0),
    0
  );
  return itinerary;
}

function ensureReasons(itinerary) {
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
    return { ...d, stops };
  });
  return itinerary;
}

app.post("/ai/itinerary", async (req, res) => {
  const { city, startDate, endDate, people, budget } = req.body;
  const s = new Date(startDate);
  const e = new Date(endDate);
  const days = Math.max(1, Math.round((e - s) / 86400000) + 1);

  const prompt = `
  너는 전문 여행 플래너이자 관광 심리 분석가다.
  사용자에게 "${city}" 도시의 ${days}일 여행 일정을 추천해야 한다.
  여행 인원은 ${people}명이고, 전체 예산은 약 ${budget}원이다.
  
  규칙:
  1. 반드시 "${city}" 도시 내부에서만 장소를 추천한다.
  2. 하루에 3~5개의 장소를 추천하되, 이동 동선을 고려해 자연스럽게 이어지게 한다.
  3. 각 장소에는 반드시 아래 항목을 포함한다.
     - placeName: 장소명
     - summary: 짧은 설명 (50자 이내)
     - reason: 추천 이유 (관광객, 현지 분위기, 접근성 등 현실적 이유)
     - costReason: 비용의 구체적 근거 (예: 입장료, 식사비, 체험비 등)
     - estimatedCost: 해당 비용 (원화 기준, 정수)
     - lat, lng: 위도, 경도
  4. 하루 단위로 dayReason을 작성하라.
     - dayReason은 "오늘은 어떤 분위기와 테마의 일정인지"를 서술해야 한다.
     - 각 Day마다 반드시 서로 다른 표현으로 작성하라.
       예: ‘현지인의 일상 체험’, ‘사진 명소 위주 일정’, ‘가족 여행자에게 적합한 코스’ 등
  5. 전체 예산의 ±10% 범위 안에서 각 날짜별 총합이 자연스럽게 분배되도록 한다.
  6. 결과는 반드시 JSON 형식으로 반환하고, 불필요한 문장은 절대 포함하지 않는다.
  
  출력 예시(JSON):
  {
    "city": "${city}",
    "dayPlans": [
      {
        "day": 1,
        "title": "테마 이름",
        "dayReason": "이 날의 추천 이유 (각기 다름)",
        "stops": [
          {
            "placeName": "장소명",
            "summary": "짧은 설명",
            "reason": "추천 이유 (예: 관광객이 많고 도보로 접근 가능)",
            "costReason": "입장료와 음료 포함 가격",
            "estimatedCost": 12000,
            "lat": 0.0,
            "lng": 0.0
          }
        ]
      }
    ]
  }
  `.trim();

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: prompt,
      });
    } catch {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
    }

    const text = response.text;
    const json = pickJSON(text);
    if (!json || !Array.isArray(json.dayPlans))
      return res.status(400).json({ error: "AI 응답 파싱 실패", raw: text });

    const budgetNum = Number(String(budget).replace(/[^\d]/g, "")) || 0;
    const withReasons = ensureReasons(json);
    const normalized = normalizeCosts(withReasons, budgetNum, days);
    res.json(normalized);
  } catch (err) {
    console.error("/ai/itinerary 오류:", err);
    res.status(500).json({ error: "서버 내부 오류", details: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`http://localhost:${PORT}/recommend.html`);
});
