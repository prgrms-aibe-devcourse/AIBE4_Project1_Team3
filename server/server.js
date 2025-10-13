const express = require("express");
const cors = require("cors");

require("dotenv").config();

const app = express();
const port = 3000;

module.exports = app;

app.use(cors());
app.use(express.json());

const routes = require("../routes");
app.use("/api", routes);

app.listen(port, () => {
  console.log(`서버가 ${port}번 포트로 실행 중입니다.`);
});
