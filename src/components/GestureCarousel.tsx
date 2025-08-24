"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { toast } from "sonner";

// Declare MediaPipe types as global
declare global {
  interface Window {
    Hands: any;
  }
}

// Define the Results type locally
interface Results {
  multiHandLandmarks?: Array<
    Array<{
      x: number;
      y: number;
      z: number;
    }>
  >;
  multiHandWorldLandmarks?: any;
  multiHandedness?: any;
  image?: any;
}

interface GestureCarouselProps {
  images: string[];
  onBack: () => void;
}

export default function GestureCarousel({
  images,
  onBack,
}: GestureCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGestureEnabled, setIsGestureEnabled] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<string>("Initializing...");
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSwipeTimeRef = useRef<number>(0);
  const swipeThresholdRef = useRef<number>(0.15);

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const onResults = useCallback(
    (results: Results) => {
      if (!canvasRef.current) return;

      const canvasCtx = canvasRef.current.getContext("2d")!;
      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setGestureStatus("Hand detected - Swipe left or right!");

        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const wrist = landmarks[0];

        // Calculate hand direction based on index finger position relative to wrist
        const handDirection = indexTip.x - wrist.x;
        const currentTime = Date.now();

        // Detect swipe gestures based on hand movement
        if (currentTime - lastSwipeTimeRef.current > 1000) {
          if (handDirection > swipeThresholdRef.current) {
            // Swipe right - go to next image
            nextImage();
            lastSwipeTimeRef.current = currentTime;
            setGestureStatus("Swipe right detected! Next image →");
            toast.success("RIGHT");
          } else if (handDirection < -swipeThresholdRef.current) {
            // Swipe left - go to previous image
            prevImage();
            lastSwipeTimeRef.current = currentTime;
            setGestureStatus("Swipe left detected! ← Previous image");
            toast.error("LEFT");
          }
        }
      } else {
        setGestureStatus("Show your hand to control the carousel");
      }

      canvasCtx.restore();
    },
    [nextImage, prevImage]
  );

  // Load MediaPipe scripts
  useEffect(() => {
    const loadScripts = async () => {
      try {
        // Check if scripts are already loaded
        if (window.Hands) {
          setScriptsLoaded(true);
          return;
        }

        // Create script elements
        const scripts = [
          "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
        ];

        const loadScript = (src: string): Promise<void> => {
          return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
          });
        };

        // Load scripts sequentially
        for (const src of scripts) {
          await loadScript(src);
        }

        setScriptsLoaded(true);
      } catch (error) {
        console.error("Failed to load MediaPipe scripts:", error);
        setGestureStatus("Failed to load gesture recognition");
      }
    };

    loadScripts();
  }, []);

  // Initialize MediaPipe and camera after scripts are loaded
  useEffect(() => {
    if (!scriptsLoaded || !videoRef.current || !canvasRef.current) return;

    const initializeMediaPipe = async () => {
      try {
        // Initialize MediaPipe Hands using the global window object
        const hands = new window.Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);
        handsRef.current = hands;

        // Use getUserMedia to access the camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 320,
            height: 240,
            facingMode: "user",
          },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Wait for video to be ready
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => resolve(undefined);
            }
          });

          // Process frames
          const processFrame = async () => {
            if (videoRef.current && handsRef.current && streamRef.current) {
              await handsRef.current.send({ image: videoRef.current });
              animationFrameRef.current = requestAnimationFrame(processFrame);
            }
          };

          // Start processing
          processFrame();
          setIsGestureEnabled(true);
          setGestureStatus("Camera initialized - Show your hand!");
        }
      } catch (error) {
        console.error("Failed to initialize camera or MediaPipe:", error);
        setGestureStatus("Failed to access camera. Please check permissions.");
      }
    };

    initializeMediaPipe();

    // Cleanup function
    return () => {
      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Stop all camera tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Clear the video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [scriptsLoaded, onResults]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        prevImage();
      } else if (event.key === "ArrowRight") {
        nextImage();
      } else if (event.key === "Escape") {
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [nextImage, prevImage, onBack]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/50 backdrop-blur-sm">
        <div className="flex justify-between items-center p-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload New Images
          </Button>

          <div className="text-white text-center">
            <div className="text-sm opacity-75">
              {currentIndex + 1} of {images.length}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={prevImage}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={nextImage}
              className="text-white hover:bg-white/20"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Image */}
      <div className="flex-1 flex items-center justify-center p-16 h-full">
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Gesture Control Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/50 backdrop-blur-sm">
        <div className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-24 h-18 bg-gray-800 rounded mirror"
                  autoPlay
                  playsInline
                  muted
                  style={{ transform: "scaleX(-1)" }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-24 h-18"
                  width={320}
                  height={240}
                />
              </div>
              <div className="text-white">
                <div className="text-sm font-medium">Gesture Control</div>
                <div className="text-xs opacity-75">{gestureStatus}</div>
              </div>
            </div>

            <div className="text-white text-sm opacity-75">
              Use arrow keys or hand gestures to navigate
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
