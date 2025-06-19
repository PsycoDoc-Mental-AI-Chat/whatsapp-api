import prisma from "../database/prisma";

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
