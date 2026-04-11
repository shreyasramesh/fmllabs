/** Client-side resize + JPEG recompress to stay under API limits. */

export function estimateBase64Bytes(value: string): number {
  const noPadding = value.replace(/=+$/, "");
  return Math.floor((noPadding.length * 3) / 4);
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image file."));
    };
    image.src = objectUrl;
  });
}

export async function compressImageForUpload(
  file: File,
  maxBytes = 5 * 1024 * 1024
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize image processor.");

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * scale));
  let height = Math.max(1, Math.round(image.height * scale));
  const outputMimeType = "image/jpeg";

  const toDataUrl = (quality: number): string => {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(outputMimeType, quality);
  };

  let dataUrl = "";
  let quality = 0.88;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    dataUrl = toDataUrl(quality);
    const b64 = dataUrl.split(",")[1] ?? "";
    if (estimateBase64Bytes(b64) <= maxBytes) {
      return { dataUrl, base64: b64, mimeType: outputMimeType };
    }
    if (quality > 0.52) {
      quality -= 0.08;
    } else {
      width = Math.max(640, Math.round(width * 0.85));
      height = Math.max(640, Math.round(height * 0.85));
    }
  }

  const fallbackBase64 = dataUrl.split(",")[1] ?? "";
  if (fallbackBase64 && estimateBase64Bytes(fallbackBase64) <= maxBytes) {
    return { dataUrl, base64: fallbackBase64, mimeType: outputMimeType };
  }
  throw new Error("Image is too large after compression. Try a closer photo or lower resolution.");
}
