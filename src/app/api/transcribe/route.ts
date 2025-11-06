import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import { writeFile } from "fs/promises";
import path from "path";
import os from "os";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY! // Must allow write access to storage
);

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
    const fileExt = file.name.split(".").pop();
    const filename = `${Date.now()}.${fileExt || "webm"}`;
    const tempPath = path.join(os.tmpdir(), filename);
    await writeFile(tempPath, buffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("bwm-halloween")
      .upload(filename, buffer, {
        contentType: file.type || "audio/webm",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError.message);
      return NextResponse.json(
        { error: "Failed to upload to storage." },
        { status: 500 }
      );
    }

    const supabaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bwm-halloween/${filename}`;

    // Upload to Gemini
    const uploaded = await genAI.files.upload({
      file: tempPath,
      config: { mimeType: file.type || "audio/webm" },
    });

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: createUserContent([
        createPartFromUri(uploaded.uri || "", uploaded.mimeType || ""),
        "Generate a transcript of the speech primarily in English. If any parts are spoken in Chinese, transcribe them using Simplified Chinese characters. Censor any swear words using asterisks (e.g., ****). Prefer English when the meaning is ambiguous or when both languages are used.",
      ]),
    });

    const text = result.text;

    const { data: tableData, error: insertError } = await supabase
      .from("bwm-halloween-2025")
      .insert({
        message: text,
        file: supabaseUrl,
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError.message);
      return NextResponse.json(
        { error: "Failed to upload to storage." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      text,
      audioUrl: supabaseUrl, // optionally return the public URL
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
