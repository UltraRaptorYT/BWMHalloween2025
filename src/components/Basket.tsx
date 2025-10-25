"use client";

import {
  motion,
  MotionValue,
  useAnimationFrame,
  useMotionValue,
} from "framer-motion";
import { useEffect, useRef } from "react";

type CartProps = {
  x: MotionValue<number>;
  y: number;
  bodySrc?: string; // cart body image
  wheelSrc?: string; // wheel image (perfect circle, transparent bg)
  cartWidth?: number; // px
  cartHeight?: number; // px
  wheelDiameter?: number; // px (should match your wheel image's visual diameter)
  wheelInsetX?: number; // px from left/right for wheel centers
  wheelInsetY?: number; // px from bottom to wheel center
  className?: string;
};

export function Basket({
  x,
  y,
  bodySrc = "cart_body.png",
  wheelSrc = "cart_wheel.png",
  cartWidth = 180,
  cartHeight = 100,
  wheelDiameter = 36,
  wheelInsetX = 28,
  wheelInsetY = 8,
  className = "",
}: CartProps) {
  // Rotation values for both wheels (kept in sync)
  const wheelRotate = useMotionValue(0);

  // Track previous x to compute dx each frame
  const prevX = useRef<number | null>(null);

  useEffect(() => {
    prevX.current = x.get();
    const unsub = x.on("change", (val) => {
      // keep prevX warm if x changes outside RAF
      if (prevX.current === null) prevX.current = val;
    });
    return () => unsub();
  }, [x]);

  useAnimationFrame((t, deltaMs) => {
    const curr = x.get();
    if (prevX.current == null) {
      prevX.current = curr;
      return;
    }

    const dx = curr - prevX.current; // px moved since last frame
    prevX.current = curr;

    if (dx === 0) return;

    // Convert linear distance to rotational degrees:
    // one full turn per wheel circumference distance
    const circumference = Math.PI * wheelDiameter; // px
    const deltaDeg = (dx / circumference) * 360;

    // Move forward = positive rotation, backward = negative
    wheelRotate.set(wheelRotate.get() + deltaDeg);
  });

  const wheelRadius = wheelDiameter / 2;

  return (
    <motion.div
      className={`absolute select-none pointer-events-none will-change-transform ${className} z-10`}
      style={{ x, top: y, width: cartWidth, height: cartHeight }}
    >
      {/* Cart body */}
      <img
        src={bodySrc}
        alt="Cart body"
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* Left wheel */}
      <motion.img
        src={wheelSrc}
        alt="Wheel"
        className="absolute object-contain"
        style={{
          width: wheelDiameter,
          height: wheelDiameter,
          left: wheelInsetX - wheelRadius,
          bottom: wheelInsetY - wheelRadius,
          rotate: wheelRotate,
        }}
        draggable={false}
      />

      {/* Right wheel */}
      <motion.img
        src={wheelSrc}
        alt="Wheel"
        className="absolute object-contain"
        style={{
          width: wheelDiameter,
          height: wheelDiameter,
          right: wheelInsetX - wheelRadius,
          bottom: wheelInsetY - wheelRadius,
          rotate: wheelRotate,
        }}
        draggable={false}
      />
    </motion.div>
  );
}
