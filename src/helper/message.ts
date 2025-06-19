import { downloadMediaMessage, WASocket } from "@whiskeysockets/baileys";
import { proto } from "@whiskeysockets/baileys";
import P from "pino";

export async function parseIncomingMessage(
  sock: WASocket,
  msg: proto.IWebMessageInfo,
  logger: P.Logger = P({ level: "silent" })
): Promise<{
  type: string;
  text?: string | null;
  media?: string | null;
  mimetype?: string | null;
  filename?: string | null;
}> {
  if (!msg.message) return { type: "unknown", text: null };

  const m = msg.message;

  // Text message
  if (m.conversation) return { type: "text", text: m.conversation };

  // Extended text (reply, preview, dsb)
  if (m.extendedTextMessage)
    return { type: "text", text: m.extendedTextMessage.text };

  // Image
  if (m.imageMessage) {
    let buffer: Buffer | null = null;
    try {
      buffer = await downloadMediaMessage(msg as any, "buffer", {});
    } catch (err) {
      logger.error("Failed to download image:", err);
    }
    return {
      type: "image",
      text: m.imageMessage.caption || null,
      media: buffer ? buffer.toString("base64") : null,
      mimetype: m.imageMessage.mimetype || "image/jpeg",
    };
  }

  // Document
  if (m.documentMessage) {
    let buffer: Buffer | null = null;
    try {
      buffer = await downloadMediaMessage(msg, "buffer", {});
    } catch (err) {
      logger.error("Failed to download document:", err);
    }
    return {
      type: "document",
      text: m.documentMessage.caption || null,
      media: buffer ? buffer.toString("base64") : null,
      filename: m.documentMessage.fileName || "file",
      mimetype: m.documentMessage.mimetype || "application/octet-stream",
    };
  }

  // Audio (tidak perlu diambil, tapi bisa deteksi)
  if (m.audioMessage) {
    return {
      type: "audio",
      mimetype: m.audioMessage.mimetype || "audio/ogg",
    };
  }

  // Video (jika mau deteksi)
  if (m.videoMessage) {
    return {
      type: "video",
      mimetype: m.videoMessage.mimetype || "video/mp4",
    };
  }

  // Tambah tipe lain jika perlu
  return { type: "unknown", text: null };
}
