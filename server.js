import express from "express";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 10000;

// Configuración para rutas absolutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));

// --- RUTA: procesar imagen ---
app.post("/api/procesar", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No se recibió ninguna imagen" });
    }

    // Convierte la imagen base64 a binario
    const buffer = Buffer.from(imageBase64.split(",")[1], "base64");

    const formData = new FormData();
    formData.append("image_file", buffer, { filename: "upload.png" });

    // Llamada a la API de ClipDrop
    const response = await axios.post("https://clipdrop-api.co/remove-background/v1", formData, {
      headers: {
        ...formData.getHeaders(),
        "x-api-key": "mObkuUk7EOWWh8odnC9CoIRQtnv2"
      },
      responseType: "arraybuffer"
    });

    // Devuelve la imagen procesada como base64
    const resultBase64 = Buffer.from(response.data).toString("base64");
    res.json({ image: `data:image/png;base64,${resultBase64}` });

  } catch (error) {
    console.error("Error procesando imagen:", error.message);
    res.status(500).json({ error: "No se pudo procesar la imagen" });
  }
});

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
