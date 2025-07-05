"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Person({
  x,
  y,
  uuid,
  caught,
  state,
  size,
}: {
  x: number;
  y: number;
  uuid: string;
  caught: boolean;
  state: "climbing" | "falling";
  size: number;
}) {
  const [gifUrl, setGifUrl] = useState<string>("");
  const prevUrl = useRef<string>("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${state}.gif`, { cache: "force-cache", signal: controller.signal })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);

        // Clean up old URL if it exists
        if (prevUrl.current) {
          URL.revokeObjectURL(prevUrl.current);
        }

        prevUrl.current = url;
        setGifUrl(url);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [uuid, state]);

  return (
    <motion.div
      className={cn(
        `absolute bg-no-repeat bg-center people`,
        state === "falling" ? "bg-cover glow-cyan" : "bg-contain glow-orange"
      )}
      style={{
        left: x,
        top: y,
        backgroundImage: `url(${gifUrl})`,
        opacity: caught ? 0.3 : 1,
        width: size,
        height: size,
      }}
    />
  );
}
