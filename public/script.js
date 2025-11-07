// En displayOriginalTechSpecsPreview y displayProcessedTechSpecs:
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
