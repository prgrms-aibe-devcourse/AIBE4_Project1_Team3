import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

import {
  parseJSON,
  ensureReasons,
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

  const budgetNum = Number(String(budget).replace(/[^\d]/g, "")) || 0;
  const peopleNum = parseInt(people, 10) || 1;
  const budgetPerPerson = Math.round(budgetNum / peopleNum);
  const fx = 9.5; 

  const prompt = `
      너는 전문 여행 플래너이자 관광 심리 분석가다.
      사용자에게 "${city}" 도시의 ${days}일 여행 일정을 추천해야 한다.
      이번 계획은 "1인 기준 예산"으로 작성하며, 총 예산(1인)은 약 ${budgetPerPerson}원이다.
      환율은 1엔=${fx}원(고정)으로 계산한다.
      호텔 조식은 뺀다.

      규칙(핵심):
      1) 아침밥, 점심밥, 저녁밥을 꼭 포함한다. 첫날은 공항에서 도착후 시내이동, 저녁밥 먹기로 시작한다.
      2) 마지막날은 남은돈을 면세점에서 모두 털어서 사용한다.

      1) 도시 제한: 반드시 "${city}" 내부에서만 추천한다.
      2) 스톱 수: 하루 5~8개(이동 동선 자연스럽게). Day 1부터 Day ${days}까지 모든 날짜를 포함해야 한다.
        - Day 1: "공항 도착(airport)→시내 이동(transfer)→관광/식사→프리미엄 저녁"
        - Day ${days}: "오전 관광/쇼핑→프리미엄 식사(점심 또는 저녁)→시내→공항(transfer)→공항 체크인(airport)"
        - 중간 날짜들(Day 2 ~ Day ${days - 1}): 각 날마다 3~5개의 관광/식사/쇼핑 일정 포함
      3) 식사/쇼핑 철학(1인 기준):
        - 매일 쇼핑 또는 대형 상업시설 1곳 이상 포함(백화점/아울렛/상점가/드럭스토어/전자상가 등).
        - 전체 일정에서 "프리미엄(비싼) 식사" 최소 2회 이상(가능하면 Day 1 & Day ${days} 포함).
        - "must-visit" 필수 방문지 최소 3곳(랜드마크, 대표 맛집, 대표 쇼핑 허브 등).
        - **최소 비용 기준(1인)**: 일반 식사(아침/점심) 최소 8,000원, 저녁 식사 최소 15,000원, 프리미엄 식사 최소 30,000원, 관광지 입장료 최소 10,000원, 쇼핑 최소 20,000원.
      4) 정보 필수 항목(모든 스톱):
        - placeName, summary(50자 이내), reason(현실적 근거), costReason, estimatedCost(정수 KRW, 1인 기준),
          lat, lng(실좌표), tags(예: ["shopping","premium-dinner","must-visit","landmark","local-food"])
      5) dayReason: 각 날짜 테마/분위기를 서로 다르게(중복 표현 금지).
      6) 예산 분배(1인 기준):
        - 전체 합계(overallTotal) ∈ [${Math.round(budgetPerPerson * 0.95)}, ${Math.round(budgetPerPerson * 1.05)}] (반드시 95~100% 소진, 절대 90% 미만 금지)
        - 일평균 목표: ${Math.round(budgetPerPerson / days)}원 ±10%
        - 비용 산정은 JPY 단가 → KRW 환산(정수 반올림). 예: Y = round(X엔 × ${fx})원
        - costReason 형식(1인 기준): "단가(엔) × 수량 = X엔 → 1엔=${fx}원 → Y원(1인)"
        - **중요**: 위의 최소 비용 기준을 반드시 준수하고, 각 항목의 실제 비용은 최소 기준의 1.5~2배 수준으로 설정하여 예산을 충분히 활용한다.
      7) 좌표 신뢰성: 바다/무효 좌표 금지, 실존 장소 좌표만.
      8) 중복 금지: 동일 장소 반복 금지(지점이 다르면 허용 가능).
      9) 출력 형식: **유효한 JSON만 반환**(설명/마크다운/코드블록 금지). 모든 합계는 정수이며 정확히 일치.
      10) **중요**: dayPlans 배열에는 정확히 ${days}개의 day 객체가 포함되어야 한다. (day: 1부터 day: ${days}까지)

      카테고리/타임슬롯(권장):
      - category: "airport" | "transfer" | "breakfast" | "lunch" | "snack" | "cafe" | "dinner" | "sightseeing" | "shopping" | "activity" | "nightlife"
      - timeSlot: "morning" | "late_morning" | "afternoon" | "tea" | "evening" | "night"

      출력 스키마(JSON만):
      {
        "city": "${city}",
        "fxKRWPerJPY": ${fx},
        "budgetModel": "per_person",
        "days": ${days},
        "meta": {
          "budgetPerPersonKRW": ${budgetPerPerson},
          "targetOverallSpendRangeKRW": [${Math.round(budgetPerPerson * 0.99)}, ${budgetPerPerson}],
          "targetDailyAvgKRW": ${Math.round(budgetPerPerson / days)},
          "notes": "매일 쇼핑/대형상업시설 1곳 이상, 프리미엄 식사 2회 이상, Day 1/마지막 날 공항 동선 포함"
        },
        "dayPlans": [
          {
            "day": 1,
            "title": "오사카의 새로운 첫걸음!",
            "dayReason": "비행 피로 고려, 접근성 좋은 명소와 프리미엄 저녁으로 여행 시작을 기분 좋게.",
            "stops": [],
            "dayTotal": 0
          },
          // Day 2부터 Day ${days - 1}까지의 일정도 모두 포함
          {
            "day": ${days},
            "title": "여행지의 꽃 마지막 쇼핑·프리미엄 식사·귀국",
            "dayReason": "오전 가벼운 관람/쇼핑 후 프리미엄 식사, 여유 있는 공항 이동.",
            "stops": [],
            "dayTotal": 0
          }
        ],
        "overallTotal": 0
      }

      Stop 스키마(예시, 모든 필드 필수):
      {
        "placeName": "정확 한국어 표기",
        "summary": "50자 이내 요약",
        "reason": "100~150자: 왜 가는지(맛/리뷰/접근성/대표성/가성비)",
        "costReason": "단가(엔) × 수량 = X엔 → 1엔=${fx}원 → Y원(1인)",
        "estimatedCost": 50000,
        "lat": 35.0000,
        "lng": 2,000,000,
        "tags": ["must-visit","shopping"]
      }

      검증 체크리스트:
      - dayPlans 배열 길이 = ${days} (모든 날짜 포함)
      - dayTotal = 해당 day의 estimatedCost 합(정확히 일치), overallTotal = 모든 dayTotal 합
      - overallTotal ∈ [${Math.round(budgetPerPerson * 0.95)}, ${budgetPerPerson}] (반드시 95~100%, 절대 90% 미만 금지)
      - Day 1/마지막 날: 공항/이동/프리미엄 식사 포함
      - 매일 shopping/activity/nightlife ≥ 1
      - must-visit ≥ 3, 프리미엄 식사 ≥ 2
      - 좌표 실존/정확
      - 모든 항목이 최소 비용 기준(일반 식사 8,000원, 저녁 15,000원, 프리미엄 30,000원, 관광 10,000원, 쇼핑 20,000원)을 충족하는지 확인
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

    let text;
    try {
      if (typeof response?.text === "function") {
        text = response.text();
      } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
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

    const json = parseJSON(text);
    if (!json || !Array.isArray(json.dayPlans)) {
      console.error("JSON 파싱 실패. 원본 텍스트:", text);
      return res.status(400).json({ error: "AI 응답 파싱 실패", raw: text });
    }

    console.log(`생성된 일정 일수: ${json.dayPlans?.length || 0}, 요청 일수: ${days}`);

    const withReasons = ensureReasons(json);
    res.json(withReasons);
  } catch (err) {
    console.error("/ai/itinerary 오류:", err);
    res.status(500).json({ error: "서버 내부 오류", details: err.message });
  }
});

export default router;
