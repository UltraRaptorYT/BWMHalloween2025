"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    // Fetch base image from cache and turn into a blob
    const controller = new AbortController();

    fetch(`${state}.gif`, { cache: "force-cache", signal: controller.signal })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setGifUrl(url);
      });

    return () => {
      // Clean up old blob when uuid changes
      URL.revokeObjectURL(gifUrl);
      controller.abort();
    };
  }, [uuid, state]);

  return (
    <motion.div
      className={cn(
        `absolute bg-no-repeat bg-center`,
        state === "falling" ? "bg-cover glow" : "bg-contain"
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
