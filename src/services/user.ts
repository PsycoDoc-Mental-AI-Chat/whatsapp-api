import { DAYS_THRESHOLD } from "../configs/user";
import prisma from "../database/prisma";
import { subDays } from "date-fns";
import { sendMessage } from "./whatsapp";

export async function checkAndAddFreemium(
  waId: string
): Promise<{ allowed: boolean; messagesLeft: number }> {
  let user = await prisma.user.findUnique({ where: { waId } });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!user) {
    user = await prisma.user.create({
      data: {
        waId,
        messagesToday: 1,
        lastMessageDate: today,
      },
    });
    return { allowed: true, messagesLeft: 10 - 1 };
  }

  const last = new Date(user.lastMessageDate);
  last.setHours(0, 0, 0, 0);
  if (today.getTime() !== last.getTime()) {
    await prisma.user.update({
      where: { waId },
      data: { messagesToday: 1, lastMessageDate: today },
    });
    return { allowed: true, messagesLeft: 10 - 1 };
  }

  if (user.messagesToday >= 10) {
    return { allowed: false, messagesLeft: 0 };
  }

  await prisma.user.update({
    where: { waId },
    data: { messagesToday: { increment: 1 } },
  });
  return { allowed: true, messagesLeft: 10 - (user.messagesToday + 1) };
}

export async function isUserPremium(waId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { waId } });
  if (!user) return false;

  if (!user.isPremium || !user.premiumUntil) return false;

  const now = new Date();
  const stillPremium = user.premiumUntil.getTime() > now.getTime();

  if (!stillPremium) {
    await prisma.user.update({
      where: { waId },
      data: { isPremium: false, premiumUntil: null },
    });
  }

  return stillPremium;
}

export async function setUserPremium(waId: string, days: number) {
  let until: Date;
  if (days == 7) {
    until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else {
    until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  await prisma.user.update({
    where: { waId },
    data: {
      isPremium: true,
      premiumUntil: until,
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendReminders() {
  const now = new Date();
  const inactiveSince = subDays(now, DAYS_THRESHOLD);

  const users = await prisma.user.findMany({
    where: {
      isPremium: true,
      lastActiveAt: { lt: inactiveSince },
      OR: [
        { lastRemindedAt: null },
        { lastRemindedAt: { lt: prisma.user.fields.lastActiveAt } }, // belum pernah diingatkan
      ],
    },
  });

  for (const user of users) {
    const phone = user.waId.split("@")[0];

    await sendMessage(
      phone,
      `Halo dari Dokter Psy! Sudah beberapa hari kamu belum bercerita. Jangan ragu untuk menghubungi Dokter Psy kapan saja jika butuh teman ngobrol atau saran ya 😊`
    );

    await prisma.user.update({
      where: { waId: user.waId },
      data: { lastRemindedAt: now },
    });

    console.log(`Reminder sent to ${user.waId} at ${now.toISOString()}`);
    const delay = 1000 + Math.floor(Math.random() * 9000);
    await sleep(delay);
  }
}
