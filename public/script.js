const form = document.getElementById("uploadForm");
const imageInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("preview-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const zoom = document.getElementById("zoom");
const downloadBtn = document.getElementById("download");

let originalImage = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = imageInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("/process", { method: "POST", body: formData });
  const blob = await res.blob();
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.onload = () => {
    originalImage = img;
    drawImage(1);
    previewContainer.classList.remove("hidden");
  };
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
  const link = document.createElement("a");
  link.download = "imagen_normalizada.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});
