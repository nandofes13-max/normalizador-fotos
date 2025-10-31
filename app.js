// Configuración
const API_URL = 'https://normalizador-fotos.onrender.com';
let currentPlatform = 'kyte';
let currentFile = null;

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
    previewBtn: document.getElementById('previewBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    resetBtn: document.getElementById('resetBtn'),
    previewSection: document.getElementById('previewSection'),
    originalPreview: document.getElementById('originalPreview'),
    processedPreview: document.getElementById('processedPreview'),
    originalInfo: document.getElementById('originalInfo'),
    processedInfo: document.getElementById('processedInfo'),
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
    elements.previewBtn.addEventListener('click', generatePreview);
    elements.downloadBtn.addEventListener('click', downloadImage);
    elements.resetBtn.addEventListener('click', resetApp);
}

// Plataforma
function setPlatform(platform) {
    currentPlatform = platform;
    
    elements.platformBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.platform === platform);
    });

    showMessage(`Plataforma: ${platform.toUpperCase()}`, 'success');
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

    // Solo una imagen
    if (files.length > 1) {
        showMessage('Solo se permite UNA imagen a la vez', 'error');
        return;
    }

    const file = files[0];

    // Validar tipo
    if (!file.type.startsWith('image/')) {
        showMessage('Solo se permiten archivos de imagen', 'error');
        return;
    }

    currentFile = file;
    updateFileInfo();
    showOriginalPreview(file);
    elements.previewBtn.disabled = false;
    elements.downloadBtn.style.display = 'none';
    elements.previewSection.style.display = 'none';
    
    showMessage('Imagen cargada. Haz clic en "Ver Preview"', 'success');
}

function updateFileInfo() {
    elements.fileCount.textContent = currentFile ? currentFile.name : 'Ningún archivo seleccionado';
}

function showOriginalPreview(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        elements.originalPreview.src = e.target.result;
        elements.originalInfo.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    };
    
    reader.readAsDataURL(file);
}

// Preview
async function generatePreview() {
    if (!currentFile) {
        showMessage('No hay imagen para procesar', 'error');
        return;
    }

    setPreviewLoadingState(true);
    
    try {
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('platform', currentPlatform);
        formData.append('height_percent', elements.heightSlider.value);
        formData.append('width_percent', elements.widthSlider.value);

        showMessage('⏳ Generando preview...', 'success');

        const response = await fetch(`${API_URL}/preview`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Mostrar preview procesado
        elements.processedPreview.src = data.processed;
        elements.processedInfo.textContent = `${data.platform} • ${data.dimensions}`;

        // Mostrar sección de preview
        elements.previewSection.style.display = 'block';
        elements.downloadBtn.style.display = 'inline-block';
        elements.downloadBtn.disabled = false;

        showMessage('✅ Preview generado. Revisa el resultado y descarga si te gusta.', 'success');

    } catch (error) {
        console.error('Error:', error);
        showMessage(`❌ Error al generar preview: ${error.message}`, 'error');
    } finally {
        setPreviewLoadingState(false);
    }
}

// Descarga
async function downloadImage() {
    if (!currentFile) {
        showMessage('No hay imagen para descargar', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('platform', currentPlatform);
        formData.append('height_percent', elements.heightSlider.value);
        formData.append('width_percent', elements.widthSlider.value);

        showMessage('⏳ Descargando imagen...', 'success');

        const response = await fetch(`${API_URL}/download`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentPlatform}_optimizada.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showMessage('✅ Imagen descargada correctamente', 'success');

    } catch (error) {
        console.error('Error:', error);
        showMessage(`❌ Error al descargar: ${error.message}`, 'error');
    }
}

// Estados de carga
function setPreviewLoadingState(loading) {
    const btnText = elements.previewBtn.querySelector('.btn-text');
    const btnLoading = elements.previewBtn.querySelector('.btn-loading');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        elements.previewBtn.disabled = true;
        elements.downloadBtn.disabled = true;
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        elements.previewBtn.disabled = false;
    }
}

// Mensajes
function showMessage(text, type) {
    elements.message.textContent = text;
    elements.message.className = `message ${type}`;
    elements.message.style.display = 'block';

    setTimeout(() => {
        elements.message.style.display = 'none';
    }, 5000);
}

// Reiniciar
function resetApp() {
    currentFile = null;
    elements.fileInput.value = '';
    elements.previewSection.style.display = 'none';
    elements.previewBtn.disabled = true;
    elements.downloadBtn.style.display = 'none';
    updateFileInfo();
    setPlatform('kyte');
    showMessage('Listo para nueva imagen', 'success');
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
