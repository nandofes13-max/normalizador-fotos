import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

console.log("----------------------------------------------------");
console.log("🚀 Servidor iniciando...");
console.log(`🧩 Puerto: ${PORT}`);
console.log(`🔑 API key cargada: ${CLIPDROP_API_KEY ? "✅ Sí" : "❌ No detectada"}`);
console.log("----------------------------------------------------");

app.post("/process", upload.single("image"), async (req, res) => {
  if (!req.file) {
    console.error("❌ No se recibió ninguna imagen en el request.");
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  if (!CLIPDROP_API_KEY) {
    console.error("❌ Falta CLIPDROP_API_KEY en variables de entorno.");
    return res.status(500).json({ error: "Falta CLIPDROP_API_KEY" });
  }

  const imagePath = path.resolve(req.file.path);
  console.log("📸 Imagen recibida:", imagePath);

  try {
    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(imagePath));

    console.log("📡 Enviando solicitud a ClipDrop...");

    const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLIPDROP_API_KEY}` },
      body: formData,
    });

    console.log("📨 Respuesta ClipDrop status:", response.status);

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const json = await response.json();
      console.error("❌ Error procesando imagen (respuesta API):", response.status, JSON.stringify(json));
      return res.status(500).json({ error: json });
    }

    if (!response.ok) {
      console.error("❌ Error no JSON en ClipDrop:", response.status, await response.text());
      return res.status(500).json({ error: "Error no JSON desde ClipDrop" });
    }

    // Guardar imagen procesada
    const outputPath = path.resolve("processed", `${req.file.filename}-processed.png`);
    fs.mkdirSync("processed", { recursive: true });

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));

    console.log("✅ Imagen procesada correctamente:", outputPath);
    res.sendFile(outputPath);
  } catch (err) {
    console.error("💥 Error procesando imagen:", err);
    res.status(500).json({ error: "Error procesando imagen", details: err.message });
  } finally {
    fs.unlink(imagePath, () => {}); // limpia archivo temporal
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});
