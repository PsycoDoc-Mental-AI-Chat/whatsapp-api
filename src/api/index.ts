import { Router } from "express";
import statusRouter from "./status";
import connectRouter from "./connect";
import sendRouter from "./send";
import webhookRouter from "./webhook";

const router = Router();

router.use("/status", statusRouter);
router.use("/connect", connectRouter);
router.use("/send", sendRouter);
router.use("/webhook", webhookRouter);

export default router;
