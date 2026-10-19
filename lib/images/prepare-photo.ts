const maxEdge = 1600;
const maxBytes = 10 * 1024 * 1024;

/** Resizes a JPEG or PNG and re-encodes it so GPS and other EXIF data are removed. */
export async function preparePhoto(file: File) {
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    throw new Error("Use a JPEG or PNG photo.");
  }
  if (file.size > maxBytes) {
    throw new Error("That photo is over 10 MB. Choose a smaller one.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the photo.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });
  if (!blob) {
    throw new Error("This browser could not prepare the photo.");
  }
  if (blob.size > maxBytes) {
    throw new Error("That photo is still over 10 MB after resizing. Choose a smaller one.");
  }

  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
