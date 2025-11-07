import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const app = express();
const port = process.env.PORT || 10000;

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

// ✅ FUNCIÓN MEJORADA: Detectar y recortar producto automáticamente
async function detectAndCropProduct(imagePath) {
  console.log("🔍 Analizando imagen para detectar producto...");
  
  try {
    // Leer imagen y obtener metadatos
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    console.log(`📐 Imagen original: ${metadata.width}x${metadata.height}px`);
    
    // ESTRATEGIA: Detectar bordes por contraste
    // 1. Convertir a escala de grises para mejor detección de bordes
    // 2. Aplicar algoritmo para encontrar región de interés
    
    const { data, info } = await image
        .extract({
        left: 0,
        top: 0,
        width: metadata.width,
        height: metadata.height
      })
      .toBuffer({ resolveWithObject: true });

    // Por ahora, usamos la imagen completa como "producto detectado"
    // En una versión avanzada, aquí iría el algoritmo de detección real
    console.log("📦 Producto detectado: usando imagen completa");
    
    return {
      data: data,
      info: info,
      productBounds: {
        x: 0,
        y: 0, 
        width: info.width,
        height: info.height
      }
    };
    
  } catch (error) {
    console.error("❌ Error en detección de producto:", error);
    throw error;
  }
}

// ✅ FUNCIÓN: Calcular métricas de la imagen original
function calculateOriginalMetrics(imageBuffer, productBounds) {
  const productWidth = productBounds.width;
  const productHeight = productBounds.height;
  
  return {
    originalCanvas: `${productBounds.width} × ${productBounds.height} px`,
    originalProduct: `${productWidth} × ${productHeight} px`,
    originalMargin: `0 px`, // Asumimos que la original no tiene margen
    originalBackground: "Original",
    originalScale: "100%"
  };
}

app.post("/procesar", upload.single("imagen"), async (req, res) => {
  const imagen = req.file;
  const imageFormat = req.body.imageFormat;

  if (!imagen) {
    console.error("❌ No se recibió ninguna imagen");
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  if (!imageFormat) {
    console.error("❌ No se especificó el formato");
    return res.status(400).json({ error: "Seleccione el formato de imagen" });
  }

  console.log("📸 Imagen recibida:", imagen.originalname);
  console.log("🛍️ Formato seleccionado:", imageFormat);

  try {
    // ✅ PASO 1: DETECTAR Y ANALIZAR PRODUCTO EN ORIGINAL
    const detectionResult = await detectAndCropProduct(imagen.path);
    const originalMetrics = calculateOriginalMetrics(detectionResult.data, detectionResult.productBounds);
    
    console.log("📊 Métricas originales:", originalMetrics);

    // ✅ PASO 2: PREPARAR FORMATO DE SALIDA
    const imageFormats = {
      proportion65: { width: 1200, height: 1000, label: "Proporción 6:5" },
      square:       { width: 527, height: 527, label: "Cuadrado 1:1" },
      portrait:     { width: 527, height: 702, label: "Retrato 3:4" },
      landscape:    { width: 527, height: 296, label: "Apaisado 16:9" },
      rectangular:  { width: 527, height: 395, label: "Rectangular 4:3" }
    };

    const format = imageFormats[imageFormat];
    if (!format) {
      throw new Error(`Formato no válido: ${imageFormat}`);
    }

    console.log(`🎯 Formato destino: ${format.label} (${format.width}x${format.height}px)`);

    // ✅ PASO 3: CALCULAR ESCALA PARA NORMALIZACIÓN
    const margin = 0; // 0% sin margen
    const availableWidth = format.width * (1 - margin);
    const availableHeight = format.height * (1 - margin);

    const scaleX = availableWidth / detectionResult.info.width;
    const scaleY = availableHeight / detectionResult.info.height;
    
    const scale = Math.min(scaleX, scaleY);

    const productWidth = Math.round(detectionResult.info.width * scale);
    const productHeight = Math.round(detectionResult.info.height * scale);
    const productX = Math.round((format.width - productWidth) / 2);
    const productY = Math.round((format.height - productHeight) / 2);
    const marginPx = Math.round(format.width * margin / 2);

    console.log(`📐 Producto original: ${detectionResult.info.width}x${detectionResult.info.height}`);
    console.log(`📐 Escala aplicada: ${(scale * 100).toFixed(1)}%`);
    console.log(`📐 Tamaño normalizado: ${productWidth}x${productHeight}px`);
    console.log(`📐 Margen aplicado: ${marginPx}px`);

    // ✅ PASO 4: CREAR IMAGEN NORMALIZADA
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
        input: await sharp(detectionResult.data)
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

    // ✅ PASO 5: GUARDAR RESULTADOS
    const timestamp = Date.now();
    const originalPath = path.join("uploads", `original_${timestamp}.jpg`);
    const processedPath = path.join("uploads", `normalizada_${timestamp}.png`);

    // Guardar original (convertida a JPG para consistencia)
    await sharp(imagen.path)
      .jpeg({ quality: 90 })
      .toFile(originalPath);

    // Guardar procesada
    fs.writeFileSync(processedPath, finalImageBuffer);
    fs.unlinkSync(imagen.path);

    console.log("🎉 Normalización completada");

    // ✅ PASO 6: ENVIAR RESPUESTA CON TODOS LOS DATOS
    res.json({
      success: true,
      original: `/uploads/${path.basename(originalPath)}`,
      procesada: `/uploads/${path.basename(processedPath)}`,
      // Datos técnicos ORIGINALES (reales)
      originalTech: originalMetrics,
      // Datos técnicos PROCESADOS (reales)  
      processedTech: {
        processedCanvas: `${format.width} × ${format.height} px`,
        processedProduct: `${productWidth} × ${productHeight} px`,
        processedMargin: `${marginPx} px`,
        processedBackground: "Blanco",
        processedScale: `${(scale * 100).toFixed(1)}%`
      },
      detalles: {
        formato: format.label,
        metodo: 'Normalización Automática'
      }
    });

  } catch (err) {
    console.error("💥 Error procesando imagen:", err);
    
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
