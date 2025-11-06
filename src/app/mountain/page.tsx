"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, animate } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Basket } from "@/components/Basket";
import { Person } from "@/components/Person";
import { v4 as uuidv4 } from "uuid";
import "./mountain.css";

type PersonState = "climbing" | "falling";

type PersonType = {
  id: string;
  x: number;
  y: number;
  caught: boolean;
  state: PersonState;
  minClimbY: number;
  maxClimbY: number;
  flipChance: number; // chance to flip to falling each frame
};

// --- line splitter for Web Serial text stream ---
class LineBreakTransformer {
  private container = "";
  transform(
    chunk: string,
    controller: TransformStreamDefaultController<string>
  ) {
    this.container += chunk;
    const lines = this.container.split(/\r?\n/);
    this.container = lines.pop() ?? "";
    for (const l of lines) controller.enqueue(l);
  }
  flush(controller: TransformStreamDefaultController<string>) {
    if (this.container) controller.enqueue(this.container);
  }
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
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const gamepadIndex = useRef<number | null>(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const basketX = useMotionValue(0);
  const basketWidth = 180;
  const basketHeight = 100;
  const basketY =
    typeof window !== "undefined" ? window.innerHeight - basketHeight - 10 : 0;
  const moveSpeed = 75;
  const fallSpeed = 2;
  const climbSpeed = 1;
  const personSize = 200;
  const spawnTiming = 1000;
  const maxPeople = 6;

  const keysPressed = useRef({ left: false, right: false });

  const triggeredRef = useRef(false);
  const lastTriggerAtRef = useRef(0);
  const lastSeenHalloweenAtRef = useRef(0);

  const TRIGGER_COOLDOWN_MS = 1200;
  const RELEASE_SILENCE_MS = 400;

  // Preload Images
  useEffect(() => {
    const imgs = ["climbing.gif", "falling.gif"];
    imgs.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      setGamepadConnected(true);
      gamepadIndex.current = e.gamepad.index;
    };

    const handleGamepadDisconnected = () => {
      setGamepadConnected(false);
      gamepadIndex.current = null;
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener(
        "gamepaddisconnected",
        handleGamepadDisconnected
      );
    };
  }, []);

  useEffect(() => {
    const centerX = window.innerWidth / 2 - basketWidth / 2;
    basketX.set(centerX);
  }, [basketX]);

  const connectSerial = async (port: SerialPort | null = null) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serialAPI = (navigator as Navigator & { serial?: any }).serial;
      if (!serialAPI) throw new Error("Web Serial API not available");

      if (!port) {
        // must be called from a user gesture handler
        port = await serialAPI.requestPort();
      }

      await port?.open({ baudRate: 9600 });
      setSerialConnected(true);

      // bytes -> text -> lines
      const textDecoder = new TextDecoderStream();
      const lineTransformer = new LineBreakTransformer();
      const lineStream = new TransformStream<string, string>({
        transform: (chunk, controller) =>
          lineTransformer.transform(chunk, controller),
        flush: (controller) => lineTransformer.flush(controller),
      });

      // @ts-ignore piping type
      port.readable?.pipeTo(textDecoder.writable).catch(() => {});
      // @ts-ignore piping type
      textDecoder.readable?.pipeTo(lineStream.writable).catch(() => {});

      const reader = lineStream.readable.getReader();
      serialReader.current = reader;

      (async () => {
        const halloweenRegex = /\bhalloween\b/i; // match 'Text: halloween' or bare 'halloween'
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;

            const line = String(value).trim();
            const now = performance.now();

            if (halloweenRegex.test(line)) {
              lastSeenHalloweenAtRef.current = now;

              // edge-trigger: only the first 'halloween' after silence starts the game
              const cooled =
                now - lastTriggerAtRef.current >= TRIGGER_COOLDOWN_MS;
              if (!triggeredRef.current && cooled) {
                triggeredRef.current = true;
                lastTriggerAtRef.current = now;

                if (!gameStartRef.current && !gameOverRef.current) {
                  startGame();
                } else if (gameOverRef.current) {
                  startGame();
                }
              }
            } else {
              // if we see non-halloween lines, just check if enough silence elapsed
              // (many readers spam only the same line; the silence check happens in the timer below)
            }
          }
        } catch {
          // reader aborted/closed
        } finally {
          try {
            reader.releaseLock();
          } catch {}
        }
      })();

      // Re-arm logic: a lightweight interval that watches for "silence"
      // i.e., no 'halloween' lines for RELEASE_SILENCE_MS
      const rearmInterval = window.setInterval(() => {
        const now = performance.now();
        // If we have been triggered, only clear when halloween disappeared for a while
        if (
          triggeredRef.current &&
          now - lastSeenHalloweenAtRef.current >= RELEASE_SILENCE_MS
        ) {
          triggeredRef.current = false; // allow next trigger on next approach
        }
      }, 50);

      // Clean up the interval when page unmounts or when serial disconnects
      const stopRearm = () => window.clearInterval(rearmInterval);
      // store a handle if you want to stop it elsewhere; otherwise it's fine as-is
      // (You can also call stopRearm() in a disconnectSerial helper)
    } catch (err) {
      console.error("Serial connection failed:", err);
      setSerialConnected(false);
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      handleRestart();
    }

    const timeout = setTimeout(() => {
      setCountdown((prev) => (prev ?? 1) - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [countdown]);

  function startGame() {
    setCountdown(3);
  }

  useEffect(() => {
    const tryAutoConnect = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serialAPI = (navigator as Navigator & { serial: any }).serial;
      const ports = await serialAPI.getPorts();
      if (ports.length > 0) {
        console.log("Auto-connecting to saved port...");
        connectSerial(ports[0]);
      }
    };

    tryAutoConnect();
  }, []);

  useEffect(() => {
    if (!gameStart || gameOver) return;

    const moveLoop = () => {
      const current = basketX.get();
      const maxX = window.innerWidth - basketWidth;

      let newX = current;

      let left = false;
      let right = false;

      let gamepad = null;
      if (gamepadIndex.current !== null) {
        gamepad = navigator.getGamepads()[gamepadIndex.current];
        if (gamepad) {
          const threshold = 0.1;
          const axis = gamepad.axes[0];

          if (axis < -threshold) left = true;
          if (axis > threshold) right = true;
        }
      }

      if (keysPressed.current.left) left = true;
      if (keysPressed.current.right) right = true;

      if (left) newX -= moveSpeed * (gamepad ? 1.25 : 1);
      if (right) newX += moveSpeed * (gamepad ? 1.25 : 1);

      newX = Math.max(0, Math.min(maxX, newX));
      animate(basketX, newX, { duration: 0.1, ease: "linear" });

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

  useEffect(() => {
    const handleGameStartKey = (e: KeyboardEvent) => {
      if (e.key === "`" && !gameStart && !gameOver) {
        setGameStart(true);
      }
    };

    window.addEventListener("keydown", handleGameStartKey);
    return () => {
      window.removeEventListener("keydown", handleGameStartKey);
    };
  }, []);

  const handleRestart = () => {
    requestAnimationFrame(() => {
      const centerX = window.innerWidth / 2 - basketWidth / 2;
      basketX.set(centerX);
    });

    keysPressed.current.left = false;
    keysPressed.current.right = false;
    setScore(0);
    setTimer(commonTimer);
    setGameOver(false);
    setCountdown(null);
    setGameStart(true);

    triggeredRef.current = true;
    lastTriggerAtRef.current = performance.now();
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
          serialDetectedRef.current = false;
          setGameStart(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStart, gameOver]);

  function spawnNewPerson() {
    setPeople((prev) => {
      if (prev.length >= maxPeople) return prev;

      const newPerson: PersonType = {
        id: uuidv4(),
        x:
          Math.random() * (window.innerWidth - personSize * 2) + personSize / 2,
        y: window.innerHeight + personSize + Math.random() * personSize,
        caught: false,
        state: "climbing",
        minClimbY: Math.random() * 200 + 100, // climb to at least Y=100–300
        maxClimbY: Math.random() * 200 + 300, // flip if Y < 300–500
        flipChance: Math.random() * 0.01 + 0.005, // random flip chance per frame (0.5%–1.5%)
      };

      return [...prev, newPerson];
    });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      spawnNewPerson();
    }, spawnTiming);

    return () => clearInterval(interval);
  }, []);

  const checkCollision = (px: number, py: number) => {
    const bx = basketX.get();
    return (
      py + personSize >= basketY &&
      py <= basketY + basketHeight &&
      px + personSize >= bx &&
      px <= bx + basketWidth &&
      gameStartRef.current
    );
  };

  useEffect(() => {
    const loop = () => {
      setPeople((prev) => {
        const updated: PersonType[] = [];

        for (const p of prev) {
          if (p.caught) continue;

          let nextY = p.y;

          if (p.state === "climbing") {
            nextY -= climbSpeed;

            const shouldFlip =
              nextY <= p.minClimbY ||
              (nextY <= p.maxClimbY && Math.random() < p.flipChance);

            if (shouldFlip) {
              updated.push({ ...p, state: "falling" });
              continue;
            }

            if (nextY > -40) {
              updated.push({ ...p, y: nextY });
            }
          } else if (p.state === "falling") {
            nextY += fallSpeed;
            const isCaught = checkCollision(p.x, nextY);
            if (isCaught) {
              setScore((s) => s + 1);
              continue;
            }
            if (nextY < window.innerHeight) {
              updated.push({ ...p, y: nextY });
            }
          }
        }

        return updated;
      });

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId.current!);
  }, [checkCollision]);

  const gameStartRef = useRef(gameStart);
  const serialDetectedRef = useRef(false);
  const gameOverRef = useRef(gameOver);

  useEffect(() => {
    gameStartRef.current = gameStart;
  }, [gameStart]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  return (
    <div className="mountainBG w-full fullHeight relative overflow-hidden flex text-white">
      {gamepadConnected && (
        <div className="absolute bottom-4 left-4 text-xl font-bold z-10">
          Gamepad Connected
        </div>
      )}

      {serialConnected && (
        <div className="absolute bottom-4 right-4 text-xl font-bold z-10">
          Serial Connected
        </div>
      )}

      {countdown !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-30">
          <h1 className="text-4xl font-bold mb-4">Lantern Detected</h1>
          <div
            key={countdown}
            className="text-9xl font-extrabold text-white countdown-number"
          >
            {countdown}
          </div>
        </div>
      )}

      <div>
        {!gameStart && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-4">
            <Button onClick={() => setCountdown(3)}>Start Game</Button>
            <Button onClick={() => connectSerial()}>Connect RFID Reader</Button>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <h1 className="text-4xl font-bold mb-4">Game Over</h1>
            <p className="text-xl mb-6">Final Score: {score}</p>
            <Button onClick={handleRestart}>Play Again</Button>
          </div>
        )}
        <div className="absolute top-4 left-4 text-xl font-bold z-10">
          Score: {score}
        </div>
        <div className="absolute top-4 right-4 text-xl font-bold z-10">
          Time: {timer}s
        </div>
      </div>
      {gameStart && (
        <Basket
          x={basketX}
          y={basketY}
          cartHeight={basketHeight}
          cartWidth={basketWidth}
        />
      )}
      <div id="peopleDiv" className="grow-1">
        {people.map((p) => (
          <Person
            key={p.id}
            uuid={p.id}
            x={p.x}
            y={p.y}
            caught={p.caught}
            state={p.state}
            size={personSize}
          />
        ))}
      </div>
    </div>
  );
}
