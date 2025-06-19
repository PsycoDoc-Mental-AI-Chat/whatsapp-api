import { Router } from "express";
import { getStatus } from "../services/whatsapp";

const router = Router();

router.get("/", async (_, res) => {
  const status = await getStatus();
  res.json(status);
});

export default router;
