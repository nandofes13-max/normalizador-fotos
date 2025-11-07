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

// ✅ VERSIÓN CORREGIDA: Detección sin problemas de buffer
async function detectAndCropProduct(imagePath) {
  console.log("🔍 Ejecutando detección automática de producto...");
  
  try {
    // Cargar imagen y obtener metadatos
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    console.log(`📐 Imagen original: ${metadata.width}x${metadata.height}px`);

    // ESTRATEGIA MEJORADA: Usar JPEG temporal para evitar problemas RAW
    const tempImagePath = path.join("uploads", `temp_analysis_${Date.now()}.jpg`);
    
    // Convertir a RGB y guardar temporalmente
    await image
      .jpeg({ quality: 95 })
      .toFile(tempImagePath);

    // Analizar la imagen temporal
    const tempImage = sharp(tempImagePath);
    const { data, info } = await tempImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // ✅ ESTRATEGIA: Analizar bordes para detectar color de fondo
    const backgroundColor = detectBackgroundColor(data, info.width, info.height);
    console.log(`🎨 Color de fondo detectado: RGB(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`);

    // ✅ DETECTAR LÍMITES DEL PRODUCTO
    const productBounds = findProductBounds(data, info.width, info.height, backgroundColor);
    
    console.log(`📦 Producto detectado: [${productBounds.x}, ${productBounds.y}] - [${productBounds.x2}, ${productBounds.y2}]`);
    console.log(`📦 Dimensiones producto: ${productBounds.width}x${productBounds.height}px`);

    // Recortar el producto detectado DESDE EL ORIGINAL (no del buffer)
    const croppedBuffer = await sharp(imagePath)
      .extract({
        left: productBounds.x,
        top: productBounds.y,
        width: productBounds.width,
        height: productBounds.height
      })
      .png()
      .toBuffer();

    // Limpiar archivo temporal
    fs.unlinkSync(tempImagePath);

    return {
      croppedBuffer: croppedBuffer,
      productBounds: productBounds,
      backgroundColor: backgroundColor,
      originalWidth: metadata.width,
      originalHeight: metadata.height
    };
    
  } catch (error) {
    console.error("❌ Error en detección de producto:", error);
    
    // Limpiar archivos temporales en caso de error
    const tempFiles = fs.readdirSync("uploads").filter(file => file.startsWith("temp_analysis_"));
    tempFiles.forEach(file => {
      try { fs.unlinkSync(path.join("uploads", file)); } catch(e) {}
    });
    
    throw error;
  }
}

// ✅ FUNCIÓN: Detectar color de fondo analizando bordes
function detectBackgroundColor(imageData, width, height) {
  const sampleSize = 50; // Muestrear primeros 50 píxeles de cada borde
  const samples = [];
  
  // Muestrear bordes superior e inferior
  for (let i = 0; i < sampleSize; i++) {
    // Borde superior
    const topIndex = (i * 4); // RGBA
    samples.push({
      r: imageData[topIndex],
      g: imageData[topIndex + 1],
      b: imageData[topIndex + 2]
    });
    
    // Borde inferior  
    const bottomIndex = ((height - 1) * width + i) * 4;
    samples.push({
      r: imageData[bottomIndex],
      g: imageData[bottomIndex + 1],
      b: imageData[bottomIndex + 2]
    });
  }
  
  // Muestrear bordes izquierdo y derecho
  for (let i = 0; i < sampleSize; i++) {
    // Borde izquierdo
    const leftIndex = (i * width) * 4;
    samples.push({
      r: imageData[leftIndex],
      g: imageData[leftIndex + 1],
      b: imageData[leftIndex + 2]
    });
    
    // Borde derecho
    const rightIndex = (i * width + (width - 1)) * 4;
    samples.push({
      r: imageData[rightIndex],
      g: imageData[rightIndex + 1],
      b: imageData[rightIndex + 2]
    });
  }
  
  // Calcular color promedio de las muestras
  const avgColor = samples.reduce((acc, color) => {
    acc.r += color.r;
    acc.g += color.g;
    acc.b += color.b;
    return acc;
  }, { r: 0, g: 0, b: 0 });
  
  avgColor.r = Math.round(avgColor.r / samples.length);
  avgColor.g = Math.round(avgColor.g / samples.length);
  avgColor.b = Math.round(avgColor.b / samples.length);
  
  return avgColor;
}

// ✅ FUNCIÓN: Encontrar límites del producto por contraste
function findProductBounds(imageData, width, height, backgroundColor) {
  const tolerance = 30; // Tolerancia de color (0-255)
  let left = width, right = 0, top = height, bottom = 0;
  
  // Escanear toda la imagen para encontrar límites
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      
      // Verificar si el píxel es significativamente diferente del fondo
      const colorDiff = Math.abs(r - backgroundColor.r) + 
                       Math.abs(g - backgroundColor.g) + 
                       Math.abs(b - backgroundColor.b);
      
      if (colorDiff > tolerance) {
        // Este píxel pertenece al producto
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  
  // Aplicar margen de seguridad (5 píxeles)
  const safetyMargin = 5;
  left = Math.max(0, left - safetyMargin);
  top = Math.max(0, top - safetyMargin);
  right = Math.min(width - 1, right + safetyMargin);
  bottom = Math.min(height - 1, bottom + safetyMargin);
  
  const productWidth = right - left + 1;
  const productHeight = bottom - top + 1;
  
  // Verificar que la detección es válida (no demasiado pequeña)
  const minSize = 50; // Tamaño mínimo del producto
  if (productWidth < minSize || productHeight < minSize) {
    console.log("⚠️ Producto muy pequeño, usando imagen completa");
    return {
      x: 0, y: 0, x2: width - 1, y2: height - 1,
      width: width, height: height
    };
  }
  
  return {
    x: left, y: top, x2: right, y2: bottom,
    width: productWidth, height: productHeight
  };
}

// ✅ FUNCIÓN: Calcular métricas REALES de la imagen original
function calculateOriginalMetrics(originalWidth, originalHeight, productBounds) {
  const marginLeft = productBounds.x;
  const marginRight = originalWidth - productBounds.x2 - 1;
  const marginTop = productBounds.y;
  const marginBottom = originalHeight - productBounds.y2 - 1;
  
  const totalMargin = marginLeft + marginRight + marginTop + marginBottom;
  const avgMargin = Math.round(totalMargin / 4);
  
  return {
    originalCanvas: `${originalWidth} × ${originalHeight} px`,
    originalProduct: `${productBounds.width} × ${productBounds.height} px`,
    originalMargin: `${avgMargin} px`,
    originalBackground: "Detectado automáticamente",
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
    const originalMetrics = calculateOriginalMetrics(
      detectionResult.originalWidth,
      detectionResult.originalHeight,
      detectionResult.productBounds
    );
    
    console.log("📊 Métricas originales REALES:", originalMetrics);

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

    // ✅ PASO 3: CALCULAR ESCALA PARA NORMALIZACIÓN (SIN MÁRGENES)
    const margin = 0; // 0% de margen - producto ocupa todo el lienzo
    const availableWidth = format.width * (1 - margin);
    const availableHeight = format.height * (1 - margin);

    const scaleX = availableWidth / detectionResult.productBounds.width;
    const scaleY = availableHeight / detectionResult.productBounds.height;
    
    const scale = Math.min(scaleX, scaleY);

    const productWidth = Math.round(detectionResult.productBounds.width * scale);
    const productHeight = Math.round(detectionResult.productBounds.height * scale);
    const productX = Math.round((format.width - productWidth) / 2);
    const productY = Math.round((format.height - productHeight) / 2);

    console.log(`📐 Producto detectado: ${detectionResult.productBounds.width}x${detectionResult.productBounds.height}`);
    console.log(`📐 Escala aplicada: ${(scale * 100).toFixed(1)}%`);
    console.log(`📐 Tamaño normalizado: ${productWidth}x${productHeight}px`);

    // ✅ PASO 4: VERSIÓN SIMPLIFICADA Y SEGURA
    
    console.log(`🔧 Procesando con dimensiones: ${productWidth}x${productHeight}`);

    // Validar dimensiones
    if (productWidth <= 0 || productHeight <= 0 || productWidth > 5000 || productHeight > 5000) {
      throw new Error(`Dimensiones inválidas: ${productWidth}x${productHeight}`);
    }

    // SOLUCIÓN DIRECTA: Redimensionar el buffer recortado directamente
    const resizedProductBuffer = await sharp(detectionResult.croppedBuffer)
      .resize(Math.round(productWidth), Math.round(productHeight), {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 } // Fondo blanco para mantener proporción
      })
      .png()
      .toBuffer();

    // Crear imagen final con el producto redimensionado centrado
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
        input: resizedProductBuffer,
        top: Math.round(productY),
        left: Math.round(productX)
      }
    ])
    .png()
    .toBuffer();

    console.log("✅ Imagen procesada correctamente");

    // ✅ PASO 5: GUARDAR RESULTADOS
    const timestamp = Date.now();
    const originalPath = path.join("uploads", `original_${timestamp}.jpg`);
    const processedPath = path.join("uploads", `normalizada_${timestamp}.png`);

    // Guardar original
    await sharp(imagen.path)
      .jpeg({ quality: 90 })
      .toFile(originalPath);

    // Guardar procesada
    fs.writeFileSync(processedPath, finalImageBuffer);
    fs.unlinkSync(imagen.path);

    console.log("🎉 Normalización REAL completada");

    // ✅ PASO 6: ENVIAR RESPUESTA CON DATOS REALES
    res.json({
      success: true,
      original: `/uploads/${path.basename(originalPath)}`,
      procesada: `/uploads/${path.basename(processedPath)}`,
      // Datos técnicos ORIGINALES (REALES)
      originalTech: originalMetrics,
      // Datos técnicos PROCESADOS (REALES)  
      processedTech: {
        processedCanvas: `${format.width} × ${format.height} px`,
        processedProduct: `${productWidth} × ${productHeight} px`,
        processedMargin: `0 px`, // Sin márgenes en procesada
        processedBackground: "Blanco",
        processedScale: `${(scale * 100).toFixed(1)}%`
      },
      detalles: {
        formato: format.label,
        metodo: 'Detección Automática + Normalización',
        productoDetectado: `${detectionResult.productBounds.width} × ${detectionResult.productBounds.height} px`
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
