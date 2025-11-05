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
app.use(express.json({ limit: '10mb' }));
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
  const imageFormat = req.body.imageFormat;

  if (!imagen) {
    console.error("❌ No se recibió ninguna imagen");
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  if (!imageFormat) {
    console.error("❌ No se especificó el formato Jumpseller");
    return res.status(400).json({ error: "Seleccione el formato Jumpseller" });
  }

  console.log("📸 Imagen recibida:", imagen.originalname);
  console.log("🛍️ Formato Jumpseller:", imageFormat);

  try {
    // ENVIAR A CLIPDROP
    const imageBuffer = fs.readFileSync(imagen.path);
    const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
      method: "POST",
      headers: {
        "x-api-key": CLIPDROP_API_KEY,
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`⚠️ Error ClipDrop API: ${response.status} ${errorText}`);
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
      .trim()
      .png()
      .toBuffer({ resolveWithObject: true });

    console.log(`✂️ Imagen recortada: ${info.width}x${info.height}`);

    // DIMENSIONES ESTÁNDAR JUMPSELLER
    const jumpsellerFormats = {
      square:       { width: 527, height: 527, label: "Cuadrado 1:1" },
      portrait:     { width: 527, height: 702, label: "Retrato 3:4" },
      landscape:    { width: 527, height: 296, label: "Apaisado 16:9" },
      rectangular:  { width: 527, height: 395, label: "Rectangular 4:3" }
    };

    const format = jumpsellerFormats[imageFormat];
    if (!format) {
      throw new Error(`Formato Jumpseller no válido: ${imageFormat}`);
    }

    console.log(`🎯 Formato: ${format.label} (${format.width}x${format.height}px)`);

    // CALCULAR ESCALA PARA AJUSTAR AL FORMATO SELECCIONADO
    const margin = 0.1; // 10% de margen
    const availableWidth = format.width * (1 - margin);
    const availableHeight = format.height * (1 - margin);

    const scaleX = availableWidth / info.width;
    const scaleY = availableHeight / info.height;
    
    const scale = Math.min(scaleX, scaleY);

    const productWidth = Math.round(info.width * scale);
    const productHeight = Math.round(info.height * scale);
    const productX = Math.round((format.width - productWidth) / 2);
    const productY = Math.round((format.height - productHeight) / 2);

    console.log(`📐 Producto original: ${info.width}x${info.height}`);
    console.log(`📐 Escala aplicada: ${(scale * 100).toFixed(1)}%`);
    console.log(`📐 Tamaño producto: ${productWidth}x${productHeight}px`);

    // CREAR IMAGEN FINAL CON DIMENSIONES JUMPSELLER
    const finalImageBuffer = await sharp({
      create: {
        width: format.width,
        height: format.height,
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
    const processedPath = path.join("uploads", `jumpseller_${timestamp}.png`);

    fs.copyFileSync(imagen.path, originalPath);
    fs.writeFileSync(processedPath, finalImageBuffer);
    fs.unlinkSync(imagen.path);

    console.log("🎉 Imagen lista para Jumpseller");

    res.json({
      success: true,
      original: `/uploads/${path.basename(originalPath)}`,
      procesada: `/uploads/${path.basename(processedPath)}`,
      detalles: {
        formato: format.label,
        dimensiones: `${format.width}x${format.height}px`,
        productoOriginal: `${info.width}x${info.height}px`,
        productoTamaño: `${productWidth}x${productHeight}px`,
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

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
});
