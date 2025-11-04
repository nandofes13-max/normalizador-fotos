import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const app = express();
const port = process.env.PORT || 10000;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

console.log("🔑 CLIPDROP_API_KEY detectada:", CLIPDROP_API_KEY ? "OK ✅" : "NO ❌");

app.use(cors());
app.use(express.static("public"));

// Configurar multer para almacenar archivos temporalmente
const upload = multer({ 
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.post("/procesar", upload.single("imagen"), async (req, res) => {
  const imagen = req.file;

  if (!imagen) {
    console.error("❌ No se recibió ninguna imagen");
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  console.log("📸 Imagen recibida:", imagen.originalname);
  console.log("🧩 Enviando a ClipDrop API...");

  try {
    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(imagen.path));

    // 1. REMOVER FONDO CON CLIPDROP
    const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
      method: "POST",
      headers: {
        "x-api-key": CLIPDROP_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`⚠️ Error ClipDrop API: ${response.status} ${errorText}`);
      return res.status(response.status).json({ error: "Error desde ClipDrop API", detalle: errorText });
    }

    const buffer = await response.arrayBuffer();
    console.log("✅ Fondo removido correctamente.");

    // 2. PROCESAR CON SHARP - RECORTAR, REDIMENSIONAR Y CREAR LIENZO
    const processedImage = await sharp(Buffer.from(buffer))
      .png() // Convertir a PNG para mantener transparencia
      .toBuffer();

    // 3. RECORTAR BORDES TRANSPARENTES AUTOMÁTICAMENTE
    const { data, info } = await sharp(processedImage)
      .trim() // Recorta bordes transparentes automáticamente
      .png()
      .toBuffer({ resolveWithObject: true });

    console.log(`✂️ Imagen recortada: ${info.width}x${info.height}`);

    // 4. CREAR LIENZO CON FONDO BLANCO Y PRODUCTO CENTRADO
    const canvasSize = 800; // Tamaño del lienzo final
    const margin = 50; // Margen alrededor del producto
    
    // Calcular escala para que el producto quepa en el lienzo con márgenes
    const maxProductSize = canvasSize - (margin * 2);
    const scale = Math.min(
      maxProductSize / info.width,
      maxProductSize / info.height,
      1 // No escalar más del 100%
    );

    const productWidth = Math.round(info.width * scale);
    const productHeight = Math.round(info.height * scale);
    const productX = Math.round((canvasSize - productWidth) / 2);
    const productY = Math.round((canvasSize - productHeight) / 2);

    console.log(`📐 Producto redimensionado a: ${productWidth}x${productHeight}`);
    console.log(`🎯 Posición en lienzo: (${productX}, ${productY})`);

    // 5. CREAR IMAGEN FINAL CON FONDO BLANCO Y PRODUCTO CENTRADO
    const finalImageBuffer = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 3,
        background: { r: 255, g: 255, b: 255 } // Fondo blanco
      }
    })
    .png()
    .composite([
      {
        input: await sharp(data)
          .resize(productWidth, productHeight, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .toBuffer(),
        top: productY,
        left: productX
      }
    ])
    .png()
    .toBuffer();

    // 6. GUARDAR RESULTADOS
    const timestamp = Date.now();
    const originalPath = path.join("uploads", `original_${timestamp}.jpg`);
    const processedPath = path.join("uploads", `procesada_${timestamp}.png`);

    // Guardar original (convertida a JPG para consistencia)
    await sharp(imagen.path)
      .jpeg({ quality: 90 })
      .toFile(originalPath);

    // Guardar procesada
    fs.writeFileSync(processedPath, finalImageBuffer);

    // 7. LIMPIAR ARCHIVO TEMPORAL
    fs.unlinkSync(imagen.path);

    console.log("🎉 Procesamiento completado correctamente");

    // 8. ENVIAR RESPUESTA AL FRONTEND
    res.json({
      success: true,
      original: `/uploads/${path.basename(originalPath)}`,
      procesada: `/uploads/${path.basename(processedPath)}`,
      detalles: {
        tamañoOriginal: `${info.width}x${info.height}`,
        tamañoFinal: `${productWidth}x${productHeight}`,
        lienzo: `${canvasSize}x${canvasSize}`,
        escala: `${(scale * 100).toFixed(1)}%`
      }
    });

  } catch (err) {
    console.error("💥 Error interno procesando imagen:", err);
    
    // Limpiar archivo temporal en caso de error
    if (imagen && fs.existsSync(imagen.path)) {
      fs.unlinkSync(imagen.path);
    }
    
    res.status(500).json({ 
      error: "Error interno del servidor", 
      detalle: err.message 
    });
  }
});

// Servir imágenes temporales
app.use("/uploads", express.static("uploads"));

// Limpiar archivos temporales antiguos (opcional)
function cleanupOldFiles() {
  const maxAge = 30 * 60 * 1000; // 30 minutos
  const uploadsDir = "uploads";
  
  if (fs.existsSync(uploadsDir)) {
    fs.readdirSync(uploadsDir).forEach(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      
      if (Date.now() - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Limpiado archivo antiguo: ${file}`);
      }
    });
  }
}

// Ejecutar limpieza cada hora
setInterval(cleanupOldFiles, 60 * 60 * 1000);

app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
});
