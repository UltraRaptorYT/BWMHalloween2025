"use client";

import { motion, MotionValue } from "framer-motion";

export function Basket({ x, y }: { x: MotionValue<number>; y: number }) {
  return (
    <motion.div
      className="absolute bg-pink-500 rounded-xl"
      style={{
        x,
        top: y,
        width: 160,
        height: 56,
      }}
    />
  );
}
