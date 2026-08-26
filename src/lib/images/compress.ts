/**
 * Comprime y redimensiona una imagen en el cliente antes de subirla.
 * Reduce fotos pesadas de celulares (4-15 MB) a ~150-250 KB sin pérdida visible de calidad.
 * Esto evita saturar la memoria de Cloudflare Workers (Error 1102).
 */
export async function compressImageClient(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<File> {
  // Si ya es un archivo muy liviano (< 250 KB) y es formato web moderno, no tocamos
  if (file.size <= 250 * 1024 && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calcular nueva escala manteniendo aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback al archivo original si el navegador no soporta 2D context
          resolve(file);
          return;
        }

        // Suavizado de imagen para máxima nitidez
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Preferir formato WebP, fallback a JPEG
        const outputMime = "image/webp";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const compressedFile = new File([blob], cleanName, {
              type: outputMime,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          outputMime,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
