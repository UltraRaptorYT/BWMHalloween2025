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
    for (const line of lines) controller.enqueue(line);
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
  const serialPortRef = useRef<SerialPort | null>(null);
  const serialReader = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const isConnectingRef = useRef(false);
  const [connecting, setConnecting] = useState(false);

  const animationFrameId = useRef<number>(0);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const gamepadIndex = useRef<number | null>(null);
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

  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (serialReader.current) {
            try {
              await serialReader.current.cancel();
            } catch {}
            try {
              serialReader.current.releaseLock();
            } catch {}
            serialReader.current = null;
          }
          if (serialPortRef.current) {
            try {
              await serialPortRef.current.close();
            } catch {}
            serialPortRef.current = null;
          }
        } catch (e) {
          console.error("Error closing serial:", e);
        }
      })();
    };
  }, []);

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

  const connectSerial = async (incomingPort?: SerialPort) => {
    try {
      if (isConnectingRef.current) return;
      isConnectingRef.current = true;
      setConnecting(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serialAPI = (navigator as Navigator & { serial?: any }).serial;
      if (!serialAPI) {
        console.error("Web Serial not available (use Chrome/Edge over HTTPS).");
        return;
      }

      const port: SerialPort = incomingPort ?? (await serialAPI.requestPort());

      if (!port.readable || !port.writable) {
        await port.open({ baudRate: 9600 });
      }

      serialPortRef.current = port;
      setSerialConnected(true);

      // Already have a read loop wired
      if (serialReader.current) return;

      const textDecoder = new TextDecoderStream();
      const portReadable = port.readable as ReadableStream<Uint8Array>;
      const decoderWritable =
        textDecoder.writable as unknown as WritableStream<Uint8Array>;
      portReadable.pipeTo(decoderWritable).catch(() => {
        // swallow close errors
      });

      const lineStream = textDecoder.readable.pipeThrough(
        new TransformStream(new LineBreakTransformer())
      );
      const reader = lineStream.getReader();
      serialReader.current = reader;

      // 🔁 Read forever
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value == null) continue;

            const line = value.trim();
            console.log("[Serial]", line);

            // ⬇️ Ignore serial triggers during the 3s cooldown after game end
            const now = Date.now();
            if (now < serialBlockUntilRef.current) {
              // Still in "cooldown" – read but ignore
              continue;
            }

            // 👉 Only affect game if NOT already started and no countdown running
            if (
              line.toLowerCase() === "halloween" &&
              !gameStartRef.current && // game not running
              countdownRef.current === null // no countdown in progress
            ) {
              startGame();
            }
          }
        } catch (e) {
          console.error("Serial read error:", e);
        } finally {
          try {
            reader.releaseLock();
          } catch {}
          serialReader.current = null;
          setSerialConnected(false);
        }
      })();
    } catch (err) {
      console.error("Serial connection failed:", err);
    } finally {
      isConnectingRef.current = false;
      setConnecting(false);
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
          serialBlockUntilRef.current = Date.now() + 3000;
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
  const gameOverRef = useRef(gameOver);
  const countdownRef = useRef<number | null>(countdown);
  const serialBlockUntilRef = useRef<number>(0);

  useEffect(() => {
    gameStartRef.current = gameStart;
  }, [gameStart]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (serialReader.current) {
            try {
              await serialReader.current.cancel();
            } catch {}
            try {
              serialReader.current.releaseLock();
            } catch {}
            serialReader.current = null;
          }
          if (serialPortRef.current) {
            // Only close if it's open (readable/writable non-null)
            if (
              serialPortRef.current.readable ||
              serialPortRef.current.writable
            ) {
              try {
                await serialPortRef.current.close();
              } catch {}
            }
            serialPortRef.current = null;
          }
        } catch (e) {
          console.error("Error closing serial:", e);
        }
      })();
    };
  }, []);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serialAPI = (navigator as Navigator & { serial?: any }).serial;
      if (!serialAPI || isConnectingRef.current || serialConnected) return;

      const ports: SerialPort[] = await serialAPI.getPorts();
      if (ports.length > 0) {
        console.log("Auto-connecting to saved port...");
        await connectSerial(ports[0]);
      }
    })();
  }, [serialConnected]);

  return (
    <div className="mountainBG w-full fullHeight relative overflow-hidden flex text-white">
      {gamepadConnected && (
        <div className="absolute bottom-4 left-4 text-xl font-bold z-10 opacity-25">
          Gamepad Connected
        </div>
      )}

      {serialConnected && (
        <div className="absolute bottom-4 right-4 text-xl font-bold z-10 opacity-25">
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
            <Button onClick={() => startGame()}>Start Game</Button>
            <Button
              onClick={() => connectSerial(undefined)}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Connect Serial"}
            </Button>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <h1 className="text-4xl font-bold mb-4">Game Over</h1>
            <p className="text-xl mb-6">Final Score: {score}</p>
            <Button onClick={() => startGame()}>Play Again</Button>
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
