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

// ✅ FUNCIÓN PARA SIMULAR REMOCIÓN DE FONDO (FALLBACK)
async function simulateBackgroundRemoval(imagePath) {
  console.log("🔄 Usando simulación de remoción de fondo...");
  
  // Crear un efecto de "recorte aproximado" con Sharp
  const { data, info } = await sharp(imagePath)
    .resize(800, 800, { fit: 'inside' })
    .extend({
      top: 20,
      bottom: 20,
      left: 20,
      right: 20,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer({ resolveWithObject: true });
    
  console.log("🎭 Fondo simulado creado");
  return { data, info };
}

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
    let resultData, resultInfo;
    let usedClipDrop = false;

    // INTENTAR CON CLIPDROP PRIMERO
    try {
      console.log("🧩 Intentando con ClipDrop API...");
      
      const preprocessedImage = await sharp(imagen.path)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
        method: "POST",
        headers: {
          "x-api-key": CLIPDROP_API_KEY,
          "Content-Type": "image/jpeg"
        },
        body: preprocessedImage,
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log("✅ ClipDrop: Fondo removido correctamente");
        
        const processed = await sharp(Buffer.from(buffer))
          .trim()
          .png()
          .toBuffer({ resolveWithObject: true });
          
        resultData = processed.data;
        resultInfo = processed.info;
        usedClipDrop = true;
      } else {
        throw new Error(`ClipDrop error: ${response.status}`);
      }
    } catch (clipdropError) {
      console.log("⚠️ ClipDrop falló, usando simulación:", clipdropError.message);
      
      // USAR SIMULACIÓN COMO FALLBACK
      const simulated = await simulateBackgroundRemoval(imagen.path);
      resultData = simulated.data;
      resultInfo = simulated.info;
    }

    console.log(`✂️ Imagen procesada: ${resultInfo.width}x${resultInfo.height}`);
    console.log(`🎯 Método usado: ${usedClipDrop ? 'ClipDrop' : 'Simulación'}`);

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
    const margin = 0.1;
    const availableWidth = format.width * (1 - margin);
    const availableHeight = format.height * (1 - margin);

    const scaleX = availableWidth / resultInfo.width;
    const scaleY = availableHeight / resultInfo.height;
    
    const scale = Math.min(scaleX, scaleY);

    const productWidth = Math.round(resultInfo.width * scale);
    const productHeight = Math.round(resultInfo.height * scale);
    const productX = Math.round((format.width - productWidth) / 2);
    const productY = Math.round((format.height - productHeight) / 2);

    console.log(`📐 Producto original: ${resultInfo.width}x${resultInfo.height}`);
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
        input: await sharp(resultData)
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

    // Guardar original preprocesada
    const originalBuffer = await sharp(imagen.path)
      .resize(800, 800, { fit: 'inside' })
      .jpeg({ quality: 90 })
      .toBuffer();
    
    fs.writeFileSync(originalPath, originalBuffer);
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
        productoOriginal: `${resultInfo.width}x${resultInfo.height}px`,
        productoTamaño: `${productWidth}x${productHeight}px`,
        escala: `${(scale * 100).toFixed(1)}%`,
        metodo: usedClipDrop ? 'ClipDrop' : 'Simulación'
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
