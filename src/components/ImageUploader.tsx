"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";

interface ImageUploaderProps {
  onImagesUpload: (images: string[]) => void;
}

export default function ImageUploader({ onImagesUpload }: ImageUploaderProps) {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const newImages: string[] = [];

      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              newImages.push(e.target.result as string);
              if (newImages.length === files.length) {
                setSelectedImages((prev) => [...prev, ...newImages]);
              }
            }
          };
          reader.readAsDataURL(file);
        }
      });
    },
    []
  );

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startCarousel = () => {
    if (selectedImages.length > 0) {
      onImagesUpload(selectedImages);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Images</CardTitle>
          <CardDescription>
            Select multiple images to create your gesture-controlled carousel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, JPEG (MAX. 10MB each)
                  </p>
                </div>
                <Input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            {selectedImages.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Selected Images ({selectedImages.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`Selected ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button onClick={startCarousel} size="lg" className="w-full">
                  Start Gesture Carousel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
