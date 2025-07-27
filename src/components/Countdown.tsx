"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Countdown({
  message = "",
  onComplete,
  numbers = ["3", "2", "1"],
}: {
  message?: string;
  onComplete?: () => void;
  numbers?: string[];
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= numbers.length) {
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setIndex((prev) => prev + 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [index, numbers.length, onComplete]);

  if (index >= numbers.length) return null;

  return (
    <div className="fixed inset-0 flex justify-center items-center bg-black/50 z-50 flex-col">
      {message && (
        <div className="text-4xl font-semibold text-white mb-4">{message}</div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={numbers[index]}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          exit={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="text-9xl font-extrabold text-white"
        >
          {numbers[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
