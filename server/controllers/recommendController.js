import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

import {
  parseJSON,
  ensureReasons,
  fetchRealTimeWeather,
} from "../services/recommendService.js";

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

console.log(
  "GEMINI_API_KEY:",
  process.env.GEMINI_API_KEY ? "Loaded" : "Not found"
);

// 도시 기반 통화 및 환율 감지 함수
function getCurrencyInfo(city) {
  const cityLower = city.toLowerCase();

  // 일본
  if (cityLower.includes('도쿄') || cityLower.includes('오사카') || cityLower.includes('교토') ||
      cityLower.includes('후쿠오카') || cityLower.includes('삿포로') || cityLower.includes('나고야') ||
      cityLower.includes('tokyo') || cityLower.includes('osaka') || cityLower.includes('kyoto') ||
      cityLower.includes('fukuoka') || cityLower.includes('sapporo') || cityLower.includes('nagoya')) {
    return { currency: '엔', currencyCode: 'JPY', symbol: '¥', rate: 9.5 };
  }

  // 미국
  if (cityLower.includes('뉴욕') || cityLower.includes('로스앤젤레스') || cityLower.includes('샌프란시스코') ||
      cityLower.includes('시애틀') || cityLower.includes('시카고') || cityLower.includes('라스베가스') ||
      cityLower.includes('new york') || cityLower.includes('los angeles') || cityLower.includes('san francisco') ||
      cityLower.includes('seattle') || cityLower.includes('chicago') || cityLower.includes('las vegas') ||
      cityLower.includes('la ') || cityLower.includes('nyc') || cityLower.includes('sf')) {
    return { currency: '달러', currencyCode: 'USD', symbol: '$', rate: 1400 };
  }

  // 유럽 (유로존)
  if (cityLower.includes('파리') || cityLower.includes('베를린') || cityLower.includes('로마') ||
      cityLower.includes('바르셀로나') || cityLower.includes('암스테르담') || cityLower.includes('빈') ||
      cityLower.includes('paris') || cityLower.includes('berlin') || cityLower.includes('rome') ||
      cityLower.includes('barcelona') || cityLower.includes('amsterdam') || cityLower.includes('vienna') ||
      cityLower.includes('프랑크푸르트') || cityLower.includes('밀라노') || cityLower.includes('마드리드')) {
    return { currency: '유로', currencyCode: 'EUR', symbol: '€', rate: 1500 };
  }

  // 영국
  if (cityLower.includes('런던') || cityLower.includes('london') || cityLower.includes('맨체스터') ||
      cityLower.includes('manchester') || cityLower.includes('에든버러') || cityLower.includes('edinburgh')) {
    return { currency: '파운드', currencyCode: 'GBP', symbol: '£', rate: 1800 };
  }

  // 중국
  if (cityLower.includes('베이징') || cityLower.includes('상하이') || cityLower.includes('광저우') ||
      cityLower.includes('선전') || cityLower.includes('beijing') || cityLower.includes('shanghai') ||
      cityLower.includes('guangzhou') || cityLower.includes('shenzhen') || cityLower.includes('청두') ||
      cityLower.includes('항저우')) {
    return { currency: '위안', currencyCode: 'CNY', symbol: '¥', rate: 190 };
  }

  // 태국
  if (cityLower.includes('방콕') || cityLower.includes('bangkok') || cityLower.includes('푸켓') ||
      cityLower.includes('phuket') || cityLower.includes('치앙마이') || cityLower.includes('chiang mai')) {
    return { currency: '바트', currencyCode: 'THB', symbol: '฿', rate: 40 };
  }

  // 베트남
  if (cityLower.includes('하노이') || cityLower.includes('호치민') || cityLower.includes('다낭') ||
      cityLower.includes('hanoi') || cityLower.includes('ho chi minh') || cityLower.includes('danang') ||
      cityLower.includes('호이안')) {
    return { currency: '동', currencyCode: 'VND', symbol: '₫', rate: 0.055 };
  }

  // 싱가포르
  if (cityLower.includes('싱가포르') || cityLower.includes('singapore')) {
    return { currency: '싱가포르 달러', currencyCode: 'SGD', symbol: 'S$', rate: 1050 };
  }

  // 홍콩
  if (cityLower.includes('홍콩') || cityLower.includes('hong kong') || cityLower.includes('hk')) {
    return { currency: '홍콩 달러', currencyCode: 'HKD', symbol: 'HK$', rate: 180 };
  }

  // 대만
  if (cityLower.includes('타이베이') || cityLower.includes('taipei') || cityLower.includes('타이중') ||
      cityLower.includes('가오슝') || cityLower.includes('kaohsiung')) {
    return { currency: '대만 달러', currencyCode: 'TWD', symbol: 'NT$', rate: 45 };
  }

  // 호주
  if (cityLower.includes('시드니') || cityLower.includes('멜버른') || cityLower.includes('브리즈번') ||
      cityLower.includes('sydney') || cityLower.includes('melbourne') || cityLower.includes('brisbane')) {
    return { currency: '호주 달러', currencyCode: 'AUD', symbol: 'A$', rate: 950 };
  }

  // 캐나다
  if (cityLower.includes('토론토') || cityLower.includes('밴쿠버') || cityLower.includes('몬트리올') ||
      cityLower.includes('toronto') || cityLower.includes('vancouver') || cityLower.includes('montreal')) {
    return { currency: '캐나다 달러', currencyCode: 'CAD', symbol: 'C$', rate: 1050 };
  }

  // 한국 (기본값 처리용)
  if (cityLower.includes('서울') || cityLower.includes('부산') || cityLower.includes('제주') ||
      cityLower.includes('seoul') || cityLower.includes('busan') || cityLower.includes('jeju')) {
    return { currency: '원', currencyCode: 'KRW', symbol: '₩', rate: 1 };
  }

  // 기본값: 달러 (알 수 없는 도시의 경우)
  return { currency: '달러', currencyCode: 'USD', symbol: '$', rate: 1400 };
}

router.post("/ai/itinerary", async (req, res) => {
  const { city, startDate, endDate, people, budget } = req.body;
  const s = new Date(startDate);
  const e = new Date(endDate);
  const days = Math.max(1, Math.round((e - s) / 86400000) + 1);

  const budgetNum = Number(String(budget).replace(/[^\d]/g, "")) || 0;
  const peopleNum = parseInt(people, 10) || 1;
  const budgetPerPerson = Math.round(budgetNum / peopleNum);

  // 도시 기반으로 통화 및 환율 자동 감지
  const currencyInfo = getCurrencyInfo(city);
  const { currency, currencyCode, symbol, rate: fx } = currencyInfo;

  // 여행 월 계산 (평균 날씨 정보 제공용)
  const travelMonth = s.getMonth() + 1; // 1-12

  const prompt = `
      너는 전문 여행 플래너이자 관광 심리 분석가다.
      사용자에게 "${city}" 도시의 ${days}일 여행 일정을 추천해야 한다.
      이번 계획은 "1인 기준 예산"으로 작성하며, 총 예산(1인)은 약 ${budgetPerPerson}원이다.
      현지 통화는 ${currency}(${currencyCode}, 기호: ${symbol})이며, 환율은 1${currency}=${fx}원(고정)으로 계산한다.
      호텔 조식은 뺀다.

      규칙(핵심):
      1) **식사 필수 규칙(절대 빠뜨리지 말 것)**:
         - 매일 아침, 점심, 저녁 3끼 식사를 반드시 포함한다.
         - 각 식사는 별도의 stop으로 구성하고, category를 "breakfast", "lunch", "dinner"로 명시한다.
         - 첫날은 공항에서 도착 후 시내이동, 저녁밥 먹기로 시작한다.
         - 식사를 빼먹으면 안 됨! 하루에 3끼를 정확히 포함해야 한다.
      2) 마지막날은 남은돈을 면세점에서 모두 털어서 사용한다.

      3) 도시 제한: 반드시 "${city}" 내부에서만 추천한다.
      4) 스톱 수: 하루 8~11개(식사 3개 + 관광/쇼핑 5~8개). Day 1부터 Day ${days}까지 모든 날짜를 포함해야 한다.
        - Day 1: "공항 도착(airport)→시내 이동(transfer)→저녁식사(dinner, 필수)→관광/쇼핑"
        - Day ${days}: "아침식사(breakfast, 필수)→점심식사(lunch, 필수)→오전 관광/쇼핑→시내→공항(transfer)→공항 체크인(airport)"
        - 중간 날짜들(Day 2 ~ Day ${days - 1}): 각 날마다 아침/점심/저녁 3끼 + 관광/식사/쇼핑 5~8개 일정 포함
      5) 식사/쇼핑 철학(1인 기준):
        - **식사 필수**: 매일 아침(breakfast), 점심(lunch), 저녁(dinner) 3끼를 빠짐없이 포함한다.
        - 매일 쇼핑 또는 대형 상업시설 1곳 이상 포함(백화점/아울렛/상점가/드럭스토어/전자상가 등).
        - 전체 일정에서 "프리미엄(비싼) 식사" 최소 2회 이상(가능하면 Day 1 & Day ${days} 포함).
        - "must-visit" 필수 방문지 최소 3곳(랜드마크, 대표 맛집, 대표 쇼핑 허브 등).
        - **최소 비용 기준(1인)**: 일반 식사(아침/점심) 최소 8,000원, 저녁 식사 최소 15,000원, 프리미엄 식사 최소 30,000원, 관광지 입장료 최소 10,000원, 쇼핑 최소 20,000원.
      6) 정보 필수 항목(모든 스톱):
        - placeName, summary(50자 이내), reason(현실적 근거), costReason, estimatedCost(정수 KRW, 1인 기준),
          lat, lng(실좌표), category(필수: "breakfast"|"lunch"|"dinner"|"sightseeing"|"shopping" 등),
          tags(예: ["shopping","premium-dinner","must-visit","landmark","local-food"])
      7) dayReason: 각 날짜 테마/분위기를 서로 다르게(중복 표현 금지).
      8) 예산 분배(1인 기준):
        - 전체 합계(overallTotal) ∈ [${Math.round(budgetPerPerson * 0.95)}, ${Math.round(budgetPerPerson * 1.05)}] (반드시 95~100% 소진, 절대 90% 미만 금지)
        - 일평균 목표: ${Math.round(budgetPerPerson / days)}원 ±10%
        - 비용 산정은 ${currencyCode} 단가 → KRW 환산(정수 반올림). 예: Y = round(X${currency} × ${fx})원
        - costReason 형식(1인 기준): "단가(${currency}) × 수량 = X${currency} → 1${currency}=${fx}원 → Y원(1인)"
        - **중요**: 위의 최소 비용 기준을 반드시 준수하고, 각 항목의 실제 비용은 최소 기준의 1.5~2배 수준으로 설정하여 예산을 충분히 활용한다.
      9) 좌표 신뢰성: 바다/무효 좌표 금지, 실존 장소 좌표만.
      10) 중복 금지: 동일 장소 반복 금지(지점이 다르면 허용 가능).
      11) 출력 형식: **유효한 JSON만 반환**(설명/마크다운/코드블록 금지). 모든 합계는 정수이며 정확히 일치.
      12) **중요**: dayPlans 배열에는 정확히 ${days}개의 day 객체가 포함되어야 한다. (day: 1부터 day: ${days}까지)
      13) **식사 검증 필수**: 각 day마다 category가 "breakfast", "lunch", "dinner"인 stop이 각각 최소 1개씩 있어야 한다.
      14) "${city}" 도시의 ${travelMonth}월 평균 날씨 정보도 함께 제공하라.
         - 과거 30년 평균 기후 데이터를 기반으로 작성
         - 최고/최저 기온(°C), 강수량(mm), 강수일(일), 계절감, 여행 팁 포함

      카테고리/타임슬롯(권장):
      - category: "airport" | "transfer" | "breakfast" | "lunch" | "snack" | "cafe" | "dinner" | "sightseeing" | "shopping" | "activity" | "nightlife"
      - timeSlot: "morning" | "late_morning" | "afternoon" | "tea" | "evening" | "night"

      **[필수] 시간순 정렬 규칙 - 이 규칙을 어기면 응답 전체가 무효 처리됨**

      모든 dayPlans의 stops 배열은 반드시 실제 여행 동선처럼 시간 순서대로 정렬되어야 한다.

      **정확한 시간대 순서 (절대적 규칙):**
      1. morning (아침) - 07:00~09:00
         → category: "breakfast", "airport" (첫날만)
      2. late_morning (오전) - 09:00~12:00
         → category: "transfer", "sightseeing", "shopping"
      3. afternoon (점심) - 12:00~14:00
         → category: "lunch" (필수)
      4. tea (오후 전반) - 14:00~17:00
         → category: "activity", "shopping", "cafe", "snack"
      5. evening (저녁) - 17:00~20:00
         → category: "dinner" (필수), "sightseeing"
      6. night (야간) - 20:00~23:00
         → category: "nightlife", "shopping", "activity"

      **잘못된 예시 (절대 금지):**
       [dinner, breakfast, lunch] - 시간 역순
       [sightseeing, dinner, lunch, shopping] - 점심이 저녁 뒤에
       [lunch, breakfast, dinner] - 아침이 점심 뒤에

      **올바른 예시:**
       [breakfast, sightseeing, lunch, shopping, dinner, nightlife]
       [airport, transfer, dinner, nightlife] (첫날)
       [breakfast, shopping, lunch, cafe, dinner, shopping, nightlife]

      **검증 필수:** 각 day의 stops를 순서대로 읽었을 때 timeSlot 값이 항상 증가하거나 같아야 함 (절대 감소하면 안됨)

      출력 스키마(JSON만):
      {
        "city": "${city}",
        "currency": "${currency}",
        "currencyCode": "${currencyCode}",
        "currencySymbol": "${symbol}",
        "exchangeRate": ${fx},
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
        "overallTotal": 0,
        "averageWeather": {
          "month": ${travelMonth},
          "tempHigh": 22,
          "tempLow": 16,
          "precipitation": 110,
          "rainyDays": 9,
          "season": "가을",
          "tip": "가을 여행 최적기! 긴팔과 얇은 재킷을 준비하세요."
        }
      }

      Stop 스키마(예시, 모든 필드 필수):
      {
        "placeName": "정확 한국어 표기",
        "summary": "50자 이내 요약",
        "reason": "100~150자: 왜 가는지(맛/리뷰/접근성/대표성/가성비)",
        "costReason": "단가(${currency}) × 수량 = X${currency} → 1${currency}=${fx}원 → Y원(1인)",
        "estimatedCost": 50000,
        "lat": 35.0000,
        "lng": 135.0000,
        "category": "breakfast",
        "timeSlot": "morning",
        "tags": ["must-visit","shopping"]
      }

      검증 체크리스트:
      - dayPlans 배열 길이 = ${days} (모든 날짜 포함)
      - **식사 필수 검증**: 각 day마다 category="breakfast", "lunch", "dinner" 각각 최소 1개씩 포함 확인
      - dayTotal = 해당 day의 estimatedCost 합(정확히 일치), overallTotal = 모든 dayTotal 합
      - overallTotal ∈ [${Math.round(budgetPerPerson * 0.95)}, ${budgetPerPerson}] (반드시 95~100%, 절대 90% 미만 금지)
      - Day 1/마지막 날: 공항/이동/프리미엄 식사 포함
      - 매일 shopping/activity/nightlife ≥ 1
      - must-visit ≥ 3, 프리미엄 식사 ≥ 2
      - 좌표 실존/정확
      - 모든 항목이 최소 비용 기준(일반 식사 8,000원, 저녁 15,000원, 프리미엄 30,000원, 관광 10,000원, 쇼핑 20,000원)을 충족하는지 확인
      - averageWeather 필드가 month, tempHigh, tempLow, precipitation, rainyDays, season, tip을 포함하는지 확인
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

// 날씨 정보 API 라우트
router.get("/weather", async (req, res) => {
  const { lat, lng, city, startDate } = req.query;

  // 필수 파라미터 검증
  if (!lat || !lng || !city || !startDate) {
    return res.status(400).json({
      error: "필수 파라미터가 누락되었습니다: lat, lng, city, startDate",
    });
  }

  try {
    const travelDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    travelDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((travelDate - today) / (1000 * 60 * 60 * 24));

    // 5일 이내만 실시간 날씨 제공
    if (diffDays < 0) {
      return res.status(400).json({
        error: "과거 날짜는 실시간 예보를 제공할 수 없습니다.",
        diffDays,
      });
    }

    if (diffDays > 5) {
      console.log(`[실시간 날씨 범위 초과] ${city} - ${diffDays}일 후`);
      return res.status(400).json({
        error: "실시간 예보는 5일 이내만 가능합니다. AI 응답의 평균 날씨를 사용하세요.",
        diffDays,
      });
    }

    // 실시간 날씨 API 호출
    const weatherData = await fetchRealTimeWeather(
      parseFloat(lat),
      parseFloat(lng),
      city,
      startDate
    );

    if (!weatherData) {
      throw new Error("날씨 데이터를 가져올 수 없습니다.");
    }

    console.log(`[실시간 날씨 제공] ${city} - ${diffDays}일 후`);
    res.json(weatherData);
  } catch (err) {
    console.error("[날씨 API] 오류:", err.message);
    res.status(500).json({
      error: "날씨 정보를 가져오는 데 실패했습니다.",
      details: err.message,
    });
  }
});

export default router;
