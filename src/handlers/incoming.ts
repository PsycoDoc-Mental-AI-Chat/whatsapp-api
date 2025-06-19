import { checkFreemium } from "../services/user";

export async function handleIncomingMessage(waId: string, message: string) {
  if (await checkFreemium(waId)) {
    // Kirim ke Gemini API, reply, dsb.
    return { action: "forward_to_gemini", message };
  } else {
    // Balas limit habis
    return {
      action: "send_limit_message",
      message: "Kamu sudah mencapai limit harian.",
    };
  }
}
