window.addEventListener('load', () => {
    console.log("Analizador de Sentencias cargado");
    
    if (typeof pdfjsLib === 'undefined') {
        console.error("Error: PDF.js no está definido");
        document.getElementById('resultado').innerHTML = 
            '<p style="color: red;">Error: PDF.js no se cargó correctamente. Recarga la página.</p>';
        return;
    }
    
    console.log("PDF.js cargado correctamente");
    
    const inputPdf = document.getElementById('input-pdf');
    const resultadoDiv = document.getElementById('resultado');

    inputPdf.addEventListener('change', async (event) => {
        console.log("Evento change disparado");
        const archivo = event.target.files[0];
        if (!archivo) {
            console.log("No se seleccionó ningún archivo");
            return;
        }
        
        console.log("Archivo seleccionado:", archivo.name);
        
        try {
            resultadoDiv.innerHTML = '<p>Procesando PDF...</p>';
            console.log("Iniciando extracción de texto");
            const texto = await extraerTextoPDF(archivo);
            console.log("Texto extraído, longitud:", texto.length);
            
            resultadoDiv.innerHTML = '<p>Analizando texto...</p>';
            console.log("Iniciando análisis");
            const analisis = analizarSentencia(texto);
            console.log("Análisis completado:", analisis);
            
            mostrarResultadoAnalisis(analisis, texto);
        } catch (error) {
            console.error("Error durante el análisis:", error);
            resultadoDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    });
});

async function extraerTextoPDF(archivo) {
    console.log("Iniciando extracción de texto del PDF");
    const url = URL.createObjectURL(archivo);
    
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        console.log("PDF cargado, número de páginas:", pdf.numPages);
        
        let textoCompleto = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Procesando página ${i}`);
            const pagina = await pdf.getPage(i);
            const contenido = await pagina.getTextContent();
            const textoPagina = contenido.items
                .map(item => item.str)
                .join(' ');
            textoCompleto += textoPagina + '\n';
        }
        
        console.log("Extracción completada");
        return textoCompleto;
    } catch (error) {
        console.error("Error al extraer texto:", error);
        throw error;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function analizarSentencia(texto) {
    console.log("Analizando sentencia");
    const resultado = {
        caratula: extraerCaratula(texto),
        partes: extraerPartes(texto),
        articulos: extraerArticulos(texto),
        fechas: extraerFechas(texto),
        montos: extraerMontos(texto),
        palabrasClave: extraerPalabrasClave(texto),
        resolucion: extraerResolucion(texto)
    };
    
    console.log("Análisis finalizado");
    return resultado;
}

// Función mejorada para extraer la carátula completa - recortar objeto en número o fecha
function extraerCaratula(texto) {
    console.log("Extrayendo carátula");
    const patronesCaratula = [
        /([A-Z][a-záéíóúñ\s]+?)\s*[cC]\/*\s*([A-Z][a-záéíóúñ\s]+?)\s*[sS]\/*\s*(.+?)(?:\n|$)/i,
        /([A-Z][a-záéíóúñ\s]+?)\s+[cC]\s+([A-Z][a-záéíóúñ\s]+?)\s+[sS]\s+(.+?)(?:\n|$)/i,
        /([A-Z][a-záéíóúñ\s]+?)\s+contra\s+([A-Z][a-záéíóúñ\s]+?)\s+s\/\s*(.+?)(?:\n|$)/i
    ];
    
    for (const patron of patronesCaratula) {
        const match = patron.exec(texto);
        if (match) {
            console.log("Carátula encontrada");
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
    
    console.log("No se encontró carátula");
    return null;
}

// Función mejorada para extraer partes
function extraerPartes(texto) {
    console.log("Extrayendo partes");
    const partes = [];
    
    // 1. Extraer de la carátula
    const caratula = extraerCaratula(texto);
    if (caratula) {
        partes.push({ tipo: 'actor', nombre: caratula.actor });
        partes.push({ tipo: 'demandado', nombre: caratula.demandado });
    }
    
    // 2. Buscar después de "RESUELVO:"
    const resuelvoRegex = /RESUELVO:\s*(?:hacer lugar a la demanda|rechazar la demanda)\s+intentada\s+por\s+([A-Z][a-záéíóúñ\s]+?)\s+contra\s+([A-Z][a-záéíóúñ\s]+?)(?:\.|,|\s|$)/gi;
    let match;
    
    while ((match = resuelvoRegex.exec(texto)) !== null) {
        // Evitar duplicados
        if (!partes.some(p => p.tipo === 'actor' && p.nombre === match[1].trim())) {
            partes.push({ tipo: 'actor', nombre: match[1].trim() });
        }
        
        if (!partes.some(p => p.tipo === 'demandado' && p.nombre === match[2].trim())) {
            partes.push({ tipo: 'demandado', nombre: match[2].trim() });
        }
    }
    
    // 3. Otros patrones comunes
    const otrosPatrones = [
        /(demandante|actor|actora|querellante|accionante|solicitante):\s*([A-Z][a-záéíóúñ\s]+?)(?=\s*(?:,|\n|demandado|demandada|acusado|acusada|en\s+contra|vs\.|contra|$))/gi,
        /(demandado|demandada|acusado|acusada|demandados|demandadas):\s*([A-Z][a-záéíóúñ\s]+?)(?=\s*(?:,|\n|demandante|actor|actora|querellante|solicitante|$))/gi
    ];
    
    otrosPatrones.forEach(regex => {
        while ((match = regex.exec(texto)) !== null) {
            let tipo = match[1].toLowerCase();
            let nombre = match[2].trim().replace(/\s+/g, ' ');
            
            // Evitar duplicados
            if (!partes.some(p => p.tipo === tipo && p.nombre === nombre)) {
                partes.push({ tipo: tipo, nombre: nombre });
            }
        }
    });
    
    console.log("Partes extraídas:", partes);
    return partes.slice(0, 5);
}

// Función mejorada para extraer artículos con cuerpo normativo y manejar abreviaturas
function extraerArticulos(texto) {
    console.log("Extrayendo artículos");
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
    
    console.log("Artículos extraídos:", articulos);
    // Eliminar duplicados y ordenar
    return [...new Set(articulos)].sort().slice(0, 10);
}

// Función para extraer la resolución
function extraerResolucion(texto) {
    console.log("Extrayendo resolución");
    const resuelvoRegex = /RESUELVO:\s*(.+?)(?:\n\n|\n[A-Z]|$)/i;
    const match = resuelvoRegex.exec(texto);
    
    if (match) {
        console.log("Resolución encontrada");
        return match[1].trim();
    }
    
    console.log("No se encontró resolución");
    return null;
}

function extraerFechas(texto) {
    console.log("Extrayendo fechas");
    const fechas = [];
    const fechaRegex = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/gi;
    const fechaRegex2 = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
    
    let match;
    while ((match = fechaRegex.exec(texto)) !== null) {
        fechas.push(match[0]);
    }
    
    while ((match = fechaRegex2.exec(texto)) !== null) {
        const dia = match[1].padStart(2, '0');
        const mes = match[2].padStart(2, '0');
        const año = match[3].length === 2 ? '20' + match[3] : match[3];
        fechas.push(`${dia}/${mes}/${año}`);
    }
    
    console.log("Fechas extraídas:", fechas);
    return [...new Set(fechas)].slice(0, 5);
}

// Función mejorada para extraer montos
function extraerMontos(texto) {
    console.log("Extrayendo montos");
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
    
    console.log("Montos extraídos:", montos);
    // Eliminar duplicados y limitar a 5 resultados
    return [...new Set(montos)].slice(0, 5);
}

function extraerPalabrasClave(texto) {
    console.log("Extrayendo palabras clave");
    const palabrasClave = [];
    const terminosJuridicos = [
        'indemnización', 'daño moral', 'despido injustificado', 'cuota alimentaria',
        'responsabilidad civil', 'contrato', 'incumplimiento', 'nulidad',
        'prescripción', 'jurisprudencia', 'recurso', 'apelación',
        'daños y perjuicios', 'accidente de trabajo', 'enfermedad profesional',
        'despido', 'renuncia', 'finiquito', 'salario', 'jubilación',
        'hacer lugar', 'rechazar demanda'
    ];
    
    terminosJuridicos.forEach(termino => {
        const regex = new RegExp(termino, 'gi');
        if (regex.test(texto)) {
            palabrasClave.push(termino);
        }
    });
    
    console.log("Palabras clave extraídas:", palabrasClave);
    return palabrasClave.slice(0, 8);
}

function mostrarResultadoAnalisis(analisis, texto) {
    console.log("Mostrando resultados");
    const resultadoDiv = document.getElementById('resultado');
    
    let html = `
        <h2>Resultados del Análisis</h2>
        
        <!-- Sección de depuración -->
        <div class="seccion depuracion">
            <h3>Depuración - Primeras 500 caracteres del texto extraído</h3>
            <pre>${texto.substring(0, 500)}...</pre>
        </div>
    `;
    
    // Mostrar carátula si se detectó
    if (analisis.caratula) {
        html += `
            <div class="seccion caratula">
                <h3>Carátula</h3>
                <p><strong>Actor:</strong> ${analisis.caratula.actor}</p>
                <p><strong>Demandado:</strong> ${analisis.caratula.demandado}</p>
                <p><strong>Objeto:</strong> ${analisis.caratula.objeto}</p>
            </div>
        `;
    }
    
    // Mostrar resolución si se detectó
    if (analisis.resolucion) {
        html += `
            <div class="seccion resolucion">
                <h3>Resolución</h3>
                <p>${analisis.resolucion}</p>
            </div>
        `;
    }
    
    html += `
        <div class="seccion">
            <h3>Partes Involucradas</h3>
            <ul>
                ${analisis.partes.map(p => `<li><strong>${p.tipo}:</strong> ${p.nombre}</li>`).join('') || '<li>No se detectaron partes</li>'}
            </ul>
        </div>
        
        <div class="seccion">
            <h3>Artículos Citados</h3>
            <ul>
                ${analisis.articulos.map(a => `<li>${a}</li>`).join('') || '<li>No se detectaron artículos</li>'}
            </ul>
        </div>
        
        <div class="seccion">
            <h3>Fechas Importantes</h3>
            <ul>
                ${analisis.fechas.map(f => `<li>${f}</li>`).join('') || '<li>No se detectaron fechas</li>'}
            </ul>
        </div>
        
        <div class="seccion">
            <h3>Montos Económicos</h3>
            <ul>
                ${analisis.montos.map(m => `<li>${m}</li>`).join('') || '<li>No se detectaron montos</li>'}
            </ul>
        </div>
        
        <div class="seccion">
            <h3>Palabras Clave Jurídicas</h3>
            <div class="tags">
                ${analisis.palabrasClave.map(p => `<span class="tag">${p}</span>`).join('')}
            </div>
        </div>
    `;
    
    resultadoDiv.innerHTML = html;
    console.log("Resultados mostrados");
}
