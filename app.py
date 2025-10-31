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

def resize_image_to_fit(image, target_width, target_height):
    """
    Redimensiona imagen manteniendo relación de aspecto
    pero forzando a ocupar el espacio máximo
    """
    # Calcular escalas
    scale_x = target_width / image.width
    scale_y = target_height / image.height
    
    # Usar la escala MÁS GRANDE para llenar el espacio
    scale = max(scale_x, scale_y)
    
    new_width = int(image.width * scale)
    new_height = int(image.height * scale)
    
    # Redimensionar
    resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return resized_image

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
            product_width = int(config["width"] * (width_percent / 100))
            product_height = int(config["height"] * (height_percent / 100))
            
            # 🔥 ESCALADO INTELIGENTE - Mantiene relación pero llena espacio
            image = resize_image_to_fit(image, product_width, product_height)
            
            # Calcular posición para centrar
            x = (config["width"] - image.width) // 2
            y = (config["height"] - image.height) // 2
            
            # Pegar imagen en el canvas
            canvas.paste(image, (x, y))
            
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
