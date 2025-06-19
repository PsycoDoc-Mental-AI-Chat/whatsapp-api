import express, { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

app.get("/api/status", (_: Request, res: Response) => {
  res.json({ status: "running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PsycoDoc WhatsApp API running on port ${PORT}`);
});
