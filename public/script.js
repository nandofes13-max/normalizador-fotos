const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const imageFormatSelect = document.getElementById("imageFormat");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const downloadBtn = document.getElementById("downloadBtn");
const originalImgElement = document.getElementById("original");

// Elementos para datos técnicos
const originalTech = document.getElementById("original-tech");
const originalCanvasSize = document.getElementById("original-canvas-size");
const originalBackground = document.getElementById("original-background");
const originalProductSize = document.getElementById("original-product-size");
const processedTech = document.getElementById("processed-tech");
const processedCanvasSize = document.getElementById("processed-canvas-size");
const processedBackground = document.getElementById("processed-background");
const processedProductSize = document.getElementById("processed-product-size");
const processedScale = document.getElementById("processed-scale");

let processedImage = null;
let currentScale = 1;
let currentImageFile = null;
let currentImageInfo = null;

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

// MOSTRAR IMAGEN ORIGINAL AL SUBIRLA
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  currentImageFile = file;

  const reader = new FileReader();
  reader.onload = (event) => {
    originalImgElement.src = event.target.result;
    
    // Obtener información de la imagen original
    const img = new Image();
    img.onload = function() {
      currentImageInfo = {
        width: this.width,
        height: this.height
      };
      showOriginalTechData();
    };
    img.src = event.target.result;
    
    previewContainer.classList.remove("hidden");
    originalTech.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

// MOSTRAR DATOS TÉCNICOS ORIGINALES
function showOriginalTechData() {
  if (!currentImageInfo) return;
  
  originalCanvasSize.textContent = `Tamaño del lienzo: ${currentImageInfo.width} × ${currentImageInfo.height} px`;
  originalBackground.textContent = `Fondo: Original de la imagen`;
  originalProductSize.textContent = `Tamaño del producto: ${currentImageInfo.width} × ${currentImageInfo.height} px`;
}

// MOSTRAR DATOS TÉCNICOS PROCESADOS
function showProcessedTechData(detalles) {
  if (!detalles) return;
  
  processedCanvasSize.textContent = `Tamaño del lienzo: ${detalles.dimensiones}`;
  processedBackground.textContent = `Fondo: Blanco`;
  processedProductSize.textContent = `Tamaño del producto: ${detalles.productoTamaño}`;
  processedScale.textContent = `Escala aplicada: ${detalles.escala}`;
  
  processedTech.classList.remove("hidden");
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
  originalButton.textContent = 'Procesando...';
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
      
      // AJUSTE 4: Mostrar alerta si falla ClipDrop pero continuar
      if (errorData.detalle && errorData.detalle.includes('ClipDrop')) {
        const userResponse = confirm("⚠️ API ClipDrop no disponible\n\nLa herramienta continuará funcionando en modo simulación.\n¿Desea continuar?");
        if (!userResponse) {
          throw new Error("Proceso cancelado por el usuario");
        }
        // Continuar con la simulación (el servidor ya lo hace automáticamente)
      } else {
        throw new Error(errorData.error || `Error del servidor: ${res.status}`);
      }
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
      drawProcessedImage();
      
      // AJUSTE 5: Mostrar datos técnicos procesados
      showProcessedTechData(result.detalles);
      
      console.log("📊 Procesamiento completado:", result.detalles);
      
      originalButton.textContent = 'Reprocesar imagen';
      originalButton.disabled = false;
    };
    
  } catch (error) {
    console.error("Error:", error);
    
    // No mostrar alerta si fue cancelación del usuario
    if (!error.message.includes("cancelado")) {
      alert("Error al procesar la imagen: " + error.message);
    }
    
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

// CONTROL DE ZOOM (ajuste fino)
zoom.addEventListener("input", () => {
  currentScale = zoom.value / 100;
  if (processedImage) {
    drawProcessedImage();
  }
});

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
  updateCanvasSize(); // Establecer tamaño inicial del canvas
}
initialize();
