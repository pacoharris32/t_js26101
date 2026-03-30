 document.addEventListener('DOMContentLoaded', () => {
        const loader = document.getElementById('loader-container');
        const filtroId = document.getElementById('filtro-id');
        const filtroEstado = document.getElementById('filtro-estado');
        const filtroAcuifero = document.getElementById('filtro-acuifero');
        const filtroTexto = document.getElementById('filtro-texto');
        const tablaResultados = document.getElementById('tabla-resultados');
        const paginationContainer = document.querySelector('.pagination');
        const contadorResultados = document.getElementById('contador-resultados');

        let estudiosData = [];
        let acuiferosData = [];
        let estudiosFiltrados = [];
        let currentPage = 1;
        const studiesPerPage = 20;

        const cargarDatos = async () => {
            try {
                const [resEst, resAcu] = await Promise.all([
                    fetch('data/T_ESTUDIOS.csv'),
                    fetch('data/T_ACUIFEROS_ESTADOS.csv')
                ]);
                estudiosData = parseCSVRobust(await resEst.text());
                acuiferosData = parseCSVRobust(await resAcu.text());
                poblarEstados();
                aplicarFiltrosYRenderizar();
            } catch (e) { console.error(e); }
            finally { loader.style.display = 'none'; }
        };

        const parseCSVRobust = (text) => {
            const rows = [];
            let row = [], field = '', inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const char = text[i], next = text[i+1];
                if (char === '"' && inQuotes && next === '"') { field += '"'; i++; }
                else if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { row.push(field); field = ''; }
                else if ((char === '\r' || char === '\n') && !inQuotes) {
                    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); field = ''; row = []; }
                    if (char === '\r' && next === '\n') i++;
                } else field += char;
            }
            if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
            const headers = rows[0].map(h => h.trim());
            return rows.slice(1).map(r => {
                const obj = {};
                headers.forEach((h, i) => obj[h] = (r[i] || "").trim());
                obj.NORMALIZED_ID = (obj['ID_ESTUDIO'] || r[0] || "").trim();
                return obj;
            });
        };

        const poblarEstados = () => {
            const estados = [...new Set(acuiferosData.map(a => a.ESTADO))].filter(Boolean).sort();
            estados.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e; opt.textContent = e;
                filtroEstado.appendChild(opt);
            });
        };

        const aplicarFiltrosYRenderizar = () => {
            currentPage = 1;
            const idV = filtroId.value.trim();
            const edoV = filtroEstado.value;
            const acuV = filtroAcuifero.value;
            const txtV = filtroTexto.value.toLowerCase().trim();

            let filtrados = estudiosData;
            if (idV) filtrados = filtrados.filter(e => e.NORMALIZED_ID === idV);
            if (edoV || acuV) {
                const idsValidos = new Set(acuiferosData
                    .filter(a => (edoV ? a.ESTADO === edoV : true) && (acuV ? a.ACUIFERO === acuV : true))
                    .map(a => a.NORMALIZED_ID));
                filtrados = filtrados.filter(e => idsValidos.has(e.NORMALIZED_ID));
            }
            if (txtV) filtrados = filtrados.filter(e => (e.TITULO_BUSQUEDA + e.TITULO_ORIGINAL).toLowerCase().includes(txtV));

            estudiosFiltrados = filtrados;
            contadorResultados.textContent = `${estudiosFiltrados.length} estudios encontrados.`;
            renderizarTabla();
            renderizarPaginacion();
        };

        // Busca y reemplaza la función renderizarTabla dentro de tu script.js
        const renderizarTabla = () => {
            tablaResultados.innerHTML = '';
            const inicio = (currentPage - 1) * studiesPerPage;
            const pagina = estudiosFiltrados.slice(inicio, inicio + studiesPerPage);

            if (pagina.length === 0) {
                tablaResultados.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No se encontraron resultados.</td></tr>';
                return;
            }

            pagina.forEach(e => {
                // Obtenemos los estados relacionados (usando tu lógica actual de acuiferosData)
                const edos = [...new Set(acuiferosData.filter(a => a.NORMALIZED_ID === e.NORMALIZED_ID).map(a => a.ESTADO))].sort().join(', ');
                
                // Validación de Carátula
                const hasCaratula = e.CARATULA && e.CARATULA.trim() !== "" && e.CARATULA !== "#";

                // --- LÓGICA DE MÚLTIPLES PDFs (TOMOS) ---
                let pdfContent = '';
                if (e.PDF && e.PDF.trim() !== "" && e.PDF !== "#") {
                    // Separamos por ";"
                    const urls = e.PDF.split(';');
                    
                    pdfContent = `<div class="pdf-container">` + 
                        urls.map(url => {
                            const cleanUrl = url.trim();
                            if (!cleanUrl) return '';
                            
                            // Extraemos TOMOXX del nombre del archivo
                            const match = cleanUrl.match(/(TOMO\d+)/i);
                            const alias = match ? match[0].toUpperCase() : 'PDF';
                            
                            return `<a href="${cleanUrl}" target="_blank" class="pdf-link" title="Descargar ${alias}">
                                        <i class="fa-solid fa-file-pdf"></i> ${alias}
                                    </a>`;
                        }).join('') + `</div>`;
                } else {
                    pdfContent = `<i class="fa-regular fa-file-pdf icon-disabled" title="No disponible"></i>`;
                }

                const row = document.createElement('tr');
                // Importante: mantenemos data-label para que tu vista móvil funcione
                row.innerHTML = `
                    <td data-label="NÚMERO">${e.NORMALIZED_ID}</td>
                    <td data-label="TÍTULO" style="text-align:left;">${e.TITULO_ORIGINAL || e.TITULO_BUSQUEDA}</td>
                    <td data-label="ESTADOS">${edos || e.ESTADOS || ''}</td>
                    <td data-label="AÑO">${e.AÑO || ''}</td>
                    <td data-label="CARÁTULA" style="text-align:center;">
                        ${hasCaratula 
                            ? `<a href="${e.CARATULA}" target="_blank" title="Ver Carátula"><i class="fa-regular fa-image"></i></a>` 
                            : `<i class="fa-regular fa-image icon-disabled" title="No disponible"></i>`}
                    </td>
                    <td data-label="PDF" class="td-pdf-container">
                        ${pdfContent}
                    </td>
                `;
                tablaResultados.appendChild(row);
            });

            renderizarPaginacion();
        };

        const renderizarPaginacion = () => {
        paginationContainer.innerHTML = '';
        const total = Math.ceil(estudiosFiltrados.length / studiesPerPage);
        if (total <= 1) return;

        // --- BOTÓN PRIMERO ---
        const btnFirst = document.createElement('button');
        btnFirst.innerHTML = '<i class="fa-solid fa-angles-left"></i> Primero';
        btnFirst.disabled = (currentPage === 1);
        btnFirst.onclick = () => { currentPage = 1; actualizarVista(); };
        paginationContainer.appendChild(btnFirst);

        // --- BOTÓN ANTERIOR ---
        const btnPrev = document.createElement('button');
        btnPrev.innerHTML = '<i class="fa-solid fa-angle-left"></i> Anterior';
        btnPrev.disabled = (currentPage === 1);
        btnPrev.onclick = () => { currentPage--; actualizarVista(); };
        paginationContainer.appendChild(btnPrev);

        // --- NÚMEROS DE PÁGINA (Bloque dinámico) ---
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(total, start + 4);
        if (end === total) start = Math.max(1, end - 4);

        for (let i = start; i <= end; i++) {
            const b = document.createElement('button');
            b.textContent = i;
            if (i === currentPage) b.classList.add('active');
            b.onclick = () => { currentPage = i; actualizarVista(); };
            paginationContainer.appendChild(b);
        }

        // --- BOTÓN SIGUIENTE ---
        const btnNext = document.createElement('button');
        btnNext.innerHTML = 'Siguiente <i class="fa-solid fa-angle-right"></i>';
        btnNext.disabled = (currentPage === total);
        btnNext.onclick = () => { currentPage++; actualizarVista(); };
        paginationContainer.appendChild(btnNext);

        // --- BOTÓN ÚLTIMO ---
        const btnLast = document.createElement('button');
        btnLast.innerHTML = 'Último <i class="fa-solid fa-angles-right"></i>';
        btnLast.disabled = (currentPage === total);
        btnLast.onclick = () => { currentPage = total; actualizarVista(); };
        paginationContainer.appendChild(btnLast);
    };

    // Función auxiliar para no repetir código
    const actualizarVista = () => {
        renderizarTabla();
        renderizarPaginacion();
        window.scrollTo(0, 0);
    };

        document.getElementById('btn-exportar').onclick = () => {
            let csv = "ID,TITULO,ESTADOS,AÑO,LINK\n";
            estudiosFiltrados.forEach(e => {
                const edos = [...new Set(acuiferosData.filter(a => a.NORMALIZED_ID === e.NORMALIZED_ID).map(a => a.ESTADO))].join(' / ');
                csv += `"${e.NORMALIZED_ID}","${(e.TITULO_ORIGINAL || "").replace(/"/g,'""')}","${edos}","${e.AÑO || ""}","${e.PDF || ""}"\n`;
            });
            const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "BiVAS_Export.csv";
            link.click();
        };

     // --- EVENTOS DE LOS FILTROS ---

        // Buscador por ID
        filtroId.addEventListener('input', () => {
            aplicarFiltrosYRenderizar();
        });

        // Filtro por Estado (y carga de acuíferos)
        filtroEstado.onchange = () => {
            const estadoSeleccionado = filtroEstado.value;
            const acs = [...new Set(acuiferosData
                .filter(a => a.ESTADO === estadoSeleccionado)
                .map(a => a.ACUIFERO))]
                .sort();

            filtroAcuifero.innerHTML = '<option value="">-- Todos --</option>';
            acs.forEach(ac => { 
                const o = document.createElement('option'); 
                o.value = ac; 
                o.textContent = ac; 
                filtroAcuifero.appendChild(o); 
            });
            
            aplicarFiltrosYRenderizar();
        };

        // Otros filtros
        filtroAcuifero.onchange = aplicarFiltrosYRenderizar;
        filtroTexto.oninput = aplicarFiltrosYRenderizar;

        // Botón Limpiar
        document.getElementById('btn-limpiar-filtros').onclick = () => {
            filtroId.value = '';
            filtroEstado.value = '';
            filtroAcuifero.innerHTML = '<option value="">-- Todos --</option>';
            filtroTexto.value = '';
            aplicarFiltrosYRenderizar();
        };

        // --- EXPORTACIÓN ---
        document.getElementById('btn-exportar').onclick = () => {
            let csv = "ID,TITULO,ESTADOS,AÑO,LINK\n";
            estudiosFiltrados.forEach(e => {
                const edos = [...new Set(acuiferosData.filter(a => a.NORMALIZED_ID === e.NORMALIZED_ID).map(a => a.ESTADO))].join(' / ');
                csv += `"${e.NORMALIZED_ID}","${(e.TITULO_ORIGINAL || "").replace(/"/g,'""')}","${edos}","${e.AÑO || ""}","${e.PDF || ""}"\n`;
            });
            const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "BiVAS_Export.csv";
            link.click();
        };

        // Arrancar la carga inicial
        cargarDatos();
    });