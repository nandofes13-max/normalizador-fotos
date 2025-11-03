import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import sharp from "sharp";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));
app.use(express.json());

const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

app.post("/process", upload.single("image"), async (req, res) => {
  try {
    const form = new FormData();
    form.append("image_file", fs.createReadStream(req.file.path));

    // Llamada a ClipDrop
    const response = await axios.post(
      "https://clipdrop-api.co/remove-background/v1",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "x-api-key": CLIPDROP_API_KEY,
        },
        responseType: "arraybuffer",
      }
    );

    const outputBuffer = await sharp(response.data)
      .resize({
        width: 800,
        height: 800,
        fit: "contain",
        background: "#ffffff",
      })
      .toBuffer();

    fs.unlinkSync(req.file.path); // borra archivo temporal

    res.set("Content-Type", "image/png");
    res.send(outputBuffer);
  } catch (error) {
    console.error("Error procesando imagen:", error.message);
    res.status(500).json({ error: "Error procesando imagen" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
