from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import zipfile
from PIL import Image
import io
import base64

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

# Configuración por plataforma
PLATFORM_CONFIGS = {
    "kyte": {"width": 1200, "height": 1000},
    "jumpseller": {"width": 800, "height": 800}
}

@app.get("/")
async def root():
    return {"message": "Normalizador de Fotos para Ecommerce", "status": "active"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/preview")
async def preview_image(
    file: UploadFile = File(...),
    platform: str = "kyte",
    height_percent: int = 75,
    width_percent: int = 70
):
    """
    Devuelve preview de antes/después sin guardar archivo
    """
    try:
        # 🔥 CORRECCIÓN: Usar la plataforma correcta
        config = PLATFORM_CONFIGS.get(platform)
        if not config:
            config = PLATFORM_CONFIGS["kyte"]  # Fallback seguro
        
        print(f"📱 Procesando para plataforma: {platform} - {config['width']}x{config['height']}px")
        
        # Leer imagen original
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Crear canvas para imagen procesada
        canvas = Image.new("RGB", (config["width"], config["height"]), "white")
        
        # Calcular tamaño del producto
        target_height = int(config["height"] * height_percent / 100)
        target_width = int(config["width"] * width_percent / 100)
        
        print(f"🎯 Tamaño producto: {target_width}x{target_height}px")
        
        # Escalado SIMPLE
        image.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Calcular posición para centrar
        x = (config["width"] - image.width) // 2
        y = (config["height"] - image.height) // 2
        
        # Pegar imagen en el canvas
        canvas.paste(image, (int(x), int(y)))
        
        # Convertir a base64 para el frontend
        buffered = io.BytesIO()
        canvas.save(buffered, format="PNG")
        processed_base64 = base64.b64encode(buffered.getvalue()).decode()
        
        # También convertir original a base64
        buffered_original = io.BytesIO()
        Image.open(io.BytesIO(image_data)).save(buffered_original, format="PNG")
        original_base64 = base64.b64encode(buffered_original.getvalue()).decode()
        
        return JSONResponse({
            "original": f"data:image/png;base64,{original_base64}",
            "processed": f"data:image/png;base64,{processed_base64}",
            "platform": platform,
            "dimensions": f"{config['width']}x{config['height']}px"
        })
        
    except Exception as e:
        print(f"❌ Error en preview: {str(e)}")
        raise HTTPException(500, f"Error procesando imagen: {str(e)}")

@app.post("/download")
async def download_image(
    file: UploadFile = File(...),
    platform: str = "kyte", 
    height_percent: int = 75,
    width_percent: int = 70
):
    """
    Descarga la imagen procesada
    """
    try:
        # 🔥 CORRECCIÓN: Usar la plataforma correcta
        config = PLATFORM_CONFIGS.get(platform)
        if not config:
            config = PLATFORM_CONFIGS["kyte"]  # Fallback seguro
            
        print(f"📥 Descargando para plataforma: {platform} - {config['width']}x{config['height']}px")
        
        # Leer imagen
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Crear canvas
        canvas = Image.new("RGB", (config["width"], config["height"]), "white")
        
        # Calcular tamaño del producto
        target_height = int(config["height"] * height_percent / 100)
        target_width = int(config["width"] * width_percent / 100)
        
        # Escalado
        image.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Calcular posición para centrar
        x = (config["width"] - image.width) // 2
        y = (config["height"] - image.height) // 2
        
        # Pegar imagen en el canvas
        canvas.paste(image, (int(x), int(y)))
        
        # Guardar imagen procesada
        output_filename = f"temp/{platform}_{file.filename.split('.')[0]}_{config['width']}x{config['height']}.png"
        canvas.save(output_filename, "PNG")
        
        return FileResponse(
            output_filename,
            media_type='image/png',
            filename=f"{platform}_optimizada.png"
        )
        
    except Exception as e:
        print(f"❌ Error en download: {str(e)}")
        raise HTTPException(500, f"Error procesando imagen: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
