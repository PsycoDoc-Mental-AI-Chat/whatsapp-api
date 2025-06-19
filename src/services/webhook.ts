import axios from "axios";

export async function forwardToWebhook(payload: any) {
  const WEBHOOK_URL =
    process.env.WEBHOOK_URL || "http://your-webhook-url.com/receive";
  try {
    await axios.post(WEBHOOK_URL, payload, {
      timeout: 5000, // biar ga ngegantung
    });
    return true;
  } catch (err) {
    console.error("Gagal forward ke webhook:", err);
    return false;
  }
}
