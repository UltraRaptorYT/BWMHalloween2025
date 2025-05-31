"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, animate } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Basket } from "@/components/Basket";
import { Person } from "@/components/Person";
import { v4 as uuidv4 } from "uuid";

type PersonType = {
  id: string;
  x: number;
  y: number;
  caught: boolean;
};

interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}

export default function Mountain() {
  const [gameStart, setGameStart] = useState(false);
  const [people, setPeople] = useState<PersonType[]>([]);
  const [score, setScore] = useState(0);
  const commonTimer = 30;
  const [timer, setTimer] = useState(commonTimer);
  const [gameOver, setGameOver] = useState(false);
  const serialReader = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const animationFrameId = useRef<number>(0);

  const basketX = useMotionValue(0);
  const basketWidth = 160;
  const basketHeight = 56;
  const basketY =
    typeof window !== "undefined" ? window.innerHeight - basketHeight - 10 : 0;
  const moveSpeed = 50;
  const fallSpeed = 2;

  const keysPressed = useRef({ left: false, right: false });

  useEffect(() => {
    const centerX = window.innerWidth / 2 - basketWidth / 2;
    basketX.set(centerX);
  }, []);

  const connectSerial = async () => {
    try {
      const selectedPort = await (navigator as any).serial.requestPort();
      await selectedPort.open({ baudRate: 9600 });

      const decoder = new TextDecoderStream();
      selectedPort.readable?.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();

      serialReader.current = reader;

      const readLoop = async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) parseSerial(value);
        }
      };

      readLoop();
    } catch (err) {
      console.error("Serial connection failed:", err);
    }
  };

  const parseSerial = (line: string) => {
    const match = line.match(/X:(\d+)/);
    if (!match) return;
    const x = parseInt(match[1], 10);
    keysPressed.current.left = x < 400;
    keysPressed.current.right = x > 600;
  };

  useEffect(() => {
    if (!gameStart || gameOver) return;

    const moveLoop = () => {
      const current = basketX.get();
      const maxX = window.innerWidth - basketWidth;

      let newX = current;
      if (keysPressed.current.left) newX -= moveSpeed;
      if (keysPressed.current.right) newX += moveSpeed;

      newX = Math.max(0, Math.min(maxX, newX));
      animate(basketX, newX, { duration: 0.1, ease: "easeOut" });

      animationFrameId.current = requestAnimationFrame(moveLoop);
    };

    animationFrameId.current = requestAnimationFrame(moveLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a")
        keysPressed.current.left = true;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d")
        keysPressed.current.right = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a")
        keysPressed.current.left = false;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d")
        keysPressed.current.right = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      cancelAnimationFrame(animationFrameId.current!);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameStart, gameOver]);

  const handleRestart = () => {
    cancelAnimationFrame(animationFrameId.current!);
    const centerX = window.innerWidth / 2 - basketWidth / 2;
    basketX.set(centerX);
    keysPressed.current.left = false;
    keysPressed.current.right = false;
    setScore(0);
    setTimer(commonTimer);
    setPeople([]);
    setGameOver(false);
    setGameStart(true);
  };

  useEffect(() => {
    if (!gameStart || gameOver) return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          keysPressed.current.left = false;
          keysPressed.current.right = false;
          setGameOver(true);
          setGameStart(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStart, gameOver]);

  useEffect(() => {
    if (!gameStart) return;
    const interval = setInterval(() => {
      const newPerson: PersonType = {
        id: uuidv4(),
        x: Math.random() * (window.innerWidth - 40),
        y: -40,
        caught: false,
      };
      setPeople((prev) => [...prev, newPerson]);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStart]);

  useEffect(() => {
    if (!gameStart) return;
    const loop = () => {
      setPeople((prev) => {
        const updated: PersonType[] = [];
        for (const p of prev) {
          if (p.caught) continue;
          const nextY = p.y + fallSpeed;
          const isCaught = checkCollision(p.x, nextY);
          if (isCaught) {
            setScore((s) => s + 1);
            continue;
          }
          if (nextY < window.innerHeight) {
            updated.push({ ...p, y: nextY });
          }
        }
        return updated;
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, [gameStart]);

  const checkCollision = (px: number, py: number) => {
    const personSize = 40;
    const bx = basketX.get();
    return (
      py + personSize >= basketY &&
      py <= basketY + basketHeight &&
      px + personSize >= bx &&
      px <= bx + basketWidth
    );
  };

  return (
    <div className="mountainBG w-full min-h-screen relative overflow-hidden">
      {!gameStart && !gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4">
          <Button onClick={() => setGameStart(true)}>Start Game</Button>
          <Button onClick={connectSerial}>Connect Joystick</Button>
        </div>
      )}
      {gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-20 text-white">
          <h1 className="text-4xl font-bold mb-4">Game Over</h1>
          <p className="text-xl mb-6">Final Score: {score}</p>
          <Button onClick={handleRestart}>Play Again</Button>
        </div>
      )}
      <div className="absolute top-4 left-4 text-black text-xl font-bold z-10">
        Score: {score}
      </div>
      <div className="absolute top-4 right-4 text-black text-xl font-bold z-10">
        Time: {timer}s
      </div>
      {gameStart && <Basket x={basketX} y={basketY} />}
      {people.map((p) => (
        <Person key={p.id} x={p.x} y={p.y} caught={p.caught} />
      ))}
    </div>
  );
}
