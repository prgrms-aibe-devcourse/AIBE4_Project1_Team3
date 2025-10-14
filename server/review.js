import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.resolve(__dirname, "../src")));
app.use(express.json());

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { SUPABASE_KEY: supabaseKey, SUPABASE_URL: supabaseUrl } = process.env;
const supabase = createClient(supabaseUrl, supabaseKey);

// 리뷰 게시판 페이지
app.get("/review", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/review.html"));
});

// 리뷰 데이터 가져옴
app.get("/api/review", async (req, res) => {
  const sortType = req.query.sortType;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 8;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // 정렬 기준 설정
  let column = "created_at";
  let ascending = false; // 기본: 최신순 (내림차순)

  if (sortType === "oldest") {
    column = "created_at";
    ascending = true;
  } else if (sortType === "highRate") {
    column = "rate";
    ascending = false;
  } else if (sortType === "lowRate") {
    column = "rate";
    ascending = true;
  }

  const { data, count, error } = await supabase
    .from("review")
    .select("id, title, rate, created_at", { count: "exact" })
    .order(column, { ascending })
    .range(from, to);

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    data,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
  });
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

// 여행 경로 리뷰 작성 페이지
app.get("/review/create", (req, res) => {
  res.sendFile(path.join(__dirname, "../src/review-form.html"));
});
