import express from "express";
import dotenv from "dotenv";
import apiRouter from "./api/index";
import { connectWA } from "./services/whatsapp";
import cron from "node-cron";
import { sendReminders } from "./services/user";

dotenv.config();
const app = express();
app.use(express.json());

connectWA();

app.use("/api", apiRouter);

cron.schedule("0 10 * * *", sendReminders);

const PORT = process.env.APP_PORT || 3000;
app.listen(PORT, () => {
  console.log(`PsycoDoc WhatsApp API running on port ${PORT}`);
});
