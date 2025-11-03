import express from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 10000;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

app.use(express.static("public"));
app.use(express.json());

// 📸 Procesar imagen
app.post("/process", upload.single("image"), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const outputPath = `processed_${Date.now()}.png`;

    // Llamada a la API de ClipDrop (remove background)
    const response = await axios.post(
      "https://clipdrop-api.co/remove-background/v1",
      fs.createReadStream(inputPath),
      {
        headers: {
          "x-api-key": CLIPDROP_API_KEY,
          "Content-Type": "application/octet-stream"
        },
        responseType: "arraybuffer"
      }
    );

    // Crea un lienzo blanco 800x800px
    const whiteCanvas = sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });

    // Redimensiona la imagen sin fondo para ajustarla al lienzo
    const productImage = sharp(response.data).resize(700, 700, {
      fit: "inside",
      background: { r: 255, g: 255, b: 255 }
    });

    // Combina el producto centrado sobre el lienzo blanco
    const buffer = await whiteCanvas
      .composite([{ input: await productImage.toBuffer(), gravity: "center" }])
      .png()
      .toBuffer();

    fs.writeFileSync(outputPath, buffer);
    fs.unlinkSync(inputPath);

    res.sendFile(path.resolve(outputPath), (err) => {
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("Error procesando imagen:", error.message);
    res.status(500).send("Error procesando la imagen");
  }
});

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
