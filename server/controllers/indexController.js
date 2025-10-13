const express = require("express");
const indexService = require("../services/indexService");

const router = express.Router();

router.post("/recommend", async (req, res) => {
  const { startDate, endDate, budget, people } = req.body;

  if (!startDate || !endDate || !budget || !people) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  try {
    const result = await indexService.recommend({
      startDate,
      endDate,
      budget,
      people,
    });

    res.json(result);
  } catch (error) {
    console.error("API 호출 erorr:", error);
    res.status(500).json({ error: "API 호출 중 오류가 발생했습니다." });
  }
});

module.exports = router;
