import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import fs from "fs/promises";
import { getHistory, saveHistory } from "../helper/gemini";
import { MAX_HISTORY, SYSTEM_TUNING } from "../configs/gemini";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function askGeminiWithHistory(
  waId: string,
  userMessage: string
): Promise<string> {
  let history = await getHistory(waId);

  if (history.length === 0) {
    history = []; // <-- JANGAN role: "system"
  }

  history.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    history,
    config: { systemInstruction: SYSTEM_TUNING }, // <-- tuning
  });

  const response = await chat.sendMessage({ message: userMessage });

  if (response.text) {
    history.push({
      role: "model",
      parts: [{ text: response.text }],
    });

    const cropped = history.slice(-MAX_HISTORY);
    await saveHistory(waId, cropped);
  }

  return response.text || "Maaf, aku belum mengerti.";
}

export async function askGeminiImageWithHistory(
  waId: string,
  imageBase64: string,
  mimeType: string,
  caption?: string
): Promise<string> {
  let history = await getHistory(waId);
  if (history.length === 0) {
    history = [];
  }

  const userParts: any[] = [];
  if (caption) userParts.push({ text: caption });
  userParts.push({
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  });

  const contents = [...history.flatMap((h) => h.parts), ...userParts];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
    config: { systemInstruction: SYSTEM_TUNING },
  });

  if (response.text) {
    history.push({
      role: "user",
      parts: userParts,
    });
    history.push({
      role: "model",
      parts: [{ text: response.text }],
    });

    await saveHistory(waId, history.slice(-MAX_HISTORY));
  }

  return response.text || "Maaf, aku belum mengerti.";
}

// only text
export async function askGeminiText(text: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: text,
    config: {
      systemInstruction: SYSTEM_TUNING,
    },
  });

  return response.text || "Maaf, aku belum mengerti.";
}

// image & optional caption
export async function askGeminiImage(
  imageBase64: string,
  mimeType = "image/jpeg",
  caption?: string | null
): Promise<string> {
  const filename = `/tmp/waimg_${Date.now()}.${mimeType.split("/")[1]}`;
  await fs.writeFile(filename, Buffer.from(imageBase64, "base64"));

  const image = await ai.files.upload({ file: filename });

  if (!image || !image.uri || !image.mimeType) {
    await fs.unlink(filename);
    return "Maaf, gambar gagal diproses. Coba gambar lain.";
  }

  const userContents = [
    caption || "nih",
    createPartFromUri(image.uri, image.mimeType),
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [createUserContent(userContents)],
    config: {
      systemInstruction: SYSTEM_TUNING,
    },
  });

  await fs.unlink(filename);
  return response.text || "Maaf, aku belum mengerti.";
}
