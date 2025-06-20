import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  delay,
  AnyMessageContent,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import path from "path";
import QRCode from "qrcode";
import { parseIncomingMessage } from "../helper/message";
import { checkAndAddFreemium, isUserPremium } from "./user";
import {
  askGeminiImage,
  askGeminiImageWithHistory,
  askGeminiText,
  askGeminiWithHistory,
} from "./gemini";
import { createQrisPayment, simulatePayment } from "./midtrans";
import { PRICELIST } from "../configs/payment";

const logger = P({ level: "info" });

const SESSION_FOLDER = path.resolve(__dirname, "../../sessions");
let sock: ReturnType<typeof makeWASocket> | null = null;
let qrStr: string | null = null;
let isReady = false;

type SendMessageWithTyping = (
  sock: ReturnType<typeof makeWASocket>,
  msg: AnyMessageContent,
  jid: string
) => Promise<void>;

export const sendMessageWTyping: SendMessageWithTyping = async (
  sock,
  msg,
  jid
) => {
  if (!sock) throw new Error("WhatsApp belum connect.");

  await sock.presenceSubscribe(jid);
  await delay(200);
  await sock.sendPresenceUpdate("composing", jid);
  await delay(1000);
  await sock.sendPresenceUpdate("paused", jid);
  await sock.sendMessage(jid, msg);
};

export async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) {
      qrStr = qr;
      isReady = false;
      if (process.env.APP_MODE === "development") {
        let qrcodeTerminal = require("qrcode-terminal");
        qrcodeTerminal.generate(qr, { small: true });
        console.log("QR Code generated. Scan it with WhatsApp!");
      }
    }
    if (connection === "open") {
      isReady = true;
      qrStr = null;
      console.log("WhatsApp connected!");
    }
    if (connection === "close") {
      isReady = false;
      qrStr = null;
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(connectWA, 1500);
      } else {
        console.log("WhatsApp logged out. Session deleted.");
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (upsert) => {
    if (upsert.type === "notify") {
      for (const msg of upsert.messages) {
        if (!msg.key.fromMe && sock) {
          const wa_id = msg.key.remoteJid ?? "";
          const content = await parseIncomingMessage(sock, msg);

          if (content.type === "text") {
            const txt = content.text?.toLowerCase().trim();

            if (txt === "/upgrade") {
              await sendMessageWTyping(
                sock,
                {
                  text: `*Akses Premium:*
- 7 hari: Rp10.000 (/upgrade 7d)
- 30 hari: Rp30.000 (/upgrade 30d)

Ketik /upgrade 7d atau /upgrade 30d untuk pembayaran via QRIS!
`,
                },
                wa_id
              );
              continue;
            }

            if (txt === "/upgrade 7d" || txt === "/upgrade 30d") {
              const duration = txt.split(" ")[1];
              const price = PRICELIST[duration as "7d" | "30d"];
              if (!price) {
                await sendMessageWTyping(
                  sock,
                  { text: "Paket tidak ditemukan." },
                  wa_id
                );
                continue;
              }

              // Generate QRIS
              const { qrisString, qrisUrl, order_id } = await createQrisPayment(
                {
                  waId: wa_id,
                  duration,
                  price,
                }
              );

              if (qrisString && qrisUrl) {
                const qrImage = await QRCode.toBuffer(qrisString, {
                  type: "png",
                });

                await sock.sendMessage(wa_id, {
                  image: qrImage,
                  caption:
                    `*QRIS untuk Upgrade Premium ${duration}*\n\n` +
                    `Silakan bayar Rp${price.toLocaleString()} dengan scan QR di atas.\n\n` +
                    `Setelah pembayaran, premium akan otomatis aktif dalam beberapa menit.\n\n` +
                    `_Order ID: ${order_id}_`,
                });
              } else {
                await sendMessageWTyping(
                  sock,
                  { text: "Permintaan QRIS gagal, silahkan coba lagi nanti" },
                  wa_id
                );
              }

              continue;
            }

            if (txt?.startsWith("/simulate-pay")) {
              const order_id = txt.split(" ")[1];
              if (!order_id) {
                await sendMessageWTyping(
                  sock,
                  {
                    text: "Tulis ID transaksi kamu, misal /simulate-pay PD-6281225389903-7d-39u5d5.",
                  },
                  wa_id
                );
                continue;
              }

              const { success, message } = await simulatePayment({
                waId: wa_id,
                orderId: order_id,
              });

              if (success) {
                await sendMessageWTyping(sock, { text: message }, wa_id);
              } else {
                await sendMessageWTyping(sock, { text: message }, wa_id);
              }

              continue;
            }

            if (txt?.startsWith("/")) {
              await sendMessageWTyping(
                sock,
                { text: "Perintah tidak dikenali" },
                wa_id
              );
              continue;
            }
          }

          const premium = await isUserPremium(wa_id);

          // PREMIUM LOGIC
          if (premium) {
            if (content.type === "text") {
              // await forwardToWebhook({
              //   wa_id,
              //   from: msg.pushName || "",
              //   message_type: content.type,
              //   text: content.text || null,
              //   media_base64: content.media || null,
              //   mimetype: content.mimetype || null,
              //   messageLeft: null, // premium bebas
              // });

              const reply = await askGeminiWithHistory(wa_id, content.text!);
              // const reply = await askGeminiText(content.text!);
              await sendMessageWTyping(sock, { text: reply }, wa_id);
              continue;
            }
            if (content.type === "image") {
              const reply = await askGeminiImageWithHistory(
                wa_id,
                content.media!,
                content.mimetype || "image/jpeg",
                content.text || "nih"
              );

              // const reply = await askGeminiImage(
              //   content.media!,
              //   content.mimetype || "image/jpeg",
              //   content.text
              // );
              await sendMessageWTyping(sock, { text: reply }, wa_id);
              continue;
            }
            // Selain text/gambar, beri info sedang dalam pengerjaan
            await sendMessageWTyping(
              sock,
              {
                text: "Fitur media selain gambar sedang dalam pengerjaan.",
              },
              wa_id
            );
            continue;
          }

          // NON-PREMIUM LOGIC
          const { allowed, messagesLeft } = await checkAndAddFreemium(wa_id);
          if (!allowed) {
            await sendMessageWTyping(
              sock,
              {
                text: "Limit gratis harian sudah habis. Silakan upgrade untuk akses unlimited.",
              },
              wa_id
            );
            continue;
          }

          if (content.type !== "text") {
            await sendMessageWTyping(
              sock,
              {
                text: "Fitur media (gambar, dokumen, dll) hanya tersedia untuk akun premium.",
              },
              wa_id
            );
            continue;
          }

          // Hanya text dan masih dalam limit
          // await forwardToWebhook({
          //   wa_id,
          //   from: msg.pushName || "",
          //   message_type: content.type,
          //   text: content.text || null,
          //   media_base64: null,
          //   mimetype: null,
          //   messageLeft: messagesLeft,
          // });

          if (content.type === "text") {
            const reply = await askGeminiWithHistory(wa_id, content.text!);
            // const reply = await askGeminiText(content.text!);
            await sendMessageWTyping(sock, { text: reply }, wa_id);
            continue;
          }
        }
      }
    }
  });
}

// Status koneksi
export async function getStatus() {
  return {
    connected: isReady,
    user: sock?.user?.id || null,
  };
}

// Dapatkan QR string
export async function getQR() {
  if (!isReady && qrStr) {
    return qrStr;
  }
  if (!sock) {
    await connectWA();
    return null;
  }
  return null;
}

// Kirim pesan
export async function sendMessage(
  to: string,
  message?: string,
  imageBase64?: string
) {
  if (!isReady || !sock) throw new Error("Not connected to WhatsApp");
  const jid = to.includes("@s.whatsapp.net") ? to : `${to}@s.whatsapp.net`;

  if (imageBase64) {
    await sock.sendMessage(jid, {
      image: Buffer.from(imageBase64, "base64"),
      caption: message,
    });
    return { to, type: "image", message };
  } else {
    await sock.sendMessage(jid, { text: message || "" });
    return { to, type: "text", message };
  }
}
