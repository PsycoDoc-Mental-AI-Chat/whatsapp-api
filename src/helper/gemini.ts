import prisma from "../database/prisma";

type GeminiHistoryPart = {
  role: "user" | "model" | "system";
  parts: { text: string }[];
};

export async function getHistory(waId: string): Promise<GeminiHistoryPart[]> {
  const row = await prisma.geminiHistory.findUnique({ where: { waId } });
  return row ? (row.history as GeminiHistoryPart[]) : [];
}

export async function saveHistory(waId: string, history: GeminiHistoryPart[]) {
  await prisma.geminiHistory.upsert({
    where: { waId },
    update: { history },
    create: { waId, history },
  });
}

export async function resetHistory(waId: string) {
  await prisma.geminiHistory.delete({ where: { waId } }).catch(() => {});
}
