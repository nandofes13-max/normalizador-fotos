import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import path from "path";
import fs from "fs";

const app = express();
const port = process.env.PORT || 10000;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

app.use(cors());
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});

app.post("/procesar", upload.single("imagen"), async (req, res) => {
  const imagen = req.file;

  if (!imagen) {
    console.error("❌ No se recibió ninguna imagen");
    return res.status(400).json({ error: "No se recibió ninguna imagen" });
  }

  console.log("📸 Imagen recibida:", imagen.originalname);
  console.log("🧩 Enviando a ClipDrop API...");

  try {
    const formData = new FormData();
    formData.append("image_file", fs.createReadStream(imagen.path));

    const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLIPDROP_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`⚠️ Error procesando imagen (respuesta API): ${response.status} ${errorText}`);
      return res.status(response.status).json({ error: "Error desde ClipDrop API", detalle: errorText });
    }

    const buffer = await response.arrayBuffer();
    console.log("✅ Fondo removido correctamente.");

    // Guardar resultado temporalmente
    const outputPath = path.join("uploads", `procesada_${Date.now()}.png`);
    fs.writeFileSync(outputPath, Buffer.from(buffer));

    // Devolver URL temporal para previsualizar
    res.json({
      original: `/uploads/${imagen.filename}`,
      procesada: `/${outputPath}`,
    });

  } catch (err) {
    console.error("💥 Error interno procesando imagen:", err);
    res.status(500).json({ error: "Error interno del servidor", detalle: err.message });
  }
});

// Servir imágenes temporales
app.use("/uploads", express.static("uploads"));

app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en puerto ${port}`);
});
