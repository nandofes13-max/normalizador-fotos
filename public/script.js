const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const downloadBtn = document.getElementById("downloadBtn");

let originalImage = null;

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
    formData.append("imagen", file); // ✅ CORREGIDO: "imagen" en lugar de "image"

    // ✅ CORREGIDO: Endpoint correcto "/procesar"
    const res = await fetch("https://normalizador-fotos.onrender.com/procesar", { 
      method: "POST", 
      body: formData 
    });
    
    if (!res.ok) {
      throw new Error(`Error del servidor: ${res.status}`);
    }
    
    // ✅ CORREGIDO: El servidor devuelve JSON, no blob
    const result = await res.json();
    
    // Cargar la imagen procesada desde la URL que devuelve el servidor
    const img = new Image();
    img.src = result.procesada; // ✅ Usar la URL de la imagen procesada
    img.onload = () => {
      originalImage = img;
      drawImage(1);
      previewContainer.classList.remove("hidden");
    };
    
  } catch (error) {
    console.error("Error:", error);
    alert("Error al procesar la imagen. Verifica la consola para más detalles.");
  } finally {
    // Restaurar botón
    originalButton.textContent = 'Procesar imagen';
    originalButton.disabled = false;
  }
});

zoom.addEventListener("input", () => {
  if (originalImage) {
    drawImage(zoom.value / 100);
  }
});

function drawImage(scale) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = originalImage.width * scale;
  const h = originalImage.height * scale;
  ctx.drawImage(originalImage, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

downloadBtn.addEventListener("click", () => {
  if (!originalImage) {
    alert("No hay imagen para descargar");
    return;
  }
  
  const link = document.createElement("a");
  link.download = "imagen_normalizada.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});
