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

# TAMAÑOS ESTÁNDAR DEL PRODUCTO (después de recortar)
PRODUCT_SIZES = {
    "kyte": {"width": 840, "height": 750},    # 70% de 1200, 75% de 1000
    "jumpseller": {"width": 720, "height": 720} # 90% de 800x800
}

def extract_product(image):
    """
    Recorta el producto eliminando fondos/márgenes
    """
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Encontrar área no-blanca del producto
    bbox = image.getbbox()
    
    if bbox:
        return image.crop(bbox)
    return image

def resize_to_standard(image, target_width, target_height):
    """
    Escala el producto a tamaño estándar manteniendo relación de aspecto
    """
    # Calcular escala manteniendo relación
    scale_x = target_width / image.width
    scale_y = target_height / image.height
    scale = min(scale_x, scale_y)  # Usar escala más pequeña para que quepa
    
    new_width = int(image.width * scale)
    new_height = int(image.height * scale)
    
    return image.resize((new_width, new_height), Image.Resampling.LANCZOS)

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
        product_size = PRODUCT_SIZES.get(platform, PRODUCT_SIZES["kyte"])
        
        processed_files = []
        
        for file in files:
            # Leer imagen
            image_data = await file.read()
            image = Image.open(io.BytesIO(image_data))
            
            # 🔥 PROCESO CORREGIDO:
            # 1. RECORTAR producto
            product = extract_product(image)
            
            # 2. ESCALAR a tamaño estándar
            standardized_product = resize_to_standard(product, product_size["width"], product_size["height"])
            
            # 3. CREAR lienzo blanco
            canvas = Image.new("RGB", (config["width"], config["height"]), "white")
            
            # 4. CALCULAR posición para centrar
            x = (config["width"] - standardized_product.width) // 2
            y = (config["height"] - standardized_product.height) // 2
            
            # 5. PEGAR producto en lienzo
            canvas.paste(standardized_product, (x, y))
            
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
