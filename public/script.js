const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const downloadBtn = document.getElementById("downloadBtn");
const originalImgElement = document.getElementById("original");

let originalImage = null;
let uploadedImage = null;
let currentScale = 1;
let croppedImage = null; // Imagen recortada

// ✅ MOSTRAR IMAGEN ORIGINAL AL SUBIRLA
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    originalImgElement.src = event.target.result;
    
    uploadedImage = new Image();
    uploadedImage.src = event.target.result;
    uploadedImage.onload = () => {
      previewContainer.classList.remove("hidden");
      drawOriginalImage();
    };
  };
  reader.readAsDataURL(file);
});

// ✅ PROCESAR IMAGEN CON RECORTE AUTOMÁTICO
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = imageInput.files[0];
  if (!file) return;

  const originalButton = form.querySelector('button');
  originalButton.textContent = 'Procesando...';
  originalButton.disabled = true;

  try {
    const formData = new FormData();
    formData.append("imagen", file);

    const res = await fetch("https://normalizador-fotos.onrender.com/procesar", { 
      method: "POST", 
      body: formData 
    });
    
    if (!res.ok) {
      throw new Error(`Error del servidor: ${res.status}`);
    }
    
    const result = await res.json();
    
    const img = new Image();
    img.src = result.procesada;
    img.onload = async () => {
      // ✅ RECORTAR BORDES TRANSPARENTES
      originalImage = img;
      croppedImage = await autoCropTransparent(img);
      
      currentScale = 1;
      zoom.value = 100;
      drawProcessedImage();
      originalButton.textContent = 'Procesar imagen';
      originalButton.disabled = false;
    };
    
  } catch (error) {
    console.error("Error:", error);
    alert("Error al procesar la imagen. Verifica la consola para más detalles.");
    originalButton.textContent = 'Procesar imagen';
    originalButton.disabled = false;
  }
});

// ✅ FUNCIÓN RECORTE AUTOMÁTICO (Opción 1)
async function autoCropTransparent(image) {
  return new Promise((resolve) => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    tempCtx.drawImage(image, 0, 0);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    let top = tempCanvas.height, bottom = 0, left = tempCanvas.width, right = 0;
    
    // Encontrar los bordes reales del contenido
    for (let y = 0; y < tempCanvas.height; y++) {
      for (let x = 0; x < tempCanvas.width; x++) {
        const alpha = data[(y * tempCanvas.width + x) * 4 + 3];
        if (alpha > 10) { // Umbral de transparencia
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }
    
    const width = Math.max(1, right - left + 1);
    const height = Math.max(1, bottom - top + 1);
    
    console.log(`✂️ Recortando de ${image.width}x${image.height} a ${width}x${height}`);
    
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    // Dibujar con fondo blanco
    croppedCtx.fillStyle = 'white';
    croppedCtx.fillRect(0, 0, width, height);
    croppedCtx.drawImage(
      tempCanvas,
      left, top, width, height,
      0, 0, width, height
    );
    
    const croppedImage = new Image();
    croppedImage.onload = () => resolve(croppedImage);
    croppedImage.src = croppedCanvas.toDataURL('image/png');
  });
}

// ✅ DIBUJAR IMAGEN ORIGINAL
function drawOriginalImage() {
  if (!uploadedImage) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const scale = Math.min(
    canvas.width / uploadedImage.width,
    canvas.height / uploadedImage.height,
    0.8
  );
  
  const w = uploadedImage.width * scale;
  const h = uploadedImage.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  
  ctx.drawImage(uploadedImage, x, y, w, h);
}

// ✅ DIBUJAR IMAGEN PROCESADA Y RECORTADA
function drawProcessedImage() {
  const imageToDraw = croppedImage || originalImage;
  if (!imageToDraw) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const baseScale = Math.min(
    canvas.width / imageToDraw.width,
    canvas.height / imageToDraw.height,
    0.8
  );
  
  const finalScale = baseScale * currentScale;
  const w = imageToDraw.width * finalScale;
  const h = imageToDraw.height * finalScale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  
  ctx.drawImage(imageToDraw, x, y, w, h);
}

// ✅ CONTROL DE ZOOM
zoom.addEventListener("input", () => {
  currentScale = zoom.value / 100;
  if (croppedImage || originalImage) {
    drawProcessedImage();
  }
});

// ✅ DESCARGAR IMAGEN
downloadBtn.addEventListener("click", () => {
  if (!croppedImage && !originalImage) {
    alert("No hay imagen procesada para descargar");
    return;
  }
  
  const link = document.createElement("a");
  link.download = "imagen_normalizada.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// ✅ INICIALIZAR
function initialize() {
  currentScale = 1;
  zoom.value = 100;
}
initialize();
