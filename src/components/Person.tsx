"use client";

import { motion } from "framer-motion";

export function Person({
  x,
  y,
  caught,
  gif = "/globe.svg",
}: {
  x: number;
  y: number;
  caught: boolean;
  gif?: string;
}) {
  return (
    <motion.div
      className="absolute w-10 h-10 bg-no-repeat bg-contain"
      style={{
        left: x,
        top: y,
        backgroundImage: `url(${gif})`,
        opacity: caught ? 0.3 : 1,
      }}
    />
  );
}
