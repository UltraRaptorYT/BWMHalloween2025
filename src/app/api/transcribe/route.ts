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
        "Generate a transcript of the speech. If there is chinese characters in the transcript, use Simplified Chinese Characters instead. If any swear words are used, censor it using *.",
      ]),
    });

    const text = result.text;

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
