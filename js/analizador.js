// Función mejorada para extraer la carátula completa - recortar objeto en número o fecha
function extraerCaratula(texto) {
    // Buscar el patrón de carátula: actor c/ demandado s/ objeto
    const patronesCaratula = [
        /([A-Z][a-záéíóúñ\s]+?)\s*[cC]\/*\s*([A-Z][a-záéíóúñ\s]+?)\s*[sS]\/*\s*(.+?)(?:\n|$)/i,
        /([A-Z][a-záéíóúñ\s]+?)\s+[cC]\s+([A-Z][a-záéíóúñ\s]+?)\s+[sS]\s+(.+?)(?:\n|$)/i,
        /([A-Z][a-záéíóúñ\s]+?)\s+contra\s+([A-Z][a-záéíóúñ\s]+?)\s+s\/\s*(.+?)(?:\n|$)/i
    ];
    
    for (const patron of patronesCaratula) {
        const match = patron.exec(texto);
        if (match) {
            let objeto = match[3].trim();
            
            // Recortar el objeto en el primer número o fecha
            const recortes = [
                /\d+\/\d+\/\d+/, // Fecha DD/MM/AAAA
                /\d+\s+de\s+[a-z]+\s+de\s+\d{4}/i, // Fecha "día de mes de año"
                /\d{4}/, // Año solo
                /\d+/ // Cualquier número
            ];
            
            for (const recorte of recortes) {
                const posicion = objeto.search(recorte);
                if (posicion !== -1) {
                    objeto = objeto.substring(0, posicion).trim();
                    break;
                }
            }
            
            return {
                actor: match[1].trim(),
                demandado: match[2].trim(),
                objeto: objeto
            };
        }
    }
    
    return null;
}

// Función mejorada para extraer artículos con cuerpo normativo y manejar abreviaturas
function extraerArticulos(texto) {
    const articulos = [];
    
    // Patrón mejorado para capturar artículo + cuerpo normativo, incluyendo abreviaturas
    const articuloCompletoRegex = /(?:artículo|art\.|arts\.)\s*(\d+(?:\.\d+)?(?:\s*(?:bis|ter|quater|quáter|quinquies|sexies|septies|octies|nonies))?)\s*(?:,?\s*(?:inc|inciso|apartado)\s*\d*)?\s*(?:de\s+la\s+|de\s+el\s+|de\s+)?([A-Z][a-záéíóúñ\s]+?)(?:\.|,|\s|$)/gi;
    
    let match;
    while ((match = articuloCompletoRegex.exec(texto)) !== null) {
        let articuloCompleto = match[0].trim();
        
        // Normalizar abreviaturas
        articuloCompleto = articuloCompleto
            .replace(/artículo/gi, 'art.')
            .replace(/Dec\./gi, 'Decreto')
            .replace(/\binc\b/gi, 'inciso')
            .replace(/CC/gi, 'Código Civil')
            .replace(/CCC/gi, 'Código Civil y Comercial')
            .replace(/CPCC/gi, 'Código Procesal Civil y Comercial');
        
        articulos.push(articuloCompleto);
    }
    
    // Si no se encontraron artículos completos, usar el patrón simple
    if (articulos.length === 0) {
        const articuloSimpleRegex = /(?:artículo|art\.|arts\.)\s*(\d+(?:\.\d+)?(?:\s*(?:bis|ter|quater|quáter|quinquies|sexies|septies|octies|nonies))?)/gi;
        while ((match = articuloSimpleRegex.exec(texto)) !== null) {
            let articulo = match[0].toLowerCase().replace(/artículo/, 'art.').trim();
            articulos.push(articulo);
        }
    }
    
    // Eliminar duplicados y ordenar
    return [...new Set(articulos)].sort().slice(0, 10);
}

// Función mejorada para extraer montos
function extraerMontos(texto) {
    const montos = [];
    
    // 1. Buscar montos en formato numérico completo
    const montoNumericoRegex = /\$?\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:pesos|mxn|ars|clp|u\$s|usd|eur)?/gi;
    
    let match;
    while ((match = montoNumericoRegex.exec(texto)) !== null) {
        let monto = match[0].trim();
        
        // Limpiar y formatear
        monto = monto.replace(/\s+/g, ' ');
        
        // Si no comienza con $, agregarlo
        if (!monto.startsWith('$')) {
            monto = '$' + monto;
        }
        
        // Agregar moneda si no está especificada
        if (!monto.toLowerCase().includes('pesos') && 
            !monto.toLowerCase().includes('mxn') && 
            !monto.toLowerCase().includes('ars') && 
            !monto.toLowerCase().includes('clp') &&
            !monto.toLowerCase().includes('u$s') &&
            !monto.toLowerCase().includes('usd') &&
            !monto.toLowerCase().includes('eur')) {
            monto += ' pesos';
        }
        
        // Filtrar montos muy pequeños o inválidos
        const valorNumerico = parseFloat(monto.replace(/[^\d.]/g, '').replace(',', '.'));
        if (valorNumerico >= 1000) { // Solo montos de 1.000 o más
            montos.push(monto);
        }
    }
    
    // 2. Buscar montos escritos en texto completo
    const montoTextoRegex = /PESOS\s+([A-Z\s]+?)(?:\s+\(\$([\d,.]+)\))?/gi;
    while ((match = montoTextoRegex.exec(texto)) !== null) {
        if (match[1] && match[1].trim().length > 10) { // Evitar textos cortos
            const montoTexto = match[1].trim();
            if (match[2]) {
                montos.push(`$${match[2]} pesos (${montoTexto})`);
            } else {
                montos.push(`${montoTexto}`);
            }
        }
    }
    
    // 3. Buscar montos en formato complejo: "la suma de PESOS UN MILLÓN... ($ 1.340.373)"
    const montoComplejoRegex = /la suma de\s+PESOS\s+([A-Z\s]+?)\s*\(\$\s*([\d,.]+)\)/gi;
    while ((match = montoComplejoRegex.exec(texto)) !== null) {
        if (match[1] && match[2]) {
            montos.push(`$${match[2]} pesos (${match[1].trim()})`);
        }
    }
    
    // Eliminar duplicados y limitar a 5 resultados
    return [...new Set(montos)].slice(0, 5);
}
