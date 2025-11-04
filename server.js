import express from "express";
import multer from "multer";
import axios from "axios";
import fs from "fs";
import sharp from "sharp";

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 10000;
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

app.use(express.static("public"));

app.post("/process", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No se subió ninguna imagen");

    const imageBuffer = fs.readFileSync(req.file.path);

    // Enviar la imagen a ClipDrop (Remove Background)
    const clipdropResponse = await axios.post(
      "https://clipdrop-api.co/remove-background/v1",
      imageBuffer,
      {
        headers: {
          "x-api-key": CLIPDROP_API_KEY,
          "Content-Type": "application/octet-stream",
        },
        responseType: "arraybuffer",
      }
    );

    // Redimensionar y colocar fondo blanco normalizado
    const processedImage = await sharp(clipdropResponse.data)
      .resize({
        width: 527,
        height: 527,
        fit: "contain",
        background: { r: 255, g: 255, b: 255 },
      })
      .png()
      .toBuffer();

    fs.unlinkSync(req.file.path);
    res.set("Content-Type", "image/png");
    res.send(processedImage);

  } catch (error) {
    if (error.response) {
      console.error(
        "Error procesando imagen (respuesta API):",
        error.response.status,
        error.response.data?.toString()
      );
    } else {
      console.error("Error procesando imagen:", error.message);
    }
    res.status(500).send("Error procesando la imagen");
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
