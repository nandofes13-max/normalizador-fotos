class ImageNormalizer {
    constructor() {
        this.currentImage = null;
        this.currentFormat = null;
        this.originalTechData = null;
        this.currentProcessedImage = null;
        this.currentScale = 80;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Upload area
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');
        
        uploadArea.addEventListener('click', () => imageInput.click());
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        imageInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Format selection
        document.querySelectorAll('.format-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectFormat(e));
        });

        // Buttons
        document.getElementById('processBtn').addEventListener('click', () => this.processImage());
        document.getElementById('processFromPreviewBtn').addEventListener('click', () => this.processImage());
        document.getElementById('reprocessBtn').addEventListener('click', () => this.reprocessImage());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());

        // Scale slider
        document.getElementById('scaleSlider').addEventListener('input', (e) => {
            this.currentScale = parseInt(e.target.value);
            document.getElementById('scaleValue').textContent = `${this.currentScale}%`;
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.add('highlight');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('highlight');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleImageFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.handleImageFile(files[0]);
        }
    }

    async handleImageFile(file) {
        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
            this.showError('Por favor, selecciona un archivo de imagen válido.');
            return;
        }

        // Validar tamaño (10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('La imagen es demasiado grande. Máximo 10MB.');
            return;
        }

        this.currentImage = file;
        this.showLoading('🔍 Detectando producto y analizando imagen...');

        try {
            // Primero: detección automática para datos técnicos
            const detectionData = await this.detectProduct(file);
            this.originalTechData = detectionData;
            
            // Mostrar preview de la imagen original
            await this.displayOriginalImagePreview(file);
            
            // Mostrar datos técnicos originales EN EL PREVIEW
            this.displayOriginalTechSpecsPreview(detectionData.originalTech);
            
            // Mostrar sección de preview
            document.getElementById('previewSection').style.display = 'block';
            
            // Habilitar botón de procesar
            document.getElementById('processBtn').disabled = false;
            document.getElementById('processFromPreviewBtn').disabled = false;
            
            this.hideLoading();
            this.showSuccess('✅ Imagen cargada y analizada correctamente. Los datos técnicos están listos.');

            // Scroll al preview
            document.getElementById('previewSection').scrollIntoView({ 
                behavior: 'smooth' 
            });

        } catch (error) {
            this.hideLoading();
            this.showError('Error al analizar la imagen: ' + error.message);
        }
    }

    async detectProduct(file) {
        const formData = new FormData();
        formData.append('imagen', file);

        const response = await fetch('/detectar', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detalle || 'Error en la detección');
        }

        return await response.json();
    }

    async displayOriginalImagePreview(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Actualizar imagen en el preview
                document.getElementById('originalImagePreview').src = e.target.result;
                // También actualizar imagen en la sección de resultados
                document.getElementById('originalImage').src = e.target.result;
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    displayOriginalTechSpecsPreview(techData) {
        const specsContainer = document.getElementById('originalSpecsPreview');
        specsContainer.innerHTML = `
            <div class="spec-item">
                <div class="spec-label">Lienzo Original</div>
                <div class="spec-value">${techData.originalCanvas}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Producto Detectado</div>
                <div class="spec-value">${techData.originalProduct}</div>
            </div>
            <!-- MÁRGENES INDIVIDUALES -->
            <div class="spec-item">
                <div class="spec-label">Margen Izquierdo</div>
                <div class="spec-value">${techData.marginLeft}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Margen Derecho</div>
                <div class="spec-value">${techData.marginRight}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Margen Superior</div>
                <div class="spec-value">${techData.marginTop}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Margen Inferior</div>
                <div class="spec-value">${techData.marginBottom}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Fondo Detectado</div>
                <div class="spec-value">${techData.originalBackground}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Escala Original</div>
                <div class="spec-value">${techData.originalScale}</div>
            </div>
        `;

        // También actualizar la sección de resultados con los mismos datos
        const resultsSpecsContainer = document.getElementById('originalSpecs');
        resultsSpecsContainer.innerHTML = specsContainer.innerHTML;
    }

    selectFormat(e) {
        // Remover selección anterior
        document.querySelectorAll('.format-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Agregar selección nueva
        e.currentTarget.classList.add('selected');
        this.currentFormat = e.currentTarget.dataset.format;
        
        console.log('Formato seleccionado:', this.currentFormat);
    }

    async processImage() {
        if (!this.currentImage) {
            this.showError('Por favor, selecciona una imagen primero.');
            return;
        }

        if (!this.currentFormat) {
            this.showError('Por favor, selecciona un formato de salida.');
            return;
        }

        this.showLoading('🔄 Normalizando imagen...');

        try {
            const result = await this.sendProcessRequest(this.currentScale);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('🎉 Imagen normalizada correctamente!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error al procesar la imagen: ' + error.message);
        }
    }

    async reprocessImage() {
        if (!this.currentImage || !this.currentFormat) {
            this.showError('No hay imagen para reprocesar.');
            return;
        }

        this.showLoading('🔄 Reprocesando con nueva escala...');

        try {
            const result = await this.sendProcessRequest(this.currentScale);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('✅ Imagen reprocesada correctamente!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error al reprocesar: ' + error.message);
        }
    }

    async sendProcessRequest(scale) {
        const formData = new FormData();
        formData.append('imagen', this.currentImage);
        formData.append('imageFormat', this.currentFormat);
        formData.append('userScale', scale.toString());

        const response = await fetch('/procesar', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detalle || 'Error en el procesamiento');
        }

        return await response.json();
    }

    displayProcessedResult(result) {
        // Ocultar preview y mostrar resultados
        document.getElementById('previewSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';
        
        // Mostrar imagen procesada
        document.getElementById('processedImage').src = result.procesada;
        this.currentProcessedImage = result.procesada;
        
        // Mostrar datos técnicos procesados
        this.displayProcessedTechSpecs(result.processedTech);
        
        // Mostrar sección de ajuste fino
        document.getElementById('adjustmentSection').style.display = 'block';
        
        // Resetear escala a 100% para nuevo reprocesamiento
        this.currentScale = 100;
        document.getElementById('scaleSlider').value = '100';
        document.getElementById('scaleValue').textContent = '100%';
        
        // Scroll a resultados
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    displayProcessedTechSpecs(techData) {
        const specsContainer = document.getElementById('processedSpecs');
        specsContainer.innerHTML = `
            <div class="spec-item">
                <div class="spec-label">Lienzo Procesado</div>
                <div class="spec-value">${techData.processedCanvas}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Producto Procesado</div>
                <div class="spec-value">${techData.processedProduct}</div>
            </div>
            <!-- MÁRGENES INDIVIDUALES DEL RESULTADO -->
            <div class="spec-item">
                <div class="spec-label">Margen Izquierdo</div>
                <div class="spec-value">${techData.marginLeft}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Margen Derecho</div>
                <div class="spec-value">${techData.marginRight}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Margen Superior</div>
                <div class="spec-value">${techData.marginTop}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Margen Inferior</div>
                <div class="spec-value">${techData.marginBottom}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Fondo Final</div>
                <div class="spec-value">${techData.processedBackground}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Escala Aplicada</div>
                <div class="spec-value">${techData.processedScale}</div>
            </div>
            <div class="spec-item">
                <div class="spec-label">Escala Usuario</div>
                <div class="spec-value">${techData.userScale}</div>
            </div>
        `;
    }

    downloadImage() {
        if (!this.currentProcessedImage) {
            this.showError('No hay imagen para descargar.');
            return;
        }

        const link = document.createElement('a');
        link.href = this.currentProcessedImage;
        link.download = `imagen-normalizada-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showLoading(message = 'Procesando...') {
        const loading = document.getElementById('loading');
        loading.style.display = 'block';
        loading.querySelector('p').textContent = message;
        
        document.getElementById('processBtn').disabled = true;
        document.getElementById('processFromPreviewBtn').disabled = true;
        if (document.getElementById('reprocessBtn')) {
            document.getElementById('reprocessBtn').disabled = true;
        }
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('processBtn').disabled = false;
        document.getElementById('processFromPreviewBtn').disabled = false;
        if (document.getElementById('reprocessBtn')) {
            document.getElementById('reprocessBtn').disabled = false;
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        document.getElementById('successMessage').style.display = 'none';
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        const successDiv = document.getElementById('successMessage');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        document.getElementById('errorMessage').style.display = 'none';
        
        // Auto-ocultar después de 3 segundos
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new ImageNormalizer();
});
