const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const imageFormatSelect = document.getElementById("imageFormat");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const downloadBtn = document.getElementById("downloadBtn");
const originalImgElement = document.getElementById("original");

let processedImage = null;
let currentScale = 1;
let currentImageFile = null;

// ACTUALIZAR TAMAÑO DEL CANVAS SEGÚN FORMATO
function updateCanvasSize() {
  const format = imageFormatSelect.value;
  const sizes = {
    square: { width: 527, height: 527 },
    portrait: { width: 527, height: 702 },
    landscape: { width: 527, height: 296 },
    rectangular: { width: 527, height: 395 }
  };
  
  const size = sizes[format];
  canvas.width = size.width;
  canvas.height = size.height;
  
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

  currentImageFile = file; // Guardar archivo para reprocesar

  const reader = new FileReader();
  reader.onload = (event) => {
    originalImgElement.src = event.target.result;
    previewContainer.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

// PROCESAR IMAGEN CON FORMATO JUMPSELLER
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
      drawProcessedImage();
      
      console.log("📊 Imagen lista para Jumpseller:", result.detalles);
      
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
    square: "cuadrado",
    portrait: "retrato", 
    landscape: "apaisado",
    rectangular: "rectangular"
  };
  
  const link = document.createElement("a");
  link.download = `jumpseller_${formatNames[imageFormatSelect.value]}.png`;
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
