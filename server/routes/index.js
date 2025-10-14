import { Router } from "express";

import indexController from "../controllers/indexController.js";
import recommendController from "../controllers/recommendController.js";

const router = Router();

router.use("/", indexController);
router.use("/routes", recommendController);

export default router;
