// Esperar a que el DOM cargue completamente
document.addEventListener('DOMContentLoaded', () => {
    // Referencia al input de archivo y al div de resultados
    const inputPdf = document.getElementById('input-pdf');
    const resultadoDiv = document.getElementById('resultado');

    // Evento cuando el usuario selecciona un archivo
    inputPdf.addEventListener('change', async (event) => {
        const archivo = event.target.files[0];
        if (!archivo) return; // Si no hay archivo, salir

        try {
            // Mostrar mensaje de carga
            resultadoDiv.innerHTML = '<p>Extrayendo texto del PDF...</p>';

            // Extraer texto del PDF
            const texto = await extraerTextoPDF(archivo);
            
            // Mostrar el texto extraído (por ahora, sin análisis)
            resultadoDiv.innerHTML = `
                <h3>Texto extraído:</h3>
                <pre>${texto.substring(0, 1000)}...</pre> <!-- Mostrar primeros 1000 caracteres -->
            `;
        } catch (error) {
            resultadoDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    });
});

// Función para extraer texto de un PDF usando PDF.js
async function extraerTextoPDF(archivo) {
    // Crear un objeto URL para el archivo
    const url = URL.createObjectURL(archivo);
    
    // Cargar el documento PDF
    const pdf = await pdfjsLib.getDocument(url).promise;
    
    let textoCompleto = '';
    
    // Recorrer todas las páginas del PDF
    for (let i = 1; i <= pdf.numPages; i++) {
        const pagina = await pdf.getPage(i);
        const contenido = await pagina.getTextContent();
        
        // Extraer texto de cada item en la página
        const textoPagina = contenido.items
            .map(item => item.str)
            .join(' ');
        
        textoCompleto += textoPagina + '\n';
    }
    
    // Liberar el objeto URL
    URL.revokeObjectURL(url);
    
    return textoCompleto;
}
