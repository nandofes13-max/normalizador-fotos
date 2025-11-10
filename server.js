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

// ✅ FUNCIÓN: Detectar color de fondo analizando bordes
function detectBackgroundColor(imageData, width, height) {
  const sampleSize = 50;
  const samples = [];
  
  for (let i = 0; i < sampleSize; i++) {
    // Borde superior
    const topIndex = (i * 4);
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

// ✅ FUNCIÓN: Encontrar límites del producto con DEBUG
function findProductBounds(imageData, width, height, backgroundColor) {
  console.log("🎯 INICIANDO DETECCIÓN DE PRODUCTO...");
  const tolerance = 30;
  let left = width, right = 0, top = height, bottom = 0;
  let pixelsDetectados = 0;
  let totalPixels = width * height;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      
      const colorDiff = Math.abs(r - backgroundColor.r) + 
                       Math.abs(g - backgroundColor.g) + 
                       Math.abs(b - backgroundColor.b);
      
      if (colorDiff > tolerance) {
        pixelsDetectados++;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  
  console.log(`📊 Píxeles detectados: ${pixelsDetectados}/${totalPixels} (${((pixelsDetectados / totalPixels) * 100).toFixed(1)}%)`);
  
  if (pixelsDetectados === 0) {
    console.log("❌ NO SE DETECTÓ PRODUCTO - Usando imagen completa");
    return {
      x: 0, y: 0, x2: width - 1, y2: height - 1,
      width: width, height: height
    };
  }
  
  const safetyMargin = 5;
  left = Math.max(0, left - safetyMargin);
  top = Math.max(0, top - safetyMargin);
  right = Math.min(width - 1, right + safetyMargin);
  bottom = Math.min(height - 1, bottom + safetyMargin);
  
  const productWidth = right - left + 1;
  const productHeight = bottom - top + 1;
  
  const minSize = 50;
  if (productWidth < minSize || productHeight < minSize) {
    console.log(`⚠️ PRODUCTO MUY PEQUEÑO - Usando imagen completa`);
    return {
      x: 0, y: 0, x2: width - 1, y2: height - 1,
      width: width, height: height
    };
  }
  
  console.log(`✅ Producto detectado: ${productWidth}x${productHeight}px`);
  
  return {
    x: left, y: top, x2: right, y2: bottom,
    width: productWidth, height: productHeight
  };
}

// ✅ FUNCIÓN MEJORADA: Calcular métricas REALES con márgenes individuales y escala real
function calculateOriginalMetrics(originalWidth, originalHeight, productBounds) {
  const marginLeft = productBounds.x;
  const marginRight = originalWidth - productBounds.x2 - 1;
  const marginTop = productBounds.y;
  const marginBottom = originalHeight - productBounds.y2 - 1;
  
  // Calcular escala real (porcentaje de área ocupada)
  const areaLienzo = originalWidth * originalHeight;
  const areaProducto = productBounds.width * productBounds.height;
  const escalaReal = Math.round((areaProducto / areaLienzo) * 100);
  
  return {
    originalCanvas: `${originalWidth} × ${originalHeight} px`,
    originalProduct: `${productBounds.width} × ${productBounds.height} px`,
    // MÁRGENES INDIVIDUALES
    marginLeft: `${marginLeft} px`,
    marginRight: `${marginRight} px`, 
    marginTop: `${marginTop} px`,
    marginBottom: `${marginBottom} px`,
    originalBackground: "Detectado automáticamente",
    // ESCALA REAL (no fija)
    originalScale: `${escalaReal}%`
  };
}

// ✅ NUEVO ENDPOINT: Detectar producto y retornar datos técnicos (sin procesar)
app.post("/detectar", upload.single("imagen"), async (req, res) => {
  const imagen = req.file;

  if (!imagen) {
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  console.log("📸 Imagen recibida para detección:", imagen.originalname);

  try {
    // Cargar imagen y obtener metadatos
    const image = sharp(imagen.path);
    const metadata = await image.metadata();
    
    // Estrategia segura: usar JPEG temporal
    const tempImagePath = path.join("uploads", `temp_detection_${Date.now()}.jpg`);
    await image.jpeg({ quality: 95 }).toFile(tempImagePath);

    // Analizar la imagen temporal
    const tempImage = sharp(tempImagePath);
    const { data, info } = await tempImage.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // Detectar color de fondo y producto
    const backgroundColor = detectBackgroundColor(data, info.width, info.height);
    const productBounds = findProductBounds(data, info.width, info.height, backgroundColor);

    // Calcular métricas MEJORADAS
    const originalMetrics = calculateOriginalMetrics(metadata.width, metadata.height, productBounds);

    // Limpiar archivos temporales
    fs.unlinkSync(tempImagePath);
    // ⚠️ NO eliminar el archivo original aquí - se usará en /procesar

    console.log("✅ Detección completada - Enviando datos técnicos");

    res.json({
      success: true,
      originalTech: originalMetrics,
      detectionInfo: {
        productBounds: productBounds,
        backgroundColor: backgroundColor
      }
    });

  } catch (error) {
    console.error("💥 Error en detección:", error);
    
    if (imagen && fs.existsSync(imagen.path)) {
      fs.unlinkSync(imagen.path);
    }
    
    res.status(500).json({ 
      error: "Error en detección automática", 
      detalle: error.message 
    });
  }
});

// ✅ ENDPOINT MEJORADO: Procesar imagen con filtros configurables
app.post("/procesar", upload.single("imagen"), async (req, res) => {
  const imagen = req.file;
  const { 
    imageFormat, 
    userScale = 80,
    filter = "none"  // ← NUEVO: Recibir el filtro desde el frontend
  } = req.body;

  if (!imagen) {
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  if (!imageFormat) {
    return res.status(400).json({ error: "Seleccione el formato de imagen" });
  }

  console.log("🛍️ Procesando imagen:", imagen.originalname);
  console.log("🎚️ Escala usuario:", `${userScale}%`);
  console.log("🎨 Filtro seleccionado:", filter);

  try {
    // ✅ VERIFICAR que el archivo existe antes de procesar
    if (!fs.existsSync(imagen.path)) {
      throw new Error("El archivo temporal no existe. Posiblemente fue eliminado en una operación anterior.");
    }

    // PASO 1: DETECTAR PRODUCTO
    const image = sharp(imagen.path);
    const metadata = await image.metadata();
    console.log("📐 Dimensiones originales:", `${metadata.width}x${metadata.height}`);

    const tempImagePath = path.join("uploads", `temp_process_${Date.now()}.jpg`);
    await image.jpeg({ quality: 95 }).toFile(tempImagePath);

    const tempImage = sharp(tempImagePath);
    const { data, info } = await tempImage.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const backgroundColor = detectBackgroundColor(data, info.width, info.height);
    const productBounds = findProductBounds(data, info.width, info.height, backgroundColor);

    console.log("✅ Producto detectado:", productBounds);

    // PASO 2: APLICAR FILTROS ESTÉTICOS SEGÚN SELECCIÓN
    console.log("🎨 Aplicando filtro:", filter);
    
    // Configuración de filtros
    const filterConfigs = {
      none: {
        brightness: 1.15,
        saturation: 1.25,
        contrast: 1.20,
        gamma: 1.08,
        sharpen: { sigma: 1.2, m1: 1.5, m2: 0.4, x1: 2, y2: 10, y3: 20 },
        median: 3,
        description: "Imagen normalizada sin efectos adicionales"
      },
      juno: {
        brightness: 1.25,
        saturation: 1.35,
        contrast: 1.15,
        gamma: 1.1,
        sharpen: { sigma: 1.0, m1: 1.2, m2: 0.3, x1: 1.5, y2: 8, y3: 15 },
        median: 2,
        tint: { r: 255, g: 240, b: 220 }, // Tono cálido
        description: "Tonos cálidos intensos, colores vibrantes"
      },
      paris: {
        brightness: 1.18,
        saturation: 1.15,
        contrast: 1.10,
        gamma: 1.05,
        sharpen: { sigma: 0.8, m1: 1.0, m2: 0.2, x1: 1, y2: 5, y3: 10 },
        median: 4,
        tint: { r: 255, g: 230, b: 250 }, // Tono rosado suave
        description: "Tono rosado suave, efecto dreamy"
      },
      lofi: {
        brightness: 1.10,
        saturation: 1.40,
        contrast: 1.30,
        gamma: 1.15,
        sharpen: { sigma: 1.5, m1: 2.0, m2: 0.5, x1: 3, y2: 15, y3: 25 },
        median: 1,
        description: "Saturación alta + contraste fuerte"
      },
      cristal: {
        brightness: 1.12,
        saturation: 1.30,
        contrast: 1.25,
        gamma: 1.12,
        sharpen: { sigma: 1.8, m1: 2.2, m2: 0.6, x1: 4, y2: 20, y3: 30 },
        median: 5,
        description: "Máxima nitidez y colores vibrantes"
      }
    };

    const config = filterConfigs[filter] || filterConfigs.none;

    // Recortar producto con FILTROS CONFIGURABLES
    let imagePipeline = sharp(imagen.path)
      .extract({
        left: productBounds.x,
        top: productBounds.y,
        width: productBounds.width,
        height: productBounds.height
      })
      .modulate({
        brightness: config.brightness,
        saturation: config.saturation,
        contrast: config.contrast
      })
      .gamma(config.gamma)
      .sharpen(config.sharpen)
      .median(config.median);

    // Aplicar tintes para filtros específicos
    if (config.tint) {
      imagePipeline = imagePipeline.tint(config.tint);
    }

    const croppedBuffer = await imagePipeline.png().toBuffer();

    // Limpiar temporal
    fs.unlinkSync(tempImagePath);

    // PASO 3: PREPARAR FORMATOS ACTUALIZADOS
    const imageFormats = {
      jumpsellerCuadrado: { width: 380, height: 380, label: "Jumpseller Cuadrado (380×380)" },
      kyteCatalogo: { width: 400, height: 400, label: "Kyte Catálogo (400×400)" },
      proportion65: { width: 1200, height: 1000, label: "Proporción 6:5 (1200×1000)" },
      square: { width: 527, height: 527, label: "Cuadrado 1:1 (527×527)" },
      portrait: { width: 527, height: 702, label: "Retrato 3:4 (527×702)" },
      landscape: { width: 527, height: 296, label: "Apaisado 16:9 (527×296)" },
      rectangular: { width: 527, height: 395, label: "Rectangular 4:3 (527×395)" }
    };

    const format = imageFormats[imageFormat];
    if (!format) {
      throw new Error(`Formato no válido: ${imageFormat}`);
    }

    // ✅ CÁLCULO CORREGIDO: Escala basada en dimensión principal
    const userScaleFactor = parseFloat(userScale) / 100;
    
    // Calcular escala para que la dimensión principal ocupe el porcentaje del lienzo
    const aspectRatioProducto = productBounds.width / productBounds.height;
    const aspectRatioLienzo = format.width / format.height;
    
    let escalaFinal;
    
    if (aspectRatioProducto > aspectRatioLienzo) {
      // Producto más ancho - escalar por ancho
      const anchoDeseado = format.width * userScaleFactor;
      escalaFinal = anchoDeseado / productBounds.width;
      console.log(`📏 Escalando por ANCHO: ${anchoDeseado.toFixed(0)}px`);
    } else {
      // Producto más alto - escalar por alto
      const altoDeseado = format.height * userScaleFactor;
      escalaFinal = altoDeseado / productBounds.height;
      console.log(`📏 Escalando por ALTO: ${altoDeseado.toFixed(0)}px`);
    }
    
    // Limitar escala máxima para que no exceda el lienzo
    const escalaMaxAncho = format.width / productBounds.width;
    const escalaMaxAlto = format.height / productBounds.height;
    const escalaMaxima = Math.min(escalaMaxAncho, escalaMaxAlto);
    
    escalaFinal = Math.min(escalaFinal, escalaMaxima);
    
    // Calcular dimensiones finales
    const productWidth = Math.round(productBounds.width * escalaFinal);
    const productHeight = Math.round(productBounds.height * escalaFinal);
    
    // Calcular posición centrada
    const productX = Math.round((format.width - productWidth) / 2);
    const productY = Math.round((format.height - productHeight) / 2);
    
    // Calcular márgenes individuales
    const marginLeft = productX;
    const marginRight = format.width - productX - productWidth;
    const marginTop = productY;
    const marginBottom = format.height - productY - productHeight;

    // Calcular porcentaje de área ocupada REAL
    const areaLienzo = format.width * format.height;
    const areaProducto = productWidth * productHeight;
    const porcentajeOcupado = (areaProducto / areaLienzo) * 100;

    console.log(`📐 Escala aplicada: ${(escalaFinal * 100).toFixed(1)}%`);
    console.log(`📊 Porcentaje área ocupada: ${porcentajeOcupado.toFixed(1)}%`);
    console.log(`🖼️ Tamaño producto final: ${productWidth}x${productHeight}px`);
    console.log(`📍 Posición: (${productX}, ${productY})`);

    // PASO 4: PROCESAR IMAGEN FINAL con kernel de alta calidad
    const resizedProductBuffer = await sharp(croppedBuffer)
      .resize(productWidth, productHeight, {
        kernel: 'lanczos3',  // ✅ Algoritmo de alta calidad
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 }
      })
      .png()
      .toBuffer();

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
        top: productY,
        left: productX
      }
    ])
    .png()
    .toBuffer();

    // PASO 5: GUARDAR RESULTADOS
    const timestamp = Date.now();
    const processedPath = path.join("uploads", `normalizada_${timestamp}.png`);

    fs.writeFileSync(processedPath, finalImageBuffer);
    
    // LIMPIAR archivo temporal original
    if (fs.existsSync(imagen.path)) {
      fs.unlinkSync(imagen.path);
    }

    console.log("🎉 Procesamiento completado con filtro:", filter);

    // PASO 6: ENVIAR RESPUESTA ACTUALIZADA
    res.json({
      success: true,
      procesada: `/uploads/${path.basename(processedPath)}`,
      originalTech: calculateOriginalMetrics(metadata.width, metadata.height, productBounds),
      processedTech: {
        processedCanvas: `${format.width} × ${format.height} px`,
        processedProduct: `${productWidth} × ${productHeight} px`,
        marginLeft: `${marginLeft} px`,
        marginRight: `${marginRight} px`,
        marginTop: `${marginTop} px`, 
        marginBottom: `${marginBottom} px`,
        processedBackground: "Blanco",
        processedScale: `${porcentajeOcupado.toFixed(1)}%`,
        userScale: `${userScale}%`
      },
      detalles: {
        formato: format.label,
        metodo: `Detección Automática + Filtro ${filter.charAt(0).toUpperCase() + filter.slice(1)}`,
        productoDetectado: `${productBounds.width} × ${productBounds.height} px`,
        escalaAplicada: `${(escalaFinal * 100).toFixed(1)}%`,
        filtroAplicado: filter,
        descripcionFiltro: config.description,
        configuracionFiltro: {
          brillo: `${((config.brightness - 1) * 100).toFixed(0)}%`,
          saturacion: `${((config.saturation - 1) * 100).toFixed(0)}%`,
          contraste: `${((config.contrast - 1) * 100).toFixed(0)}%`
        }
      }
    });

  } catch (error) {
    console.error("💥 Error procesando imagen:", error);
    
    if (imagen && fs.existsSync(imagen.path)) {
      fs.unlinkSync(imagen.path);
    }
    
    res.status(500).json({ 
      error: "Error procesando imagen", 
      detalle: error.message 
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
