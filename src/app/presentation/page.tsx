"use client";

import { useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import GestureCarousel from "@/components/GestureCarousel";

export default function Home() {
  const [images, setImages] = useState<string[]>([]);

  const handleImagesUpload = (uploadedImages: string[]) => {
    setImages(uploadedImages);
  };

  return (
    <main className="min-h-screen bg-background">
      {images.length === 0 ? (
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-bold text-center mb-8">
            Gesture-Controlled Image Carousel
          </h1>
          <ImageUploader onImagesUpload={handleImagesUpload} />
        </div>
      ) : (
        <GestureCarousel images={images} onBack={() => setImages([])} />
      )}
    </main>
  );
}
