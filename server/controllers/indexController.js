const express = require("express");
const indexService = require("../services/indexService");

const router = express.Router();

router.post("/recommend", async (req, res) => {
  const { startDate, endDate, budget, people } = req.body;

  if (!startDate || !endDate || !budget || !people) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  try {
    const resultText = await indexService.recommend({
      startDate,
      endDate,
      budget,
      people,
    });

    res.send(resultText);
  } catch (error) {
    console.error("API 호출 error:", error);
    res.status(500).json({ error: "API 호출 중 오류가 발생했습니다." });
  }
});

router.get("/exchange", async (req, res) => {
  try {
    const currencyData = {};
    const labels = [];

    const today = new Date();
    let day = indexService.subtractBusinessDays(today, 6); // 오늘시점으로 6개월 전 날짜를 시작점으로...

    for (let i = 0; i < day.length; i++) {
      day.sort();
      const searchDate = day[i];
      const data = await indexService.fetchExchangeRate(searchDate);
      labels.push(day[i].slice(4, 6) + "월");

      if (data) {
        data.forEach((item) => {
          let code = "";
          if (item.cur_unit == "JPY(100)") code = "JPY100";
          else code = item.cur_unit;

          // 천 단위 콤마 제거 후 숫자로 변환
          const rate = parseFloat(item.deal_bas_r.replace(/,/g, ""));

          if (!currencyData[code]) {
            currencyData[code] = [];
          }
          currencyData[code].push(rate);
        });
      } else {
        // 데이터가 없는 경우, 해당 일자에는 null을 채워 차트에서 공백으로 표시
        // 이전에 수집된 모든 통화에 null을 추가
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

module.exports = router;
