import { Router } from "express";
import { sendMessage } from "../services/whatsapp";

const router = Router();

router.post("/", async (req, res) => {
  const { to, message, image } = req.body;
  try {
    const result = await sendMessage(to, message, image);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
