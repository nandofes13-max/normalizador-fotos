// Configuración
const API_URL = 'https://normalizador-fotos.onrender.com';
let currentPlatform = 'kyte';
let selectedFiles = [];

// Elementos DOM
const elements = {
    platformBtns: document.querySelectorAll('.platform-btn'),
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    fileCount: document.getElementById('fileCount'),
    heightSlider: document.getElementById('heightSlider'),
    heightValue: document.getElementById('heightValue'),
    widthSlider: document.getElementById('widthSlider'),
    widthValue: document.getElementById('widthValue'),
    processBtn: document.getElementById('processBtn'),
    resetBtn: document.getElementById('resetBtn'),
    previewContainer: document.getElementById('previewContainer'),
    message: document.getElementById('message'),
    apiStatus: document.getElementById('apiStatus')
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    updateSliders();
    checkAPIStatus();
}

function setupEventListeners() {
    // Selector de plataforma
    elements.platformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setPlatform(btn.dataset.platform);
        });
    });

    // Área de subida
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Drag & Drop
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);

    // Controles
    elements.heightSlider.addEventListener('input', updateHeightValue);
    elements.widthSlider.addEventListener('input', updateWidthValue);

    // Botones
    elements.processBtn.addEventListener('click', processImages);
    elements.resetBtn.addEventListener('click', resetApp);
}

// Plataforma
function setPlatform(platform) {
    currentPlatform = platform;
    
    elements.platformBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.platform === platform);
    });

    // Configuración por plataforma
    const platformConfigs = {
        kyte: { height: 75, width: 70 },
        jumpseller: { height: 85, width: 85 }
    };

    const config = platformConfigs[platform] || platformConfigs.kyte;
    elements.heightSlider.value = config.height;
    elements.widthSlider.value = config.width;
    updateSliders();

    showMessage(`Plataforma cambiada a: ${platform.toUpperCase()}`, 'success');
}

// Sliders
function updateSliders() {
    updateHeightValue();
    updateWidthValue();
}

function updateHeightValue() {
    elements.heightValue.textContent = `${elements.heightSlider.value}%`;
}

function updateWidthValue() {
    elements.widthValue.textContent = `${elements.widthSlider.value}%`;
}

// Manejo de archivos
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
}

function handleFileSelect(e) {
    handleFiles(e.target.files);
}

function handleFiles(files) {
    if (files.length === 0) return;

    // Validar cantidad
    if (files.length > 6) {
        showMessage('Máximo 6 imágenes permitidas', 'error');
        return;
    }

    // Validar tipos
    const invalidFiles = Array.from(files).filter(file => 
        !file.type.startsWith('image/')
    );

    if (invalidFiles.length > 0) {
        showMessage('Solo se permiten archivos de imagen', 'error');
        return;
    }

    selectedFiles = Array.from(files);
    updateFileCount();
    showPreviews();
    elements.processBtn.disabled = false;
    
    showMessage(`${files.length} imagen(es) seleccionada(s)`, 'success');
}

function updateFileCount() {
    elements.fileCount.textContent = `${selectedFiles.length} archivo(s) seleccionado(s)`;
}

function showPreviews() {
    elements.previewContainer.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}" class="preview-image">
                <div class="preview-info">
                    <div>${file.name}</div>
                    <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">
                        ${(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                </div>
            `;
            
            elements.previewContainer.appendChild(previewItem);
        };
        
        reader.readAsDataURL(file);
    });
}

// Procesamiento de imágenes
async function processImages() {
    if (selectedFiles.length === 0) {
        showMessage('No hay imágenes para procesar', 'error');
        return;
    }

    setLoadingState(true);
    
    try {
        const formData = new FormData();
        
        // Agregar archivos
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        // Agregar parámetros
        formData.append('platform', currentPlatform);
        formData.append('height_percent', elements.heightSlider.value);
        formData.append('width_percent', elements.widthSlider.value);

        showMessage('⏳ Procesando imágenes...', 'success');

        const response = await fetch(`${API_URL}/process`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        // Descargar ZIP
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentPlatform}_imagenes_optimizadas.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showMessage(`✅ ${selectedFiles.length} imagen(es) procesadas correctamente. ZIP descargado.`, 'success');

    } catch (error) {
        console.error('Error:', error);
        showMessage(`❌ Error al procesar imágenes: ${error.message}`, 'error');
    } finally {
        setLoadingState(false);
    }
}

// Estado de carga
function setLoadingState(loading) {
    const btnText = elements.processBtn.querySelector('.btn-text');
    const btnLoading = elements.processBtn.querySelector('.btn-loading');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        elements.processBtn.disabled = true;
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        elements.processBtn.disabled = false;
    }
}

// Mensajes
function showMessage(text, type) {
    elements.message.textContent = text;
    elements.message.className = `message ${type}`;
    elements.message.style.display = 'block';

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        elements.message.style.display = 'none';
    }, 5000);
}

// Reiniciar
function resetApp() {
    selectedFiles = [];
    elements.fileInput.value = '';
    elements.previewContainer.innerHTML = '';
    elements.processBtn.disabled = true;
    updateFileCount();
    setPlatform('kyte');
    showMessage('Aplicación reiniciada', 'success');
}

// Verificar estado de la API
async function checkAPIStatus() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            elements.apiStatus.style.color = '#28a745';
            elements.apiStatus.title = 'API conectada correctamente';
        } else {
            throw new Error('API no responde correctamente');
        }
    } catch (error) {
        elements.apiStatus.style.color = '#dc3545';
        elements.apiStatus.title = 'API no disponible - Puede tardar en responder';
        console.warn('API no disponible:', error.message);
    }
}

// Manejo de errores global
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    showMessage('Error inesperado en la aplicación', 'error');
});
