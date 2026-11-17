// Reduce la foto antes de subirla (los celulares generan fotos de 5 a 10 MB)
export async function comprimirImagen(
  archivo: File,
  maxLado = 1600,
  calidad = 0.8
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    throw new Error("No se pudo leer la imagen. Prueba con otra foto (JPG o PNG).");
  }
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolver, rechazar) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolver(blob) : rechazar(new Error("No se pudo procesar la imagen.")),
      "image/jpeg",
      calidad
    )
  );
}
