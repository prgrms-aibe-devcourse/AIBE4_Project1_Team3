export async function getAiRecommendation({ period, people, budget }) {
    console.log("[AI 요청] ", { period, people, budget });
  
    // 실제 API 호출로 교체 예정
    await delay(700);
  
    // 더미 데이터 (일본 루트)
    return {
      country: "일본",
      currency: "JPY",
      summary: "일본은 현재 환율이 유리하고 가까운 이동으로 교통비가 절감됩니다.",
      routes: [
        {
          day: 1,
          title: "도쿄 시내 탐방",
          summary: "아사쿠사 → 도쿄타워 → 시부야 스크램블",
          estimatedCost: 200000,
          coordinates: [35.6762, 139.6503],
        },
        {
          day: 2,
          title: "하코네 온천",
          summary: "오다와라 성 → 하코네 온천 → 아시노호",
          estimatedCost: 250000,
          coordinates: [35.2324, 139.1068],
        },
        {
          day: 3,
          title: "교토 히스토리",
          summary: "기요미즈데라 → 니조성 → 기온",
          estimatedCost: 300000,
          coordinates: [35.0116, 135.7681],
        },
        {
          day: 4,
          title: "오사카 미식",
          summary: "도톤보리 → 신사이바시 → 오사카성",
          estimatedCost: 280000,
          coordinates: [34.6937, 135.5023],
        },
        {
          day: 5,
          title: "나라 사슴 공원",
          summary: "도다이지 → 나라 공원 → 가스가타이샤",
          estimatedCost: 220000,
          coordinates: [34.6851, 135.8048],
        },
      ],
    };
  }
  
  function delay(ms){ return new Promise(res=>setTimeout(res, ms)); }
  