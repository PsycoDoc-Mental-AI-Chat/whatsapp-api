import { Router } from "express";
import { getQR } from "../services/whatsapp";

const router = Router();

router.get("/", async (_, res) => {
  const qr = await getQR();
  if (qr) {
    res.json({ qr });
  } else {
    res.status(200).json({ message: "Already connected or initializing" });
  }
});

export default router;
