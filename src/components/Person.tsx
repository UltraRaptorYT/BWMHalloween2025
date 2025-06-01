"use client";

import { motion } from "framer-motion";

export function Person({
  x,
  y,
  caught,
  state,
  gif = "/globe.svg",
  size,
}: {
  x: number;
  y: number;
  caught: boolean;
  state: "climbing" | "falling";
  gif?: string;
  size: number;
}) {
  return (
    <motion.div
      className={`absolute bg-no-repeat bg-contain ${
        state === "climbing" ? "bg-blue-500" : "bg-amber-500"
      }`}
      style={{
        left: x,
        top: y,
        backgroundImage: `url(${gif})`,
        opacity: caught ? 0.3 : 1,
        width: size,
        height: size,
      }}
    />
  );
}
