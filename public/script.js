const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const downloadBtn = document.getElementById("downloadBtn");
const originalImgElement = document.getElementById("original"); // Elemento para mostrar original

let originalImage = null;
let uploadedImage = null; // Imagen subida antes de procesar

// ✅ MOSTRAR IMAGEN ORIGINAL AL SUBIRLA
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    // Mostrar imagen original en el elemento <img>
    originalImgElement.src = event.target.result;
    
    // Crear objeto Image para usar luego en el canvas
    uploadedImage = new Image();
    uploadedImage.src = event.target.result;
    uploadedImage.onload = () => {
      // Mostrar el contenedor de previsualización
      previewContainer.classList.remove("hidden");
      
      // Dibujar la imagen original en el canvas temporalmente
      drawOriginalImage();
    };
  };
  reader.readAsDataURL(file);
});

// ✅ PROCESAR IMAGEN (remover fondo)
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = imageInput.files[0];
  if (!file) return;

  // Mostrar loading
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
    
    // Cargar la imagen procesada (sin fondo)
    const img = new Image();
    img.src = result.procesada;
    img.onload = () => {
      originalImage = img;
      // Dibujar la imagen procesada en canvas con fondo blanco
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

// ✅ DIBUJAR IMAGEN ORIGINAL (antes de procesar)
function drawOriginalImage() {
  if (!uploadedImage) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Dibujar fondo blanco
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Calcular dimensiones para mantener proporción
  const scale = Math.min(
    canvas.width / uploadedImage.width,
    canvas.height / uploadedImage.height,
    1 // No escalar más del 100%
  );
  
  const w = uploadedImage.width * scale;
  const h = uploadedImage.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  
  ctx.drawImage(uploadedImage, x, y, w, h);
}

// ✅ DIBUJAR IMAGEN PROCESADA (sin fondo + fondo blanco)
function drawProcessedImage(scale = 1) {
  if (!originalImage) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Dibujar fondo blanco
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Calcular dimensiones manteniendo proporción
  const imgScale = Math.min(
    (canvas.width / originalImage.width) * scale,
    (canvas.height / originalImage.height) * scale,
    1.5 // Límite máximo de zoom
  );
  
  const w = originalImage.width * imgScale;
  const h = originalImage.height * imgScale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  
  ctx.drawImage(originalImage, x, y, w, h);
}

// ✅ CONTROL DE ZOOM
zoom.addEventListener("input", () => {
  if (originalImage) {
    drawProcessedImage(zoom.value / 100);
  }
});

// ✅ DESCARGAR IMAGEN
downloadBtn.addEventListener("click", () => {
  if (!originalImage) {
    alert("No hay imagen procesada para descargar");
    return;
  }
  
  const link = document.createElement("a");
  link.download = "imagen_normalizada.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});
