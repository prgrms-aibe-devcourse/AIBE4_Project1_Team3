import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.use(express.static(path.resolve("./src")));

app.use("/api", router);

app.get(/.*/, (req, res) => {
  res.sendFile(path.resolve("./src/index.html"));
});

app.listen(port, () => {
  console.log(`서버가 ${port}번 포트로 실행 중입니다.`);
});

export default app;