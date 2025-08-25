window.addEventListener('load', () => {
    if (typeof pdfjsLib === 'undefined') {
        document.getElementById('resultado').innerHTML = 
            '<p style="color: red;">Error: PDF.js no se cargó correctamente. Recarga la página.</p>';
        return;
    }

    const inputPdf = document.getElementById('input-pdf');
    const resultadoDiv = document.getElementById('resultado');

    inputPdf.addEventListener('change', async (event) => {
        const archivo = event.target.files[0];
        if (!archivo) return;

        try {
            resultadoDiv.innerHTML = '<p>Procesando PDF...</p>';
            const texto = await extraerTextoPDF(archivo);
            
            resultadoDiv.innerHTML = '<p>Analizando texto...</p>';
            const analisis = analizarSentencia(texto);
            
            mostrarResultadoAnalisis(analisis);
        } catch (error) {
            resultadoDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    });
});

async function extraerTextoPDF(archivo) {
    const url = URL.createObjectURL(archivo);
    
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        let textoCompleto = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const pagina = await pdf.getPage(i);
            const contenido = await pagina.getTextContent();
            const textoPagina = contenido.items
                .map(item => item.str)
                .join(' ');
            textoCompleto += textoPagina + '\n';
        }
        
        return textoCompleto;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function analizarSentencia(texto) {
    const resultado = {
        caratula: extraerCaratula(texto),
        partes: extraerPartes(texto),
        articulos: extraerArticulos(texto),
        fechas: extraerFechas(texto),
        montos: extraerMontos(texto),
        palabrasClave: extraerPalabrasClave(texto),
        resolucion: extraerResolucion(texto)
    };
    
    return resultado;
}

// Función mejorada para extraer la carátula completa - recortar objeto en comillas, fecha, N° o número
function extraerCaratula(texto) {
    const patronesCaratula = [
        /([A-Z][a-záéíóúñ\s]+?)\s*[cC]\/*\s*([A-Z][a-záéíóúñ\s]+?)\s*[sS]\/*\s*(.+?)(?:\n|$)/i,
        /([A-Z][a-záéíóúñ\s]+?)\s+[cC]\s+([A-Z][a-záéíóúñ\s]+?)\s+[sS]\s+(.+?)(?:\n|$)/i,
        /([A-Z][a-záéíóúñ\s]+?)\s+contra\s+([A-Z][a-záéíóúñ\s]+?)\s+s\/\s*(.+?)(?:\n|$)/i
    ];
    
    for (const patron of patronesCaratula) {
        const match = patron.exec(texto);
        if (match) {
            let objeto = match[3].trim();
            
            // Recortar el objeto en comillas, "Fecha del Escrito", "N°" o cualquier número
            const recortes = [
                /"/, // Comillas
                /Fecha del Escrito/i,
                /N°/i,
                /Nº/i,
                /Nro\./i,
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

// Función mejorada para extraer partes
function extraerPartes(texto) {
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
    
    return partes.slice(0, 5);
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

// Función mejorada para extraer la parte resolutiva completa
function extraerResolucion(texto) {
    console.log("Extrayendo resolución completa");
    
    // Patrones para buscar el inicio y fin de la parte resolutiva
    const inicioPatrones = [
        /RESUELVO\s*:/gi,
        /RESUELVO\s*/gi,
        /RESUELVE\s*:/gi,
        /RESUELVE\s*/gi
    ];
    
    const finPatrones = [
        /REGISTRESE\s*/gi,
        /REGÍSTRESE\s*/gi,
        /REGISTRESE\s+Y\s+NOTIFÍQUESE/gi,
        /REGÍSTRESE\s+Y\s+NOTIFÍQUESE/gi,
        /ANÓTESE\s*/gi,
        /NOTIFÍQUESE\s*/gi
    ];
    
    let inicioEncontrado = -1;
    let finEncontrado = -1;
    let patronInicioUsado = '';
    let patronFinUsado = '';
    
    // Buscar el inicio (RESUELVO)
    for (const patron of inicioPatrones) {
        const match = patron.exec(texto);
        if (match) {
            inicioEncontrado = match.index;
            patronInicioUsado = match[0];
            break;
        }
    }
    
    if (inicioEncontrado === -1) {
        console.log("No se encontró inicio de resolución");
        return null;
    }
    
    // Buscar el fin (REGISTRESE) después del inicio
    const textoDespuesDeInicio = texto.substring(inicioEncontrado);
    
    for (const patron of finPatrones) {
        const match = patron.exec(textoDespuesDeInicio);
        if (match) {
            finEncontrado = inicioEncontrado + match.index;
            patronFinUsado = match[0];
            break;
        }
    }
    
    if (finEncontrado === -1) {
        console.log("No se encontró fin de resolución, usando todo el texto restante");
        // Si no se encuentra el fin, tomar hasta el final del documento o hasta una sección clara
        const proximaSeccion = textoDespuesDeInicio.search(/\n\n[A-Z][A-Z\s]+\n/);
        if (proximaSeccion !== -1) {
            finEncontrado = inicioEncontrado + proximaSeccion;
        } else {
            finEncontrado = texto.length;
        }
    }
    
    // Extraer el texto resolutivo
    let textoResolutivo = texto.substring(inicioEncontrado, finEncontrado).trim();
    
    // Limpiar el texto: quitar el "RESUELVO:" inicial y espacios extra
    textoResolutivo = textoResolutivo.replace(new RegExp("^" + patronInicioUsado, 'gi'), '').trim();
    
    console.log("Resolución extraída, longitud:", textoResolutivo.length);
    return textoResolutivo;
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

function extraerPalabrasClave(texto) {
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
    
    return palabrasClave.slice(0, 8);
}

// Reemplazar la sección de resolución en mostrarResultadoAnalisis
    // Mostrar resolución si se detectó
    if (analisis.resolucion) {
        html += `
            <div class="seccion resolucion">
                <h3>Parte Resolutiva Completa</h3>
                <div class="resolucion-texto">
                    ${analisis.resolucion.split('\n').map(linea => `<p>${linea}</p>`).join('')}
                </div>
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
        
        <div class="seccion articulos">
            <h3>Artículos Citados</h3>
            <ul>
                ${analisis.articulos.map(a => `<li>${a}</li>`).join('') || '<li>No se detectaron artículos</li>'}
            </ul>
        </div>
        
        <div class="seccion fechas">
            <h3>Fechas Importantes</h3>
            <ul>
                ${analisis.fechas.map(f => `<li>${f}</li>`).join('') || '<li>No se detectaron fechas</li>'}
            </ul>
        </div>
        
        <div class="seccion montos">
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
}
