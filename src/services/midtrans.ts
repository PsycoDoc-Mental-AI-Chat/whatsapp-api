import axios from "axios";
import prisma from "../database/prisma";
import { MIDTRANS_SERVER_KEY } from "../configs/payment";
import { sendMessage } from "./whatsapp";
const MIDTRANS_BASE_URL =
  process.env.MIDTRANS_BASE_URL || "https://api.sandbox.midtrans.com/v2/charge";

const basicAuth = Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64");

function randomStr(len = 6) {
  return Math.random().toString(36).substr(2, len);
}

export async function createQrisPayment({
  waId,
  duration, // string: "7d" | "30d"
  price, // number
}: {
  waId: string;
  duration: string;
  price: number;
}) {
  const phone = waId.split("@")[0];
  const order_id = `PD-${phone}-${duration}-${randomStr(6)}`;
  try {
    const response = await axios.post(
      MIDTRANS_BASE_URL,
      {
        payment_type: "qris",
        transaction_details: {
          order_id,
          gross_amount: price,
        },
        qris: {
          acquirer: "gopay",
        },
        customer_details: {
          first_name: waId,
        },
        item_details: [
          {
            id: duration,
            price,
            quantity: 1,
            name: `Upgrade PsycoDoc Premium ${duration}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("SUKSES MIDTRANS:", response.data);
    await prisma.transaction.create({
      data: {
        orderId: order_id,
        waId,
        duration,
        price,
        status: "pending",
      },
    });

    return {
      qrisString: response.data.qr_string,
      qrisUrl: response.data.actions?.find(
        (a: any) => a.name === "generate-qr-code"
      )?.url,
      order_id,
      invoiceUrl: response.data.redirect_url,
      transactionToken: response.data.transaction_id,
      expiry: response.data.expiry_time, // waktu kadaluarsa
    };
  } catch (err: any) {
    if (err.response && err.response.data) {
      console.log("MIDTRANS ERROR:", err.response.data);
      if (err.response.data.validation_messages) {
        console.log("VALIDATION:", err.response.data.validation_messages);
      }
    } else {
      console.log("UNKNOWN ERROR:", err);
    }

    return {
      qrisString: null,
      qrisUrl: null,
      order_id,
    };
  }
}

export async function simulatePayment({
  waId,
  orderId,
}: {
  waId: string;
  orderId: string;
}) {
  const transactionStatus = "settlement"; // Simulate a successful payment

  const [_, __, duration] = orderId.split("-");

  let dura: string = "";
  let premiumUntil = new Date();
  if (duration === "7d") {
    premiumUntil.setDate(premiumUntil.getDate() + 7);
    dura = "selama 7 hari";
  } else if (duration === "30d") {
    premiumUntil.setDate(premiumUntil.getDate() + 30);
    dura = "selama 30 hari";
  }

  try {
    await prisma.user.upsert({
      where: { waId },
      update: { isPremium: true, premiumUntil },
      create: { waId, isPremium: true, premiumUntil },
    });

    await prisma.transaction.update({
      where: { orderId },
      data: {
        status: transactionStatus,
        paidAt: new Date(),
      },
    });

    console.log("SUKSES SIMULASI MIDTRANS:", orderId);
    const message = `Pembayaran kamu diterima!, premium kamu sudah aktif ${dura} mulai sekarang yaa...`;

    return {
      success: true,
      message,
    };
  } catch (err) {
    console.error("ERROR SIMULASI MIDTRANS:", err);
    const message = `Pembayaran kamu gagal!, coba lagi nanti yaa...`;

    return {
      success: false,
      message,
    };
  }
}
