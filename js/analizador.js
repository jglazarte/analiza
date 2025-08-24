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

// Nueva función para extraer la carátula completa
function extraerCaratula(texto) {
    // Buscar el patrón de carátula: actor c/ demandado s/ objeto
    const caratulaRegex = /([A-Z][a-záéíóúñ\s]+?)\s+c\/\s+([A-Z][a-záéíóúñ\s]+?)\s+s\/\s+(.+)/i;
    const match = caratulaRegex.exec(texto);
    
    if (match) {
        return {
            actor: match[1].trim(),
            demandado: match[2].trim(),
            objeto: match[3].trim()
        };
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
    
    // Limitar a 5 resultados
    return partes.slice(0, 5);
}

// Nueva función para extraer la resolución
function extraerResolucion(texto) {
    // Buscar después de "RESUELVO:"
    const resuelvoRegex = /RESUELVO:\s*(.+?)(?:\n\n|\n[A-Z]|$)/i;
    const match = resuelvoRegex.exec(texto);
    
    if (match) {
        return match[1].trim();
    }
    
    return null;
}

function extraerArticulos(texto) {
    const articulos = [];
    const articuloRegex = /(?:artículo|art\.|arts\.)\s*(\d+(?:\.\d+)?(?:\s*(?:bis|ter|quater|quáter|quinquies|sexies|septies|octies|nonies))?)/gi;
    let match;
    
    while ((match = articuloRegex.exec(texto)) !== null) {
        let articulo = match[0].toLowerCase().replace(/artículo/, 'art.').trim();
        articulos.push(articulo);
    }
    
    return [...new Set(articulos)].sort().slice(0, 10);
}

function extraerFechas(texto) {
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
    
    return [...new Set(fechas)].slice(0, 5);
}

function extraerMontos(texto) {
    const montos = [];
    const montoRegex = /\$?\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:pesos|mxn|ars|clp|u\$s|usd|eur)?/gi;
    
    let match;
    while ((match = montoRegex.exec(texto)) !== null) {
        let monto = match[0].trim();
        
        if (!monto.startsWith('$')) {
            monto = '$' + monto;
        }
        
        if (!monto.toLowerCase().includes('pesos') && 
            !monto.toLowerCase().includes('mxn') && 
            !monto.toLowerCase().includes('ars') && 
            !monto.toLowerCase().includes('clp') &&
            !monto.toLowerCase().includes('u$s') &&
            !monto.toLowerCase().includes('usd') &&
            !monto.toLowerCase().includes('eur')) {
            monto += ' pesos';
        }
        
        montos.push(monto);
    }
    
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

function mostrarResultadoAnalisis(analisis) {
    const resultadoDiv = document.getElementById('resultado');
    
    let html = `
        <h2>Resultados del Análisis</h2>
    `;
    
    // Mostrar carátula si se detectó
    if (analisis.caratula) {
        html += `
            <div class="seccion">
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
            <div class="seccion">
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
}
