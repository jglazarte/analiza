document.addEventListener('DOMContentLoaded', () => {
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

// Función para extraer texto del PDF (igual que antes)
async function extraerTextoPDF(archivo) {
    const url = URL.createObjectURL(archivo);
    const pdf = await pdfjsLib.getDocument(url).promise;
    let textoCompleto = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const pagina = await pdf.getPage(i);
        const contenido = await pagina.getTextContent();
        const textoPagina = contenido.items.map(item => item.str).join(' ');
        textoCompleto += textoPagina + '\n';
    }
    
    URL.revokeObjectURL(url);
    return textoCompleto;
}

// Función para analizar la sentencia con JavaScript puro
function analizarSentencia(texto) {
    const resultado = {
        partes: extraerPartes(texto),
        articulos: extraerArticulos(texto),
        fechas: extraerFechas(texto),
        montos: extraerMontos(texto),
        palabrasClave: extraerPalabrasClave(texto)
    };
    
    return resultado;
}

// Funciones de extracción usando expresiones regulares
function extraerPartes(texto) {
    const partes = [];
    
    // Buscar patrones como "Demandante: Nombre" o "Actor: Nombre"
    const demandanteRegex = /(demandante|actor|actora|querellante):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/gi;
    let match;
    while ((match = demandanteRegex.exec(texto)) !== null) {
        partes.push({ tipo: match[1], nombre: match[2] });
    }
    
    // Buscar patrones como "Demandado: Nombre" o "Demandada: Nombre"
    const demandadoRegex = /(demandado|demandada|acusado|acusada):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/gi;
    while ((match = demandadoRegex.exec(texto)) !== null) {
        partes.push({ tipo: match[1], nombre: match[2] });
    }
    
    return partes.slice(0, 5); // Limitar a 5 resultados
}

function extraerArticulos(texto) {
    const articulos = [];
    const articuloRegex = /(?:artículo|art\.|arts\.)\s*(\d+(?:\.\d+)?(?:\s*(?:bis|ter|quater))?)/gi;
    let match;
    while ((match = articuloRegex.exec(texto)) !== null) {
        articulos.push(match[0]);
    }
    return [...new Set(articulos)].slice(0, 10); // Eliminar duplicados y limitar
}

function extraerFechas(texto) {
    const fechas = [];
    const fechaRegex = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/gi;
    let match;
    while ((match = fechaRegex.exec(texto)) !== null) {
        fechas.push(match[0]);
    }
    return [...new Set(fechas)].slice(0, 5); // Eliminar duplicados y limitar
}

function extraerMontos(texto) {
    const montos = [];
    const montoRegex = /\$([\d,]+(?:\.\d{2})?)\s*(?:pesos|mxn|ars|clp)/gi;
    let match;
    while ((match = montoRegex.exec(texto)) !== null) {
        montos.push(match[0]);
    }
    return [...new Set(montos)].slice(0, 5); // Eliminar duplicados y limitar
}

function extraerPalabrasClave(texto) {
    const palabrasClave = [];
    const terminosJuridicos = [
        'indemnización', 'daño moral', 'despido injustificado', 'cuota alimentaria',
        'responsabilidad civil', 'contrato', 'incumplimiento', 'nulidad',
        'prescripción', 'jurisprudencia', 'recurso', 'apelación'
    ];
    
    terminosJuridicos.forEach(termino => {
        const regex = new RegExp(termino, 'gi');
        if (regex.test(texto)) {
            palabrasClave.push(termino);
        }
    });
    
    return palabrasClave.slice(0, 8);
}

// Función para mostrar los resultados
function mostrarResultadoAnalisis(analisis) {
    const resultadoDiv = document.getElementById('resultado');
    
    let html = `
        <h2>Resultados del Análisis</h2>
        
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
                ${analisis.palabrasClave.map(p => `<span class="tag">${p}</span>`).join('') || '<p>No se detectaron palabras clave</p>'}
            </div>
        </div>
    `;
    
    resultadoDiv.innerHTML = html;
}
