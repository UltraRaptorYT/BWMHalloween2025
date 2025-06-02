"use client";

import { cn } from "@/lib/utils";
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
  return (
    <motion.div
      className={cn(
        `absolute bg-no-repeat bg-contain`,
        state === "falling" && "glow"
      )}
      style={{
        left: x,
        top: y,
        backgroundImage: `url(${state}.gif?${uuid})`,
        backgroundPosition: "center",
        opacity: caught ? 0.3 : 1,
        width: size,
        height: size,
      }}
    />
  );
}
