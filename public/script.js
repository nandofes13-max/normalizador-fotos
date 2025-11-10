class ImageNormalizer {
    constructor() {
        this.currentImage = null;
        this.currentFormat = "jumpsellerCuadrado";
        this.originalTechData = null;
        this.currentProcessedImage = null;
        this.currentScale = 80;
        this.selectedFilter = "none";
        
        this.initializeEventListeners();
        this.selectDefaultFormat();
        this.initializeFilterListeners();
    }

    // ✅ FUNCIÓN: Seleccionar visualmente el formato por defecto
    selectDefaultFormat() {
        const defaultFormat = document.querySelector('[data-format="jumpsellerCuadrado"]');
        if (defaultFormat) {
            defaultFormat.classList.add('selected');
        }
    }

    // ✅ FUNCIÓN: Inicializar listeners para filtros
    initializeFilterListeners() {
        document.querySelectorAll('.filter-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectFilter(e));
        });
    }

    // ✅ FUNCIÓN: Seleccionar filtro
    selectFilter(e) {
        // Remover selección anterior
        document.querySelectorAll('.filter-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Agregar selección nueva
        e.currentTarget.classList.add('selected');
        this.selectedFilter = e.currentTarget.dataset.filter;
        
        // Actualizar previsualización del filtro
        this.updateFilterPreview();
        
        // ✅ ACTUALIZAR TEXTO DEL BOTÓN DE FILTROS
        this.updateFilterButtonText();
        
        console.log('Filtro seleccionado:', this.selectedFilter);
    }

    // ✅ FUNCIÓN: Actualizar previsualización del filtro
    updateFilterPreview() {
        const filterName = document.getElementById('selectedFilterName');
        const filterDescription = document.getElementById('filterDescription');
        
        const filterInfo = {
            none: { name: "Sin Filtro", description: "Imagen normalizada sin efectos adicionales" },
            juno: { name: "Juno", description: "Tonos cálidos intensos, colores vibrantes" },
            paris: { name: "París", description: "Tono rosado suave, efecto dreamy" },
            lofi: { name: "Lo-Fi", description: "Saturación alta + contraste fuerte" },
            cristal: { name: "Cristal", description: "Máxima nitidez y colores vibrantes" }
        };
        
        const info = filterInfo[this.selectedFilter] || filterInfo.none;
        filterName.textContent = info.name;
        filterDescription.textContent = info.description;
    }

    // ✅ NUEVA FUNCIÓN: Actualizar texto del botón de filtros
    updateFilterButtonText() {
        const filterBtn = document.getElementById('applyFilterBtn');
        if (this.selectedFilter === "none") {
            filterBtn.textContent = "🔄 Quitar Filtros";
            filterBtn.classList.remove('btn-primary');
            filterBtn.classList.add('btn-secondary');
        } else {
            const filterName = this.selectedFilter.charAt(0).toUpperCase() + this.selectedFilter.slice(1);
            filterBtn.textContent = `🎨 Aplicar ${filterName}`;
            filterBtn.classList.remove('btn-secondary');
            filterBtn.classList.add('btn-primary');
        }
    }

    initializeEventListeners() {
        // ✅ UPLOAD COMPACTO - Botón para seleccionar archivo
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('imageInput').click();
        });

        // Input de archivo
        const imageInput = document.getElementById('imageInput');
        imageInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Format selection
        document.querySelectorAll('.format-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectFormat(e));
        });

        // Buttons
        document.getElementById('processBtn').addEventListener('click', () => this.processImage());
        document.getElementById('processFromPreviewBtn').addEventListener('click', () => this.processImage());
        
        // ✅ NUEVOS BOTONES SEPARADOS
        document.getElementById('applyScaleBtn').addEventListener('click', () => this.applyScaleOnly());
        document.getElementById('applyFilterBtn').addEventListener('click', () => this.applyFilterAction());
        
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());

        // Scale slider
        document.getElementById('scaleSlider').addEventListener('input', (e) => {
            this.currentScale = parseInt(e.target.value);
            document.getElementById('scaleValue').textContent = `${this.currentScale}%`;
            document.getElementById('manualScaleInput').value = this.currentScale;
        });

        // Campo de escala manual
        document.getElementById('manualScaleInput').addEventListener('change', (e) => {
            let value = parseInt(e.target.value);
            // Validar rango
            if (value < 25) value = 25;
            if (value > 200) value = 200;
            
            this.currentScale = value;
            document.getElementById('scaleSlider').value = value;
            document.getElementById('scaleValue').textContent = `${value}%`;
            e.target.value = value;
        });

        // ✅ DRAG & DROP para el área compacta (opcional)
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.handleImageFile(files[0]);
                // Mostrar nombre del archivo
                document.getElementById('fileName').textContent = files[0].name;
                document.getElementById('fileName').classList.add('has-file');
            }
        });
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.handleImageFile(files[0]);
            // ✅ Mostrar nombre del archivo
            document.getElementById('fileName').textContent = files[0].name;
            document.getElementById('fileName').classList.add('has-file');
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
            // ✅ Proceso inicial - normalización básica
            const result = await this.sendProcessRequest(this.currentScale, "none", true);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('🎉 Imagen normalizada correctamente!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error al procesar la imagen: ' + error.message);
        }
    }

    // ✅ NUEVA FUNCIÓN: Aplicar solo escala (RESPETANDO el filtro actual)
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
            // ✅ MANTIENE el filtro actual, solo cambia escala
            // isInitialProcess = false para mantener filtros si los hay
            const result = await this.sendProcessRequest(this.currentScale, this.selectedFilter, false);
            this.displayProcessedResult(result);
            this.hideLoading();
            this.showSuccess('✅ Escala ajustada correctamente!');

        } catch (error) {
            this.hideLoading();
            this.showError('Error al ajustar escala: ' + error.message);
        }
    }

    // ✅ NUEVA FUNCIÓN: Aplicar/Quitar filtro (RESPETANDO la escala actual)
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
            // ✅ SI es "none", usa proceso inicial (true) para QUITAR filtros
            // ✅ SI es otro filtro, usa proceso normal (false) para APLICAR filtros
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

    // ✅ FUNCIÓN: Enviar solicitud de procesamiento
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
        
        // Actualizar detalles del método en la interfaz
        this.updateProcessMethodInfo(result.detalles);
        
        // Scroll a resultados
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    // ✅ FUNCIÓN: Actualizar información del método de procesamiento
    updateProcessMethodInfo(detalles) {
        const filterPreview = document.querySelector('.filter-preview');
        if (filterPreview) {
            const methodInfo = document.createElement('div');
            methodInfo.className = 'method-info';
            methodInfo.style.marginTop = '10px';
            methodInfo.style.padding = '8px';
            methodInfo.style.background = '#f0f8ff';
            methodInfo.style.borderRadius = '4px';
            methodInfo.style.fontSize = '0.8em';
            methodInfo.innerHTML = `<strong>Método:</strong> ${detalles.metodo}`;
            
            // Limpiar info anterior y agregar nueva
            const existingInfo = filterPreview.querySelector('.method-info');
            if (existingInfo) {
                existingInfo.remove();
            }
            filterPreview.appendChild(methodInfo);
        }
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
        document.getElementById('applyScaleBtn').disabled = true;
        document.getElementById('applyFilterBtn').disabled = true;
        document.getElementById('uploadBtn').disabled = true;
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('processBtn').disabled = false;
        document.getElementById('processFromPreviewBtn').disabled = false;
        document.getElementById('applyScaleBtn').disabled = false;
        document.getElementById('applyFilterBtn').disabled = false;
        document.getElementById('uploadBtn').disabled = false;
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
