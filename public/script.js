const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const downloadBtn = document.getElementById("downloadBtn");
const originalImgElement = document.getElementById("original");

let processedImage = null;
let currentScale = 1;

// ✅ MOSTRAR IMAGEN ORIGINAL AL SUBIRLA
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    originalImgElement.src = event.target.result;
    previewContainer.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

// ✅ PROCESAR IMAGEN (todo en el servidor)
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
    
    if (!result.success) {
      throw new Error(result.error || "Error desconocido");
    }

    // Cargar la imagen procesada (ya viene lista del servidor)
    const img = new Image();
    img.src = result.procesada;
    img.onload = () => {
      processedImage = img;
      currentScale = 1;
      zoom.value = 100;
      drawProcessedImage();
      
      // Mostrar detalles del procesamiento
      console.log("📊 Detalles del procesamiento:", result.detalles);
      
      originalButton.textContent = 'Procesar imagen';
      originalButton.disabled = false;
    };
    
  } catch (error) {
    console.error("Error:", error);
    alert("Error al procesar la imagen: " + error.message);
    originalButton.textContent = 'Procesar imagen';
    originalButton.disabled = false;
  }
});

// ✅ DIBUJAR IMAGEN PROCESADA CON ZOOM
function drawProcessedImage() {
  if (!processedImage) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const baseScale = Math.min(
    canvas.width / processedImage.width,
    canvas.height / processedImage.height,
    0.9
  );
  
  const finalScale = baseScale * currentScale;
  const w = processedImage.width * finalScale;
  const h = processedImage.height * finalScale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  
  ctx.drawImage(processedImage, x, y, w, h);
}

// ✅ CONTROL DE ZOOM
zoom.addEventListener("input", () => {
  currentScale = zoom.value / 100;
  if (processedImage) {
    drawProcessedImage();
  }
});

// ✅ DESCARGAR IMAGEN
downloadBtn.addEventListener("click", () => {
  if (!processedImage) {
    alert("No hay imagen procesada para descargar");
    return;
  }
  
  const link = document.createElement("a");
  link.download = "producto_normalizado.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// ✅ INICIALIZAR
function initialize() {
  currentScale = 1;
  zoom.value = 100;
}
initialize();
