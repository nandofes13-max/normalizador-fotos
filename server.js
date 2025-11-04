import express from "express";
import multer from "multer";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/processed", express.static(path.join(__dirname, "processed")));

// Configuración de multer (subidas locales)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Ruta para subir y procesar imagen
app.post("/process-image", upload.single("image"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const apiKey = process.env.CLIPDROP_API_KEY;

    if (!apiKey) {
      console.error("Error: falta CLIPDROP_API_KEY en el entorno de Render");
      return res.status(500).json({ error: "Falta CLIPDROP_API_KEY" });
    }

    console.log("Procesando imagen con ClipDrop API...");

    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(filePath));

    const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Error procesando imagen (respuesta API):", response.status, text);
      return res.status(500).json({ error: "Error en ClipDrop", details: text });
    }

    // Guardar imagen procesada
    const outputDir = path.join(__dirname, "processed");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    const outputFilename = `processed-${req.file.filename}`;
    const outputPath = path.join(outputDir, outputFilename);

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));

    // Enviar URLs para previsualización (pantalla dividida)
    res.json({
      original: `/uploads/${req.file.filename}`,
      processed: `/processed/${outputFilename}`,
    });

    console.log("Imagen procesada correctamente.");
  } catch (error) {
    console.error("Error general procesando imagen:", error);
    res.status(500).json({ error: "Error general procesando imagen", details: error.message });
  }
});

// Servir index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
