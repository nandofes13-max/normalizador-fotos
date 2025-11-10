class ImageNormalizer {
    constructor() {
        this.currentImage = null;
        this.currentFormat = "jumpsellerCuadrado";
        this.originalTechData = null;
        this.currentProcessedImage = null;
        this.currentScale = 80;
        this.selectedFilter = "none";
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Upload compacto
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('imageInput').click();
        });

        // Input de archivo
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleFileSelect(e));

        // Select de formato
        document.getElementById('formatSelect').addEventListener('change', (e) => {
            this.currentFormat = e.target.value;
        });

        // Select de filtro
        document.getElementById('filterSelect').addEventListener('change', (e) => {
            this.selectedFilter = e.target.value;
        });

        // Slider de escala mini
        document.getElementById('scaleSliderMini').addEventListener('input', (e) => {
            this.currentScale = parseInt(e.target.value);
            document.getElementById('scaleValueMini').textContent = `${this.currentScale}%`;
            document.getElementById('manualScaleInput').value = this.currentScale;
        });

        // ✅ CAMPO MANUAL DE ESCALA
        document.getElementById('manualScaleInput').addEventListener('change', (e) => {
            let value = parseInt(e.target.value);
            // Validar rango
            if (value < 25) value = 25;
            if (value > 200) value = 200;
            
            this.currentScale = value;
            document.getElementById('scaleSliderMini').value = value;
            document.getElementById('scaleValueMini').textContent = `${value}%`;
            e.target.value = value;
        });

        // Botones de acción
        document.getElementById('processBtn').addEventListener('click', () => this.processImage());
        document.getElementById('applyScaleBtn').addEventListener('click', () => this.applyScaleOnly());
        document.getElementById('applyFilterBtn').addEventListener('click', () => this.applyFilterAction());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());

        // Drag & drop
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.handleImageFile(files[0]);
                document.getElementById('fileName').textContent = files[0].name;
            }
        });
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.handleImageFile(files[0]);
            document.getElementById('fileName').textContent = files[0].name;
        }
    }

    async handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showError('Por favor, selecciona un archivo de imagen válido.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError('La imagen es demasiado grande. Máximo 10MB.');
            return;
        }

        this.currentImage = file;
        this.showLoading('🔍 Detectando producto y analizando imagen...');

        try {
            const detectionData = await this.detectProduct(file);
            this.originalTechData = detectionData;
            
            await this.displayOriginalImagePreview(file);
            this.displayTechSpecsCompact(detectionData.originalTech);
            
            document.getElementById('previewCompact').style.display = 'block';
            document.getElementById('processBtn').disabled = false;
            
            this.hideLoading();
            this.showSuccess('✅ Imagen cargada y analizada correctamente');

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
                document.getElementById('originalImageCompact').src = e.target.result;
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    displayTechSpecsCompact(techData) {
        const specsContainer = document.getElementById('originalSpecsCompact');
        specsContainer.innerHTML = `
            <div class="specs-list">
                <div class="spec-item-compact">
                    <span>Lienzo Original:</span>
                    <span>${techData.originalCanvas}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Producto Detectado:</span>
                    <span>${techData.originalProduct}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Izquierdo:</span>
                    <span>${techData.marginLeft}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Derecho:</span>
                    <span>${techData.marginRight}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Superior:</span>
                    <span>${techData.marginTop}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Inferior:</span>
                    <span>${techData.marginBottom}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Fondo Detectado:</span>
                    <span>${techData.originalBackground}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Escala Original:</span>
                    <span>${techData.originalScale}</span>
                </div>
            </div>
        `;
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
            const result = await this.sendProcessRequest(this.currentScale, "none", true);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('🎉 Imagen normalizada correctamente!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error al procesar la imagen: ' + error.message);
        }
    }

    async applyScaleOnly() {
        console.log('🔍 DEBUG: Aplicando solo escala');
        console.log('🔍 DEBUG: Nueva escala =', this.currentScale);
        console.log('🔍 DEBUG: Filtro actual =', this.selectedFilter);
        
        if (!this.currentImage || !this.currentFormat) {
            this.showError('No hay imagen para reprocesar.');
            return;
        }

        this.showLoading('📏 Ajustando escala...');

        try {
            const result = await this.sendProcessRequest(this.currentScale, this.selectedFilter, false);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('✅ Escala ajustada correctamente!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error al ajustar escala: ' + error.message);
        }
    }

    async applyFilterAction() {
        console.log('🔍 DEBUG: Aplicando/Quitando filtro');
        console.log('🔍 DEBUG: Filtro seleccionado =', this.selectedFilter);
        console.log('🔍 DEBUG: Escala actual =', this.currentScale);
        
        if (!this.currentImage || !this.currentFormat) {
            this.showError('No hay imagen para reprocesar.');
            return;
        }

        const loadingMessage = this.selectedFilter === "none" 
            ? '🔄 Quitando filtros...' 
            : `🎨 Aplicando filtro ${this.selectedFilter}...`;
        
        this.showLoading(loadingMessage);

        try {
            const isInitialProcess = this.selectedFilter === "none";
            const result = await this.sendProcessRequest(this.currentScale, this.selectedFilter, isInitialProcess);
            
            this.displayProcessedResult(result);
            this.hideLoading();
            
            const successMessage = this.selectedFilter === "none" 
                ? '✅ Filtros quitados correctamente!' 
                : `✅ Filtro ${this.selectedFilter} aplicado correctamente!`;
            
            this.showSuccess(successMessage);

        } catch (error) {
            this.hideLoading();
            this.showError('Error al aplicar filtro: ' + error.message);
        }
    }

    async sendProcessRequest(scale, filter = "none", isInitialProcess = false) {
        console.log('🔍 DEBUG: Enviando solicitud con:');
        console.log('  - Escala:', scale);
        console.log('  - Filtro:', filter);
        console.log('  - Proceso inicial:', isInitialProcess);
        
        const formData = new FormData();
        formData.append('imagen', this.currentImage);
        formData.append('imageFormat', this.currentFormat);
        formData.append('userScale', scale.toString());
        formData.append('filter', filter);
        formData.append('isInitialProcess', isInitialProcess.toString());

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
        document.getElementById('processedImageCompact').src = result.procesada;
        this.currentProcessedImage = result.procesada;
        
        this.displayProcessedTechSpecsCompact(result.processedTech);
    }

    displayProcessedTechSpecsCompact(techData) {
        const specsContainer = document.getElementById('processedSpecsCompact');
        specsContainer.innerHTML = `
            <div class="specs-list">
                <div class="spec-item-compact">
                    <span>Lienzo Procesado:</span>
                    <span>${techData.processedCanvas}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Producto Procesado:</span>
                    <span>${techData.processedProduct}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Izquierdo:</span>
                    <span>${techData.marginLeft}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Derecho:</span>
                    <span>${techData.marginRight}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Superior:</span>
                    <span>${techData.marginTop}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Margen Inferior:</span>
                    <span>${techData.marginBottom}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Fondo Final:</span>
                    <span>${techData.processedBackground}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Escala Aplicada:</span>
                    <span>${techData.processedScale}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Escala Usuario:</span>
                    <span>${techData.userScale}</span>
                </div>
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
        const loading = document.getElementById('loadingCompact');
        loading.querySelector('span').textContent = message;
        loading.style.display = 'flex';
        
        // Deshabilitar botones
        document.getElementById('processBtn').disabled = true;
        document.getElementById('applyScaleBtn').disabled = true;
        document.getElementById('applyFilterBtn').disabled = true;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('uploadBtn').disabled = true;
    }

    hideLoading() {
        document.getElementById('loadingCompact').style.display = 'none';
        
        // Habilitar botones
        document.getElementById('processBtn').disabled = false;
        document.getElementById('applyScaleBtn').disabled = false;
        document.getElementById('applyFilterBtn').disabled = false;
        document.getElementById('downloadBtn').disabled = false;
        document.getElementById('uploadBtn').disabled = false;
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessageCompact');
        errorDiv.textContent = message;
        errorDiv.style.display = 'flex';
        document.getElementById('successMessageCompact').style.display = 'none';
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        const successDiv = document.getElementById('successMessageCompact');
        successDiv.textContent = message;
        successDiv.style.display = 'flex';
        document.getElementById('errorMessageCompact').style.display = 'none';
        
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
