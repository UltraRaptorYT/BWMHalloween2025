"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [bars, setBars] = useState<number[]>([]);
  const [threshold] = useState(0.8);
  const [talking, setTalking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const visualize = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

    const timeData = dataArrayRef.current;
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      const val = (timeData[i] - 128) / 128; // normalize to [-1, 1]
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / timeData.length) * 100;
    setTalking(rms > threshold);

    if (rms > threshold) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const values = Array.from(dataArrayRef.current);
      const numBars = 32;
      const step = Math.floor(values.length / numBars);
      const barHeights = Array.from(
        { length: numBars },
        (_, i) => values[i * step] / 2
      );
      setBars(barHeights);
    } else {
      setBars(Array(32).fill(2)); // Flat quiet bars
    }

    animationFrameRef.current = requestAnimationFrame(visualize);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    visualize();

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      cancelAnimationFrame(animationFrameRef.current!);
      audioContext.close();

      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setTranscript(data.text);
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🎤 Transcription App</h1>

      <div className="flex items-center gap-4 mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={recording ? stopRecording : startRecording}
        >
          {recording ? "Stop Recording" : "Start Recording"}
        </button>

        <span
          className={`text-sm ${talking ? "text-green-500" : "text-gray-400"}`}
        >
          {talking ? "Speaking..." : "Silent"}
        </span>
      </div>

      {/* 🔊 Soundbar visual */}
      <div className="flex items-end gap-1 h-24 mb-6">
        {bars.map((height, idx) => (
          <div
            key={idx}
            className="w-1 bg-pink-500 rounded transition-all duration-75"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>

      <p className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
        {transcript || "Transcript will appear here..."}
      </p>
    </main>
  );
}
