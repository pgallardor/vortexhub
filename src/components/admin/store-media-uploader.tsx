"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";

type AssetType = "store_logo" | "event_banner";

const constraints = {
  store_logo: {
    minWidth: 256,
    minHeight: 256,
    outputWidth: 512,
    outputHeight: 512,
    label: "Subir logo",
  },
  event_banner: {
    minWidth: 1200,
    minHeight: 675,
    outputWidth: 1600,
    outputHeight: 900,
    label: "Subir banner",
  },
} satisfies Record<AssetType, {
  minWidth: number;
  minHeight: number;
  outputWidth: number;
  outputHeight: number;
  label: string;
}>;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No pudimos leer la imagen."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No pudimos optimizar la imagen."));
        return;
      }
      resolve(blob);
    }, "image/webp", 0.86);
  });
}

async function optimizeImage(file: File, assetType: AssetType) {
  const config = constraints[assetType];
  const image = await loadImage(file);

  if (image.naturalWidth < config.minWidth || image.naturalHeight < config.minHeight) {
    throw new Error(`La imagen debe medir al menos ${config.minWidth} x ${config.minHeight} px.`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = config.outputWidth;
  canvas.height = config.outputHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("El navegador no pudo preparar la imagen.");

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = config.outputWidth / config.outputHeight;
  const sourceWidth = sourceRatio > targetRatio
    ? image.naturalHeight * targetRatio
    : image.naturalWidth;
  const sourceHeight = sourceRatio > targetRatio
    ? image.naturalHeight
    : image.naturalWidth / targetRatio;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    config.outputWidth,
    config.outputHeight,
  );

  return {
    blob: await canvasToBlob(canvas),
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export function StoreMediaUploader({
  assetType,
  storeId,
}: {
  assetType: AssetType;
  storeId: string;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setErrorMessage(null);
    setIsUploading(true);

    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Usa una imagen JPEG, PNG o WebP.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("La imagen no puede superar 5 MB.");
      }

      const optimized = await optimizeImage(file, assetType);
      const optimizedFile = new File([optimized.blob], "optimized.webp", { type: "image/webp" });
      const formData = new FormData();
      formData.set("assetType", assetType);
      formData.set("sourceFile", file);
      formData.set("optimizedFile", optimizedFile);
      formData.set("width", String(optimized.width));
      formData.set("height", String(optimized.height));

      const response = await fetch(`/api/v1/stores/${storeId}/media`, {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error?.message ?? "No pudimos subir la imagen.");
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="media-uploader">
      <label className={`button ${assetType === "store_logo" ? "button-secondary" : "button-primary"}`}>
        <input accept="image/jpeg,image/png,image/webp" disabled={isUploading} onChange={onFileChange} type="file" />
        {isUploading ? "Subiendo..." : constraints[assetType].label}
      </label>
      <p>
        {assetType === "store_logo"
          ? "JPG, PNG o WebP. Mínimo 256 x 256 px."
          : "JPG, PNG o WebP. Mínimo 1200 x 675 px."}
      </p>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
    </div>
  );
}
