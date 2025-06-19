import { Router } from "express";
import prisma from "../database/prisma";
import { sendMessage } from "../services/whatsapp";
import { MIDTRANS_SERVER_KEY } from "../configs/payment";
import crypto from "crypto";

const router = Router();

router.post("/midtrans-callback", async (req, res) => {
  const body = req.body;
  const { order_id, status_code, gross_amount, signature_key } = body;

  const raw = order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY;
  const expectedSignature = crypto
    .createHash("sha512")
    .update(raw)
    .digest("hex");

  if (expectedSignature == signature_key) {
    // Cek transaksi sukses
    if (
      body.transaction_status === "settlement" ||
      body.transaction_status === "capture"
    ) {
      const { order_id } = body;

      await prisma.transaction.update({
        where: { orderId: order_id },
        data: {
          status: body.transaction_status,
          paidAt:
            body.transaction_status === "settlement" ||
            body.transaction_status === "capture"
              ? new Date()
              : undefined,
        },
      });

      // Parse order_id: PD-628xxxx-7d-rand
      const [_, waId, duration] = order_id.split("-");
      let premiumUntil = new Date();
      if (duration === "7d") {
        premiumUntil.setDate(premiumUntil.getDate() + 7);
      } else if (duration === "30d") {
        premiumUntil.setDate(premiumUntil.getDate() + 30);
      }

      await prisma.user.upsert({
        where: { waId: waId + "@s.whatsapp.net" },
        update: { isPremium: true, premiumUntil },
        create: { waId, isPremium: true, premiumUntil },
      });

      let message: string;
      if (
        body.transaction_status == "settlement" ||
        body.transaction_status == "capture"
      ) {
        message =
          "Pembayaran kamu diterima!, premium kamu sudah aktif mulai sekarang yaa...";
      } else {
        message =
          "Pembayaran kamu gagal, jangan scan QRIS sebelumnya, silahkan membuat transaksi baru dengan mengetik `/upgrade`";
      }

      await sendMessage(waId, message);
    }
  }

  res.json({ received: true });
});

export default router;
