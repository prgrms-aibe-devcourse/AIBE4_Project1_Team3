import { Router } from "express";

import indexController from "../controllers/indexController.js";
import recommendController from "../controllers/recommendController.js";
import reviewController from "../controllers/reviewController.js";

const router = Router();

router.use("/", indexController);
router.use("/routes", recommendController);
router.use("/review", reviewController);

export default router;
