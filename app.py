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

# TAMAÑOS MÁXIMOS AGRESIVOS - forzar que ocupe casi todo el espacio
PRODUCT_SIZES = {
    "kyte": {"width": 1000, "height": 900},    # 83% de 1200, 90% de 1000
    "jumpseller": {"width": 750, "height": 750} # 94% de 800x800
}

def aggressive_resize(image, target_width, target_height):
    """
    Escalado AGRESIVO - fuerza a ocupar el máximo espacio posible
    """
    # Calcular escalas
    scale_x = target_width / image.width
    scale_y = target_height / image.height
    
    # Usar la escala MÁS GRANDE + 5% extra para forzar tamaño
    scale = max(scale_x, scale_y) * 1.05
    
    new_width = int(image.width * scale)
    new_height = int(image.height * scale)
    
    # Redimensionar
    resized = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Si después del escalado sigue siendo muy pequeño, forzar más
    if resized.width < target_width * 0.9 or resized.height < target_height * 0.9:
        return image.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    return resized

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
    height_percent: int = 85,  # Valores más altos por defecto
    width_percent: int = 80    # Valores más altos por defecto
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
        
        # Calcular tamaño dinámicamente basado en los porcentajes
        product_width = int(config["width"] * (width_percent / 100))
        product_height = int(config["height"] * (height_percent / 100))
        
        processed_files = []
        
        for file in files:
            # Leer imagen
            image_data = await file.read()
            image = Image.open(io.BytesIO(image_data))
            
            # 🔥 ESCALADO AGRESIVO
            resized_product = aggressive_resize(image, product_width, product_height)
            
            # CREAR lienzo blanco
            canvas = Image.new("RGB", (config["width"], config["height"]), "white")
            
            # CALCULAR posición para centrar
            x = (config["width"] - resized_product.width) // 2
            y = (config["height"] - resized_product.height) // 2
            
            # Si la imagen es más grande que el espacio disponible, recortar
            if resized_product.width > config["width"] or resized_product.height > config["height"]:
                left = max(0, (resized_product.width - config["width"]) // 2)
                top = max(0, (resized_product.height - config["height"]) // 2)
                right = min(resized_product.width, left + config["width"])
                bottom = min(resized_product.height, top + config["height"])
                resized_product = resized_product.crop((left, top, right, bottom))
                x, y = 0, 0  # Centrado automático después del crop
            
            # PEGAR producto en lienzo
            canvas.paste(resized_product, (x, y))
            
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
