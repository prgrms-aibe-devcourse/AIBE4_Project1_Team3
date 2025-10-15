import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

import {
  parseJSON,
  ensureReasons,
  normalizeCosts,
} from "../services/recommendService.js";

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

console.log(
  "GEMINI_API_KEY:",
  process.env.GEMINI_API_KEY ? "Loaded" : "Not found"
);

router.post("/ai/itinerary", async (req, res) => {
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
    } catch (firstError) {
      console.log(
        "gemini-2.0-flash-001 실패, fallback 시도:",
        firstError.message
      );
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
      } catch (secondError) {
        console.error("모든 Gemini 모델 실패:", secondError);
        return res.status(502).json({
          error: "AI 서비스 연결 실패",
          details: secondError.message,
        });
      }
    }

    // Gemini API 응답 구조 파싱
    let text;
    try {
      // @google/genai의 GenerateContentResponse 구조 확인
      if (typeof response?.text === "function") {
        text = response.text();
      } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        // 실제 응답 구조
        text = response.candidates[0].content.parts[0].text;
      } else {
        console.error(
          "예상치 못한 응답 구조:",
          JSON.stringify(response, null, 2)
        );
        return res
          .status(502)
          .json({ error: "AI 응답 구조가 예상과 다릅니다." });
      }
    } catch (textError) {
      console.error("text() 호출 오류:", textError);
      return res
        .status(502)
        .json({ error: "AI 응답 파싱 실패", details: textError.message });
    }

    if (!text) {
      return res.status(502).json({ error: "AI 응답이 비어 있습니다." });
    }

    console.log("AI 응답 텍스트:", text);
    // console.log("AI 응답 텍스트 (처음 200자):", text.substring(0, 200));

    const json = parseJSON(text);
    if (!json || !Array.isArray(json.dayPlans)) {
      console.error("JSON 파싱 실패. 원본 텍스트:", text);
      return res.status(400).json({ error: "AI 응답 파싱 실패", raw: text });
    }

    const budgetNum = Number(String(budget).replace(/[^\d]/g, "")) || 0;
    const withReasons = ensureReasons(json);
    const normalized = normalizeCosts(withReasons, budgetNum, days);
    res.json(normalized);
  } catch (err) {
    console.error("/ai/itinerary 오류:", err);
    res.status(500).json({ error: "서버 내부 오류", details: err.message });
  }
});

export default router;
