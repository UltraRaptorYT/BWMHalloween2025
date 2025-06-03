"use client";

import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { motion } from "framer-motion";

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
  useEffect(() => {
    const imgs = [`climbing.gif?${uuid}`, `falling.gif?${uuid}`];
    imgs.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return (
    <motion.div
      className={cn(
        `absolute bg-no-repeat bg-center`,
        state === "falling" ? "bg-cover glow" : "bg-contain"
      )}
      style={{
        left: x,
        top: y,
        backgroundImage: `url(${state}.gif#${uuid})`,
        opacity: caught ? 0.3 : 1,
        width: size,
        height: size,
      }}
    />
  );
}
