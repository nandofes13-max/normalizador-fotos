from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import zipfile
from PIL import Image
import io

app = FastAPI(title="Normalizador Fotos Ecommerce", version="1.0.0")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Crear directorio temporal
os.makedirs("temp", exist_ok=True)

@app.get("/")
async def root():
    return {"message": "Normalizador de Fotos para Ecommerce", "status": "active"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/process")
async def process_images(
    files: list[UploadFile] = File(...),
    platform: str = "kyte",
    height_percent: int = 75,
    width_percent: int = 70
):
    """
    Procesa imágenes para diferentes plataformas de ecommerce
    """
    try:
        if len(files) < 1 or len(files) > 6:
            raise HTTPException(400, "Debes subir entre 1 y 6 imágenes")
        
        # Configuración por plataforma
        platform_configs = {
            "kyte": {"width": 1200, "height": 1000},
            "jumpseller": {"width": 800, "height": 800}
        }
        
        config = platform_configs.get(platform, platform_configs["kyte"])
        
        processed_files = []
        
        for file in files:
            # Leer imagen
            image_data = await file.read()
            image = Image.open(io.BytesIO(image_data))
            
            # Crear canvas según plataforma
            canvas = Image.new("RGB", (config["width"], config["height"]), "white")
            
            # Calcular tamaño del producto
            target_height = config["height"] * height_percent / 100
            target_width = config["width"] * width_percent / 100
            
            # Escalado SIMPLE - mantener relación de aspecto
            image.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
            
            # Calcular posición para centrar
            x = (config["width"] - image.width) / 2
            y = (config["height"] - image.height) / 2
            
            # Pegar imagen en el canvas
            canvas.paste(image, (int(x), int(y)))
            
            # Guardar imagen procesada
            output_filename = f"temp/{platform}_{file.filename.split('.')[0]}_{config['width']}x{config['height']}.png"
            canvas.save(output_filename, "PNG")
            processed_files.append(output_filename)
        
        # Crear ZIP
        zip_filename = f"temp/{platform}_imagenes.zip"
        with zipfile.ZipFile(zip_filename, 'w') as zipf:
            for file in processed_files:
                zipf.write(file, os.path.basename(file))
        
        return FileResponse(
            zip_filename,
            media_type='application/zip',
            filename=f"{platform}_imagenes_optimizadas.zip"
        )
        
    except Exception as e:
        raise HTTPException(500, f"Error procesando imágenes: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
