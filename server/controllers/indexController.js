import { Router } from "express";
import {
  recommend,
  fetchExchangeRate,
  subtractBusinessDays,
} from "../services/indexService.js";

const router = Router();

// POST /api/recommend - AI 여행지 추천 API
router.post("/recommend", async (req, res) => {
  const { startDate, endDate, budget, people } = req.body;

  if (!startDate || !endDate || !budget || !people) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  try {
    // import한 recommend 함수를 직접 호출합니다.
    const result = await recommend({
      startDate,
      endDate,
      budget,
      people,
    });
    res.json(result);
  } catch (error) {
    console.error("API /recommend 호출 error:", error);
    res.status(500).json({
      error: "API 호출 중 오류가 발생했습니다.",
      details: error.message,
    });
  }
});

// GET /api/exchange - 환율 정보 조회 API
router.get("/exchange", async (req, res) => {
  try {
    const currencyData = {};
    const labels = [];
    const today = new Date();

    // import한 subtractBusinessDays 함수를 사용합니다.
    const days = subtractBusinessDays(today, 6); // 오늘 시점 기준 6개월 전 영업일들

    // Promise.all을 사용해 병렬로 API를 호출하여 성능을 개선합니다.
    const exchangeDataPromises = days.map((date) => fetchExchangeRate(date));
    const results = await Promise.all(exchangeDataPromises);
    results.forEach((data, index) => {
      const searchDate = days[index];
      labels.push(searchDate.slice(4, 6) + "월");

      if (data) {
        data.forEach((item) => {
          let code = item.cur_unit === "JPY(100)" ? "JPY100" : item.cur_unit;
          const rate = parseFloat(item.deal_bas_r.replace(/,/g, ""));

          if (!currencyData[code]) {
            currencyData[code] = new Array(results.length).fill(null);
          }
          currencyData[code][index] = rate;
        });
      }
    });

    // 데이터가 없는 날짜에 대해 모든 통화에 null이 채워지도록 보정
    Object.keys(currencyData).forEach((code) => {
      if (currencyData[code].length !== results.length) {
        const correctedData = new Array(results.length).fill(null);
        currencyData[code].forEach((rate, i) => (correctedData[i] = rate));
        currencyData[code] = correctedData;
      }
    });

    res.json({
      labels: labels,
      data: currencyData,
    });
  } catch (error) {
    console.error("API /exchange 서버 처리 오류:", error);
    res
      .status(500)
      .json({ error: "데이터를 가져오는 중 서버 오류가 발생했습니다." });
  }
});

router.get("/api/exchange", async (req, res) => {
  try {
    const currencyData = {};
    const labels = [];

    const today = new Date();
    let day = subtractBusinessDays(today, 6);
    for (let i = 0; i < day.length; i++) {
      const searchDate = day[i];
      const data = await fetchExchangeRate(searchDate);
      labels.push(day[i].slice(4, 6) + "월");

      if (data) {
        data.forEach((item) => {
          let code = "";
          if (item.cur_unit == "JPY(100)") code = "JPY100";
          else code = item.cur_unit;

          const rate = parseFloat(item.deal_bas_r.replace(/,/g, ""));

          if (!currencyData[code]) {
            currencyData[code] = [];
          }
          currencyData[code].push(rate);
        });
      } else {
        Object.keys(currencyData).forEach((code) => {
          currencyData[code].push(null);
        });
      }
    }
    res.json({
      labels: labels,
      data: currencyData,
    });
  } catch (error) {
    console.error("서버 처리 오류:", error);
    res
      .status(500)
      .json({ error: "데이터를 가져오는 중 서버 오류가 발생했습니다." });
  }
});

export default router;
