import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import router from "./routes/index.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 정적 파일 제공 (src 폴더)
app.use("/src", express.static(path.join(__dirname, "../src")));

// 루트 경로 리다이렉트
app.get("/", (req, res) => {
  res.redirect("/src/index.html");
});

app.use("/api", router);

app.listen(port, () => {
  console.log(`서버가 ${port}번 포트로 실행 중입니다.`);
});

export default app;
