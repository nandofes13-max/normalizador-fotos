import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const app = express();
const port = process.env.PORT || 10000;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

console.log("🔑 CLIPDROP_API_KEY detectada:", CLIPDROP_API_KEY ? "OK ✅" : "NO ❌");

app.use(cors());
app.use(express.static("public"));

const upload = multer({ 
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024
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
    // ✅ FORMA CORRECTA para ClipDrop API
    const imageBuffer = fs.readFileSync(imagen.path);
    
    const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
      method: "POST",
      headers: {
        "x-api-key": CLIPDROP_API_KEY,
        "Content-Type": "image/jpeg", // Especificar el tipo de contenido
      },
      body: imageBuffer, // Enviar el buffer directamente
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`⚠️ Error ClipDrop API: ${response.status} ${errorText}`);
      
      // Limpiar archivo temporal
      fs.unlinkSync(imagen.path);
      
      return res.status(response.status).json({ 
        error: "Error procesando imagen", 
        detalle: `ClipDrop API: ${response.status} - ${errorText}` 
      });
    }

    const buffer = await response.arrayBuffer();
    console.log("✅ Fondo removido correctamente.");

    // PROCESAR CON SHARP
    const { data, info } = await sharp(Buffer.from(buffer))
      .trim() // Recortar bordes transparentes
      .png()
      .toBuffer({ resolveWithObject: true });

    console.log(`✂️ Imagen recortada: ${info.width}x${info.height}`);

    // CREAR LIENZO CON FONDO BLANCO
    const canvasSize = 800;
    const margin = 50;
    
    const maxProductSize = canvasSize - (margin * 2);
    const scale = Math.min(
      maxProductSize / info.width,
      maxProductSize / info.height,
      1
    );

    const productWidth = Math.round(info.width * scale);
    const productHeight = Math.round(info.height * scale);
    const productX = Math.round((canvasSize - productWidth) / 2);
    const productY = Math.round((canvasSize - productHeight) / 2);

    console.log(`📐 Producto redimensionado a: ${productWidth}x${productHeight}`);

    // IMAGEN FINAL
    const finalImageBuffer = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
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

    // GUARDAR RESULTADOS
    const timestamp = Date.now();
    const originalPath = path.join("uploads", `original_${timestamp}.jpg`);
    const processedPath = path.join("uploads", `procesada_${timestamp}.png`);

    await sharp(imagen.path)
      .jpeg({ quality: 90 })
      .toFile(originalPath);

    fs.writeFileSync(processedPath, finalImageBuffer);

    // LIMPIAR TEMPORALES
    fs.unlinkSync(imagen.path);

    console.log("🎉 Procesamiento completado correctamente");

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

// Crear directorio uploads si no existe
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
});
