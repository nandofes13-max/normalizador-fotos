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
            this.showError('Selecciona un archivo de imagen válido.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError('La imagen es demasiado grande. Máximo 10MB.');
            return;
        }

        this.currentImage = file;
        this.showLoading('Analizando imagen...');

        try {
            const detectionData = await this.detectProduct(file);
            this.originalTechData = detectionData;
            
            await this.displayOriginalImagePreview(file);
            this.displayTechSpecsCompact(detectionData.originalTech);
            
            document.getElementById('previewCompact').style.display = 'block';
            document.getElementById('processBtn').disabled = false;
            
            this.hideLoading();
            this.showSuccess('Imagen lista para procesar');

        } catch (error) {
            this.hideLoading();
            this.showError('Error: ' + error.message);
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
        const specsContainer = document.getElementById('techSpecsCompact');
        specsContainer.innerHTML = `
            <div class="specs-list">
                <div class="spec-item-compact">
                    <span>Lienzo:</span>
                    <span>${techData.originalCanvas}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Producto:</span>
                    <span>${techData.originalProduct}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Márgenes:</span>
                    <span>${techData.marginLeft} | ${techData.marginRight}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Escala:</span>
                    <span>${techData.originalScale}</span>
                </div>
            </div>
        `;
    }

    async processImage() {
        if (!this.currentImage) {
            this.showError('Selecciona una imagen primero.');
            return;
        }

        this.showLoading('Normalizando...');

        try {
            const result = await this.sendProcessRequest(this.currentScale, "none", true);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('Imagen normalizada!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error: ' + error.message);
        }
    }

    async applyScaleOnly() {
        if (!this.currentImage) {
            this.showError('No hay imagen para procesar.');
            return;
        }

        this.showLoading('Ajustando escala...');

        try {
            const result = await this.sendProcessRequest(this.currentScale, this.selectedFilter, false);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('Escala ajustada!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error: ' + error.message);
        }
    }

    async applyFilterAction() {
        if (!this.currentImage) {
            this.showError('No hay imagen para procesar.');
            return;
        }

        this.showLoading('Aplicando filtro...');

        try {
            const isInitialProcess = this.selectedFilter === "none";
            const result = await this.sendProcessRequest(this.currentScale, this.selectedFilter, isInitialProcess);
            
            this.displayProcessedResult(result);
            this.hideLoading();
            
            const message = this.selectedFilter === "none" 
                ? 'Filtros quitados!' 
                : 'Filtro aplicado!';
            
            this.showSuccess(message);

        } catch (error) {
            this.hideLoading();
            this.showError('Error: ' + error.message);
        }
    }

    async sendProcessRequest(scale, filter, isInitialProcess) {
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
        
        // Actualizar specs si es necesario
        this.displayProcessedTechSpecsCompact(result.processedTech);
    }

    displayProcessedTechSpecsCompact(techData) {
        const specsContainer = document.getElementById('techSpecsCompact');
        specsContainer.innerHTML = `
            <div class="specs-list">
                <div class="spec-item-compact">
                    <span>Lienzo:</span>
                    <span>${techData.processedCanvas}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Producto:</span>
                    <span>${techData.processedProduct}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Márgenes:</span>
                    <span>${techData.marginLeft} | ${techData.marginRight}</span>
                </div>
                <div class="spec-item-compact">
                    <span>Escala:</span>
                    <span>${techData.processedScale}</span>
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
        link.download = `normalizada-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showLoading(message) {
        const loading = document.getElementById('loadingCompact');
        loading.querySelector('span').textContent = message;
        loading.style.display = 'flex';
        
        // Deshabilitar botones
        document.querySelectorAll('button').forEach(btn => {
            if (btn.id !== 'uploadBtn') btn.disabled = true;
        });
    }

    hideLoading() {
        document.getElementById('loadingCompact').style.display = 'none';
        document.querySelectorAll('button').forEach(btn => {
            btn.disabled = false;
        });
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessageCompact');
        errorDiv.textContent = message;
        errorDiv.style.display = 'flex';
        document.getElementById('successMessageCompact').style.display = 'none';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 4000);
    }

    showSuccess(message) {
        const successDiv = document.getElementById('successMessageCompact');
        successDiv.textContent = message;
        successDiv.style.display = 'flex';
        document.getElementById('errorMessageCompact').style.display = 'none';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    new ImageNormalizer();
});
