import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import { writeFile } from "fs/promises";
import path from "path";
import os from "os";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!, // Set this in .env.local
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file uploaded." },
        { status: 400 }
      );
    }

    // Save the file temporarily to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), file.name);
    await writeFile(tempPath, buffer);

    // Upload to Gemini
    const uploaded = await genAI.files.upload({
      file: tempPath,
      config: { mimeType: file.type || "audio/webm" },
    });

    // Generate transcript
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: createUserContent([
        createPartFromUri(uploaded.uri || "", uploaded.mimeType || ""),
        "Generate a transcript of the speech primarily in English. If any parts are spoken in Chinese, transcribe them using Simplified Chinese characters. Censor any swear words using asterisks (e.g., ****). Prefer English when the meaning is ambiguous or when both languages are used.",
      ]),
    });

    const text = result.text;

    return NextResponse.json({ text });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
