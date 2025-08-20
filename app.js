/**
 * @file app.js
 * @description Lógica principal para la aplicación de búsqueda de películas "Rumbo al Ariel".
 * @version 1.0
 */

// =================================================================================
// INITIALIZATION
// =================================================================================

let fuse; // Instancia global de Fuse.js para la búsqueda difusa.

/**
 * Prepara los datos y configura la instancia de Fuse.js para la búsqueda libre.
 */
function inicializarBusqueda() {
  const datos = prepararDatosParaBusqueda();
  const options = {
    keys: ['searchable_tokens'],
    threshold: 0.4,
    minMatchCharLength: 2,
    useExtendedSearch: true,
    ignoreFieldNorm: true,
  };
  fuse = new Fuse(datos, options);
}

/**
 * Rellena los menús desplegables con los datos cargados.
 */
function fillDropdowns() {
  const estadosSet = new Set();
  const peliculasList = Object.keys(peliculas).sort();
  const categoriasSet = new Set();
  const fechasSet = new Set();

  for (const sede_id in sedes) {
    estadosSet.add(sedes[sede_id].estado);
  }

  for (const [titulo, p] of Object.entries(peliculas)) {
    (p.categoria || []).forEach(c => categoriasSet.add(c));
    (p.proyecciones || []).forEach(pr => fechasSet.add(pr.timestamp.split("T")[0]));
  }

  // Generar HTML para cada select
  document.getElementById("estadoSelect").innerHTML =
    '<option value="Todos">Todos</option>' +
    [...estadosSet].sort().map(e => `<option value="${e}">${escapeHtml(e)}</option>`).join("");

  document.getElementById("peliculaSelect").innerHTML =
    '<option value="">Selecciona una película</option>' +
    peliculasList.map(t => `<option value="${t}">${escapeHtml(t)}</option>`).join("");

  document.getElementById("estadoSedeSelect").innerHTML =
    '<option value="">Selecciona un estado</option>' +
    [...estadosSet].sort().map(e => `<option value="${e}">${escapeHtml(e)}</option>`).join("");

  document.getElementById("categoriaSelect").innerHTML =
    '<option value="">Selecciona una categoría</option>' +
    [...categoriasSet].sort().map(c => `<option value="${c}">${escapeHtml(c)}</option>`).join("");

  document.getElementById("fechaSelect").innerHTML =
    '<option value="Todas">Todas las fechas</option>' +
    [...fechasSet].sort().map(f => {
      const [y, m, d] = f.split("-");
      const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      return `<option value="${f}">${d} de ${meses[parseInt(m, 10) - 1]} de ${y}</option>`;
    }).join("");
}

// =================================================================================
// UI CONTROL
// =================================================================================

/**
 * Muestra una pestaña de búsqueda y oculta las demás. Limpia los resultados.
 * @param {string} tabId El ID de la pestaña a mostrar.
 */
function showTab(tabId) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  document.getElementById("resultadosTable").innerHTML = "";
  document.getElementById("peliculaInfoContainer").innerHTML = "";
}

/**
 * Muestra u oculta la casilla "Ocultar funciones pasadas" según la selección de fecha.
 */
function toggleCheckboxVisibilidad() {
  const fechaSelect = document.getElementById("fechaSelect");
  const checkboxContainer = document.getElementById("checkboxOcultarContainer");
  if (fechaSelect.value === "Todas") {
    checkboxContainer.classList.remove("hidden");
  } else {
    checkboxContainer.classList.add("hidden");
  }
}

/**
 * Renderiza una tabla de resultados en el DOM.
 * @param {Array<Object>} filas Un array de objetos para mostrar en la tabla.
 */
function renderTable(filas) {
  const table = document.getElementById("resultadosTable");
  if (filas.length === 0) {
    table.innerHTML = "<tr><td>No se encontraron resultados.</td></tr>";
    return;
  }
  const headers = Object.keys(filas[0]);
  const thead = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const tbody = filas.map(f => `<tr>${headers.map(h => `<td>${formatMultiline(f[h])}</td>`).join("")}</tr>`).join("");
  table.innerHTML = thead + tbody;
}

/**
 * Restaura el botón de la pestaña "Categoría" a su estado original.
 */
function resetCategoriaBoton() {
  const btn = document.getElementById('categoriaBtn');
  btn.textContent = 'Buscar';
  btn.onclick = buscarPorCategoria;
}

// =================================================================================
// DATA HANDLING & UTILS
// =================================================================================

/**
 * Crea una lista plana de proyecciones con datos enriquecidos para la búsqueda.
 * @returns {Array<Object>} Un array de objetos optimizado para Fuse.js.
 */
function prepararDatosParaBusqueda() {
  const listaPlana = [];
  for (const [titulo, peli] of Object.entries(peliculas)) {
    for (const pr of(peli.proyecciones || [])) {
      const sede = sedes[pr.sede_id];
      const { fecha, hora } = timestampToFechaHora(pr.timestamp);

      const textoCompleto = [titulo, peli.director, sede.nombre, sede.ubicacion, sede.estado].join(' ');
      const tokens = [...new Set(textoCompleto.toLowerCase().replace(/[,\.]/g, '').split(/\s+/))];

      listaPlana.push({
        pelicula: titulo,
        director: peli.director,
        duracion: peli.duracion,
        sede: sede.nombre,
        direccion: sede.ubicacion,
        estado: sede.estado,
        fecha: fecha,
        hora: hora,
        searchable_tokens: tokens
      });
    }
  }
  return listaPlana;
}

/**
 * Convierte un timestamp a un objeto con formatos de fecha y hora.
 * @param {number} ts El timestamp a convertir.
 * @returns {{fecha: string, hora: string, fechaISO: string}}
 */
function timestampToFechaHora(ts) {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");

  return {
    fecha: d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }),
    hora: `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} hrs.`,
    fechaISO: `${year}-${month}-${day}`
  };
}

/**
 * Escapa caracteres HTML para prevenir inyecciones XSS.
 * @param {string} text El texto a escapar.
 * @returns {string}
 */
function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formatea un texto multilínea a HTML con saltos de línea.
 * @param {string} text El texto a formatear.
 * @returns {string}
 */
function formatMultiline(text) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

// =================================================================================
// SEARCH LOGIC
// =================================================================================

/**
 * Realiza una búsqueda libre usando Fuse.js.
 */
function buscarPorTexto() {
  const query = document.getElementById('textoInput').value;
  if (!query || query.trim().length < 2) {
    document.getElementById("resultadosTable").innerHTML = "";
    return;
  }

  const palabras = query.trim().split(/\s+/);
  const consultaLogica = {
    $and: palabras.map(palabra => ({
      searchable_tokens: palabra
    }))
  };
  const resultadosFuse = fuse.search(consultaLogica);

  const res = resultadosFuse.map(resultado => {
    const item = resultado.item;
    return {
      "Película": item.pelicula,
      "Sede": item.sede,
      "Dirección": item.direccion,
      "Fecha": item.fecha,
      "Hora": item.hora,
    };
  });
  renderTable(res);
}

/**
 * Muestra los detalles de una película y sus proyecciones.
 */
function buscarPelicula() {
  const titulo = document.getElementById("peliculaSelect").value;
  const peli = peliculas[titulo];
  if (!peli) return;

  const infoContainer = document.getElementById("peliculaInfoContainer");
  const table = document.getElementById("resultadosTable");
  infoContainer.innerHTML = "";
  table.innerHTML = "";

  let streamingHTML = "";
  if (Array.isArray(peli.streaming) && peli.streaming.length > 0) {
    const servicios = peli.streaming.map(s => s.link ? `<a href="${s.link}" target="_blank">${escapeHtml(s.servicio)}</a>` : escapeHtml(s.servicio));
    if (servicios.length === 1) {
      streamingHTML = `<div style="font-style:italic;margin-top:4px;">Disponible en ${servicios[0]}</div>`;
    } else if (servicios.length === 2) {
      streamingHTML = `<div style="font-style:italic;margin-top:4px;">Disponible en ${servicios.join(" y ")}</div>`;
    } else {
      const last = servicios.pop();
      streamingHTML = `<div style="font-style:italic;margin-top:4px;">Disponible en ${servicios.join(", ")} y ${last}</div>`;
    }
  }

  const posterHTML = peli.imagen ?
    `<div class="poster-container"><img src="${peli.imagen}" alt="Póster de ${escapeHtml(titulo)}"></div>` :
    '';

  const infoHTML = `
    <div class="pelicula-info-header">
      ${posterHTML}
      <div class="info-container">
        <div><strong>${escapeHtml(titulo)}</strong></div>
        <div style="color:#444;margin-top:4px;">${escapeHtml(peli.director)} | ${peli.estreno} | ${peli.duracion}</div>
        ${streamingHTML}
        <div style="margin-top:8px;">🎬 ${formatMultiline(peli.sinopsis)}</div>
      </div>
    </div>`;

  infoContainer.innerHTML = infoHTML;

  const res = (peli.proyecciones || []).map(pr => {
    const s = sedes[pr.sede_id];
    const { fecha, hora, fechaISO } = timestampToFechaHora(pr.timestamp);
    return { "Sede": s.nombre, "Dirección": s.ubicacion, "Fecha": fecha, "Hora": hora, "FechaISO": fechaISO };
  }).sort((a, b) => a.FechaISO.localeCompare(b.FechaISO) || a.Hora.localeCompare(b.Hora));

  if (res.length > 0) {
    const thead = `<tr><th>Sede</th><th>Dirección</th><th>Fecha</th><th>Hora</th></tr>`;
    const tbody = res.map(r => `<tr><td>${escapeHtml(r.Sede)}</td><td>${formatMultiline(r.Dirección)}</td><td>${r.Fecha}</td><td>${r.Hora}</td></tr>`).join("");
    table.innerHTML = thead + tbody;
  } else {
    table.innerHTML = '<tr><td colspan="4">No hay funciones para esta película.</td></tr>';
  }
}

/**
 * Busca proyecciones por fecha y estado, con opción de ocultar pasadas.
 */
function buscarFechaEstado() {
  const fechaSel = document.getElementById("fechaSelect").value;
  const estadoSel = document.getElementById("estadoSelect").value;
  const ocultarPasadas = document.getElementById("ocultarPasadas").checked;
  const ahora = new Date();
  const res = [];

  for (const [titulo, peli] of Object.entries(peliculas)) {
    for (const pr of(peli.proyecciones || [])) {
      const { fechaISO, fecha, hora } = timestampToFechaHora(pr.timestamp);
      const sede = sedes[pr.sede_id];

      const coincideFecha = (fechaSel === "Todas" || fechaISO === fechaSel);
      const coincideEstado = (estadoSel === "Todos" || sede.estado === estadoSel);

      if (coincideFecha && coincideEstado) {
        if (ocultarPasadas && fechaSel === "Todas") {
          if (new Date(pr.timestamp) < ahora) {
            continue;
          }
        }
        res.push({
          "Película": titulo,
          "Director": peli.director,
          "Duración": peli.duracion,
          "Sede": sede.nombre,
          "Dirección": sede.ubicacion,
          "Fecha": fecha,
          "Hora": hora,
          "FechaISO": fechaISO
        });
      }
    }
  }

  res.sort((a, b) => a.FechaISO.localeCompare(b.FechaISO) || a.Hora.localeCompare(b.Hora));
  res.forEach(r => delete r.FechaISO);
  renderTable(res);
}

/**
 * Actualiza el menú de sedes cuando se selecciona un estado.
 */
function actualizarSedesPorEstado() {
  const estado = document.getElementById("estadoSedeSelect").value;
  const sedeSel = document.getElementById("sedeSelect");
  if (!estado) {
    sedeSel.innerHTML = '<option value="">Selecciona una sede</option>';
    return;
  }
  const sedesOpciones = Object.entries(sedes)
    .filter(([_, s]) => s.estado === estado)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
    .map(([id, s]) => `<option value="${id}">${escapeHtml(s.nombre)}</option>`);
  sedeSel.innerHTML = '<option value="">Selecciona una sede</option>' + sedesOpciones.join('');
}

/**
 * Busca todas las proyecciones en una sede específica.
 */
function buscarPorSede() {
  const sede_id = document.getElementById("sedeSelect").value;
  if (!sede_id) return;

  const sede = sedes[sede_id];
  const res = [];

  for (const [titulo, peli] of Object.entries(peliculas)) {
    for (const pr of(peli.proyecciones || [])) {
      if (pr.sede_id === sede_id) {
        const { fecha, hora, fechaISO } = timestampToFechaHora(pr.timestamp);
        res.push({
          "Película": titulo,
          "Duración": peli.duracion,
          "Fecha": fecha,
          "Hora": hora,
          "FechaISO": fechaISO
        });
      }
    }
  }

  res.sort((a, b) => a.FechaISO.localeCompare(b.FechaISO) || a.Hora.localeCompare(b.Hora));

  const table = document.getElementById("resultadosTable");
  let finalHTML = `<tr><td colspan="4" style="padding:12px;">
    <strong>${escapeHtml(sede.nombre)}</strong><br>
    ${formatMultiline(sede.ubicacion)}
  </td></tr>`;

  if (res.length > 0) {
    const thead = `<tr><th>Película</th><th>Duración</th><th>Fecha</th><th>Hora</th></tr>`;
    const tbody = res.map(r => `<tr>
        <td>${escapeHtml(r.Película)}</td>
        <td>${escapeHtml(r.Duración)}</td>
        <td>${r.Fecha}</td>
        <td>${r.Hora}</td>
      </tr>`).join('');
    finalHTML += thead + tbody;
  } else {
    finalHTML += '<tr><td colspan="4">No hay funciones en esta sede.</td></tr>';
  }
  table.innerHTML = finalHTML;
}

/**
 * Muestra una lista de películas que pertenecen a una categoría.
 */
function buscarPorCategoria() {
  document.getElementById('peliculaInfoContainer').innerHTML = "";
  const btn = document.getElementById('categoriaBtn');
  btn.textContent = 'Buscar';
  btn.onclick = buscarPorCategoria;

  const categoria = document.getElementById("categoriaSelect").value;
  if (!categoria) {
    document.getElementById("resultadosTable").innerHTML = "";
    return;
  }

  const peliculasEnCategoria = Object.entries(peliculas)
    .filter(([_, datos]) => Array.isArray(datos.categoria) && datos.categoria.includes(categoria))
    .map(([titulo]) => titulo)
    .sort();

  const table = document.getElementById("resultadosTable");
  if (peliculasEnCategoria.length === 0) {
    table.innerHTML = `<tr><td>No hay películas nominadas en esta categoría.</td></tr>`;
    return;
  }

  const rows = peliculasEnCategoria.map(titulo =>
    `<tr><td><button onclick="verPeliculaDesdeCategoria('${titulo.replace(/'/g, "\\'")}')">${escapeHtml(titulo)}</button></td></tr>`
  ).join('');

  table.innerHTML = `<tr><th>Películas nominadas en: ${escapeHtml(categoria)}</th></tr>` + rows;
}

/**
 * Muestra los detalles de una película desde la lista de categorías.
 * @param {string} titulo El título de la película a mostrar.
 */
function verPeliculaDesdeCategoria(titulo) {
  document.getElementById("peliculaSelect").value = titulo;
  buscarPelicula();

  const btn = document.getElementById('categoriaBtn');
  btn.textContent = 'Regresar';
  btn.onclick = buscarPorCategoria;
}

/**
 * Procesa parámetros en el hash de la URL para enlaces directos.
 */
function procesarHashURL() {
  if (!window.location.hash) return;

  const params = new URLSearchParams(window.location.hash.substring(1));
  const tabId = params.get('tab');
  const query = params.get('q');
  const query2 = params.get('q2');

  if (!tabId || !query) return;

  showTab(tabId);

  switch (tabId) {
    case 'peliculaTab':
      document.getElementById('peliculaSelect').value = query;
      buscarPelicula();
      break;
    case 'fechaTab':
      document.getElementById('fechaSelect').value = query;
      document.getElementById('estadoSelect').value = query2 || 'Todos';
      toggleCheckboxVisibilidad();
      buscarFechaEstado();
      break;
    case 'sedeTab':
      if (query2) {
        document.getElementById('estadoSedeSelect').value = query;
        actualizarSedesPorEstado();
        document.getElementById('sedeSelect').value = query2;
        buscarPorSede();
      }
      break;
    case 'categoriaTab':
      document.getElementById('categoriaSelect').value = query;
      buscarPorCategoria();
      break;
  }
}

// =================================================================================
// APP START
// =================================================================================

// Inicializa los componentes de la página
fillDropdowns();
inicializarBusqueda();
toggleCheckboxVisibilidad();
procesarHashURL();

// Añade el listener para la búsqueda por texto con la tecla Enter
document.getElementById('textoInput').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    buscarPorTexto();
  }
});