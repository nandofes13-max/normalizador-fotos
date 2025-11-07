const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const imageFormatSelect = document.getElementById("imageFormat");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const zoomValue = document.getElementById("zoomValue");
const downloadBtn = document.getElementById("downloadBtn");
const originalImgElement = document.getElementById("original");

// Elementos para datos técnicos ORIGINALES
const originalTech = document.getElementById("original-tech");
const originalCanvasSize = document.getElementById("original-canvas-size");
const originalProductSize = document.getElementById("original-product-size");
const originalMargin = document.getElementById("original-margin");
const originalBackground = document.getElementById("original-background");
const originalScale = document.getElementById("original-scale");

// Elementos para datos técnicos PROCESADOS
const processedTech = document.getElementById("processed-tech");
const processedCanvasSize = document.getElementById("processed-canvas-size");
const processedProductSize = document.getElementById("processed-product-size");
const processedMargin = document.getElementById("processed-margin");
const processedBackground = document.getElementById("processed-background");
const processedScale = document.getElementById("processed-scale");

let processedImage = null;
let currentScale = 1;
let currentImageFile = null;
let currentImageInfo = null;
let currentTechData = null;

// ACTUALIZAR TAMAÑO DEL CANVAS SEGÚN FORMATO
function updateCanvasSize() {
  const format = imageFormatSelect.value;
  const sizes = {
    proportion65: { width: 1200, height: 1000 },
    square: { width: 527, height: 527 },
    portrait: { width: 527, height: 702 },
    landscape: { width: 527, height: 296 },
    rectangular: { width: 527, height: 395 }
  };
  
  const size = sizes[format];
  if (size) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  
  // Redibujar si hay imagen procesada
  if (processedImage) {
    drawProcessedImage();
  }
}

// ACTUALIZAR CANVAS CUANDO CAMBIA EL FORMATO
imageFormatSelect.addEventListener("change", updateCanvasSize);

// ACTUALIZAR VALOR DEL ZOOM EN TIEMPO REAL
zoom.addEventListener("input", () => {
  currentScale = zoom.value / 100;
  zoomValue.textContent = `${zoom.value}%`;
  
  if (processedImage) {
    drawProcessedImage();
    updateProcessedTechDataWithZoom();
  }
});

// MOSTRAR IMAGEN ORIGINAL AL SUBIRLA
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  currentImageFile = file;

  const reader = new FileReader();
  reader.onload = (event) => {
    originalImgElement.src = event.target.result;
    
    // Obtener información básica de la imagen original
    const img = new Image();
    img.onload = function() {
      currentImageInfo = {
        width: this.width,
        height: this.height
      };
      // Mostrar datos técnicos básicos mientras se procesa
      showBasicOriginalTechData();
    };
    img.src = event.target.result;
    
    previewContainer.classList.remove("hidden");
    originalTech.classList.remove("hidden");
    processedTech.classList.add("hidden"); // Ocultar datos procesados hasta que se procese
  };
  reader.readAsDataURL(file);
});

// MOSTRAR DATOS TÉCNICOS BÁSICOS DE LA ORIGINAL
function showBasicOriginalTechData() {
  if (!currentImageInfo) return;
  
  originalCanvasSize.textContent = `${currentImageInfo.width} × ${currentImageInfo.height} px`;
  originalProductSize.textContent = `${currentImageInfo.width} × ${currentImageInfo.height} px`;
  originalMargin.textContent = `0 px`;
  originalBackground.textContent = `Original`;
  originalScale.textContent = `100%`;
}

// MOSTRAR DATOS TÉCNICOS ORIGINALES DEL SERVIDOR
function showOriginalTechData(techData) {
  if (!techData) return;
  
  originalCanvasSize.textContent = techData.originalCanvas;
  originalProductSize.textContent = techData.originalProduct;
  originalMargin.textContent = techData.originalMargin;
  originalBackground.textContent = techData.originalBackground;
  originalScale.textContent = techData.originalScale;
  
  originalTech.classList.remove("hidden");
}

// MOSTRAR DATOS TÉCNICOS PROCESADOS
function showProcessedTechData(techData) {
  if (!techData) return;
  
  currentTechData = techData; // Guardar para actualizaciones con zoom
  
  processedCanvasSize.textContent = techData.processedCanvas;
  processedProductSize.textContent = techData.processedProduct;
  processedMargin.textContent = techData.processedMargin;
  processedBackground.textContent = techData.processedBackground;
  processedScale.textContent = techData.processedScale;
  
  processedTech.classList.remove("hidden");
}

// ACTUALIZAR DATOS PROCESADOS CON ZOOM APLICADO
function updateProcessedTechDataWithZoom() {
  if (!currentTechData) return;
  
  // Extraer dimensiones base del producto
  const baseSize = currentTechData.processedProduct.split(' × ');
  const baseWidth = parseInt(baseSize[0]);
  const baseHeight = parseInt(baseSize[1]);
  
  // Calcular nuevas dimensiones con zoom
  const zoomedWidth = Math.round(baseWidth * currentScale);
  const zoomedHeight = Math.round(baseHeight * currentScale);
  
  // Actualizar display
  processedProductSize.textContent = `${zoomedWidth} × ${zoomedHeight} px`;
  processedScale.textContent = `${(currentScale * 100).toFixed(1)}%`;
}

// PROCESAR IMAGEN
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = currentImageFile || imageInput.files[0];
  const imageFormat = imageFormatSelect.value;

  if (!file || !imageFormat) {
    alert("Por favor, sube una imagen y selecciona un formato");
    return;
  }

  const originalButton = form.querySelector('button');
  originalButton.textContent = 'Analizando y procesando...';
  originalButton.disabled = true;

  try {
    const formData = new FormData();
    formData.append("imagen", file);
    formData.append("imageFormat", imageFormat);

    const res = await fetch("/procesar", { 
      method: "POST", 
      body: formData 
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `Error del servidor: ${res.status}`);
    }
    
    const result = await res.json();
    
    if (!result.success) {
      throw new Error(result.error || "Error desconocido");
    }

    // Cargar la imagen procesada
    const img = new Image();
    img.src = result.procesada;
    img.onload = () => {
      processedImage = img;
      currentScale = 1;
      zoom.value = 100;
      zoomValue.textContent = "100%";
      drawProcessedImage();
      
      // Mostrar datos técnicos actualizados
      showOriginalTechData(result.originalTech);
      showProcessedTechData(result.processedTech);
      
      console.log("🎉 Normalización completada:", result.detalles);
      
      originalButton.textContent = 'Reprocesar imagen';
      originalButton.disabled = false;
    };
    
  } catch (error) {
    console.error("Error:", error);
    alert("Error al procesar la imagen: " + error.message);
    originalButton.textContent = 'Procesar imagen';
    originalButton.disabled = false;
  }
});

// DIBUJAR IMAGEN PROCESADA
function drawProcessedImage() {
  if (!processedImage) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const scale = currentScale;
  const w = processedImage.width * scale;
  const h = processedImage.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  
  ctx.drawImage(processedImage, x, y, w, h);
}

// DESCARGAR IMAGEN
downloadBtn.addEventListener("click", () => {
  if (!processedImage) {
    alert("No hay imagen procesada para descargar");
    return;
  }
  
  const formatNames = {
    proportion65: "6-5",
    square: "cuadrado",
    portrait: "retrato", 
    landscape: "apaisado",
    rectangular: "rectangular"
  };
  
  const link = document.createElement("a");
  link.download = `normalizada_${formatNames[imageFormatSelect.value]}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// INICIALIZAR
function initialize() {
  currentScale = 1;
  zoom.value = 100;
  zoomValue.textContent = "100%";
  updateCanvasSize();
}
initialize();
