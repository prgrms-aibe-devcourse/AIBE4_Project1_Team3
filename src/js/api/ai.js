const USE_MOCK = false; 
const API_BASE = "http://localhost:3000";

export async function getAiRecommendation({ city, startDate, endDate, people, budget }) {
  const days = calcDays(startDate, endDate);

  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE}/ai/itinerary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, startDate, endDate, people, budget })
    });
    if (!res.ok) throw new Error("AI itinerary request failed");
    return await res.json(); // { city, dayPlans: [...] }
  } else {
    return mockItinerary(city, days, budget);
  }
}

function calcDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function safeParseJSON(text) {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}

function coerceItinerary(json, { city, days }) {
  const out = { city, dayPlans: [] };
  if (!json || !Array.isArray(json.dayPlans)) return out;
  for (const d of json.dayPlans.slice(0, days)) {
    const stops = Array.isArray(d.stops) ? d.stops : [];
    out.dayPlans.push({
      day: Number(d.day) || out.dayPlans.length + 1,
      title: String(d.title || `${city} Day`),
      stops: stops
        .map(s => ({
          placeName: String(s.placeName || s.title || "장소"),
          summary: String(s.summary || ""),
          lat: Number(s.lat),
          lng: Number(s.lng),
          estimatedCost: Number(s.estimatedCost || 0),
          popularity: Number(s.popularity || 0)
        }))
        .filter(s => isFinite(s.lat) && isFinite(s.lng))
    });
  }
  return out;
}

function mockItinerary(city, days, budget) {
  const seeds = city.toLowerCase().includes("오사카") || city.toLowerCase().includes("osaka")
    ? [
        ["도톤보리", "먹거리와 네온 사인", 34.6687, 135.5019],
        ["오사카성", "성곽과 공원 산책", 34.6873, 135.5262],
        ["신사이바시", "쇼핑 스트리트", 34.6735, 135.5013],
        ["가이유칸", "대형 수족관", 34.6545, 135.4280],
        ["천왕사 신세카이", "레트로 감성", 34.6525, 135.5063]
      ]
    : [
        ["아사쿠사 센소지", "가미나리몬", 35.7148, 139.7967],
        ["스카이트리", "전망대", 35.7101, 139.8107],
        ["시부야 스크램블", "랜드마크", 35.6595, 139.7005],
        ["도쿄타워", "전망과 야경", 35.6586, 139.7454],
        ["오다이바", "바다와 쇼핑", 35.6272, 139.7768]
      ];

  const dayPlans = Array.from({ length: days }, (_, i) => {
    const base = (i * 3) % seeds.length;
    const picks = [seeds[base], seeds[(base + 1) % seeds.length], seeds[(base + 2) % seeds.length]];
    return {
      day: i + 1,
      title: `${city} Day ${i + 1}`,
      stops: picks.map((p, idx) => ({
        placeName: p[0],
        summary: p[1],
        lat: p[2],
        lng: p[3],
        estimatedCost: Math.round((Number(String(budget).replace(/[^\d]/g, "")) || 300000) / days / (idx + 1)),
        popularity: 0.7 + 0.1 * idx
      }))
    };
  });

  return { city, dayPlans };
}
