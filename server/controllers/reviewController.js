import { Router } from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { SUPABASE_KEY: supabaseKey, SUPABASE_URL: supabaseUrl } = process.env;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/review/receive - 리뷰 데이터들을 가져옴
router.get("/receive", async (req, res) => {
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
    column = "rating";
    ascending = false;
  } else if (sortType === "lowRate") {
    column = "rating";
    ascending = true;
  }

  const { data, count, error } = await supabase
    .from("review")
    .select("id, title, rating, created_at", { count: "exact" })
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

// POST /api/review/create - 경로 공유 내용 저장함
router.post("/create", async (req, res) => {
  try {
    const reviewData = req.body; // 이미 JSON 형태로 들어옴

    const { data, error } = await supabase.from("review").insert({
      title: reviewData.title,
      content: reviewData.content,
      rating: reviewData.rating,
      course: reviewData.course,
      password: reviewData.password,
    });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/review/receive/:id - 리뷰 상세 데이터 가져오기
router.get("/receive/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("review")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

// DELETE /api/review/delete/:id - 리뷰 데이터 삭제
router.delete("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const { data, error } = await supabase.from("review").delete().eq("id", id);

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
