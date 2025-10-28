// ...existing code...
const contenedor = document.getElementById("contenedor");
const buscador = document.getElementById("buscador");
const paginacion = document.getElementById("paginacion");
const contador = document.getElementById("contador");

let data = [];
let paginaActual = 1;
let totalPaginas = 11; // valor por defecto; será detectado automáticamente
const cache = new Map();

function showLoading(show) {
  let loader = document.getElementById("loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loader";
    loader.textContent = "Cargando...";
    loader.style.position = "fixed";
    loader.style.right = "12px";
    loader.style.top = "12px";
    loader.style.padding = "6px 10px";
    loader.style.background = "rgba(0,0,0,0.7)";
    loader.style.color = "#fff";
    loader.style.borderRadius = "4px";
    loader.style.zIndex = "9999";
    document.body.appendChild(loader);
  }
  loader.style.display = show ? "block" : "none";
}

/**
 * Intenta detectar cuántos archivos data/data{n}.json existen.
 * Hace peticiones secuenciales hasta el primer 404 (o hasta maxProbe).
 * Devuelve el número total detectado (>= 1).
 */
async function detectTotalPages(maxProbe = 200) {
  showLoading(true);
  try {
    let i = 1;
    for (; i <= maxProbe; i++) {
      const url = `data/data${i}.json`;
      try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) {
          // si no existe, parar y devolver i-1
          break;
        }
        // cache minimalmente la respuesta para evitar re-fetch al cargar página
        // notar: no parseamos JSON aquí para ahorrar CPU; pero guardamos true para marcar existencia
        cache.set(i, null); // placeholder; al cargar la página se reemplaza con el JSON real
      } catch (e) {
        // fallo en la petición — asumimos que no hay más
        break;
      }
    }
    totalPaginas = Math.max(1, i - 1);
    // si no encontró ninguno, intenta por lo menos 1
    if (totalPaginas === 0) totalPaginas = 1;
  } finally {
    showLoading(false);
  }
}

async function fetchPageJson(pagina) {
  const url = `data/data${pagina}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Archivo ${url} no encontrado (status ${res.status})`);
  return res.json();
}

async function cargarPagina(pagina) {
  try {
    showLoading(true);
    if (typeof pagina !== "number" || pagina < 1) pagina = 1;
    // ajustar dentro de rango detectado
    if (typeof totalPaginas === "number") {
      pagina = Math.min(Math.max(1, pagina), totalPaginas);
    }

    if (cache.has(pagina) && cache.get(pagina) !== null) {
      data = cache.get(pagina);
    } else {
      const json = await fetchPageJson(pagina);
      cache.set(pagina, json);
      data = json;
    }
    paginaActual = pagina;
    renderItems(buscador.value || "");
    renderPaginacion();
    updateHash();
  } catch (err) {
    contenedor.innerHTML = `<p>Error al cargar la página ${pagina}</p>`;
    console.error(err);
  } finally {
    showLoading(false);
  }
}

function createItemNode(item = {}) {
  const wrap = document.createElement("div");
  wrap.className = "item";

  if (item.imagen) {
    const img = document.createElement("img");
    img.src = item.imagen;
    img.alt = item.titulo || "Plantilla";
    img.loading = "lazy";
    wrap.appendChild(img);
  } else {
    const p = document.createElement("p");
    p.textContent = "Imagen no disponible";
    wrap.appendChild(p);
  }

  const titulo = document.createElement("div");
  titulo.className = "titulo";
  const a = document.createElement("a");
  a.href = item.link || "#";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = item.titulo || "Sin título";
  titulo.appendChild(a);
  wrap.appendChild(titulo);

  const autor = document.createElement("div");
  autor.className = "autor";
  autor.textContent = `Autor: ${item.autor || "-"}`;
  wrap.appendChild(autor);

  const idDiv = document.createElement("div");
  idDiv.className = "id";
  idDiv.textContent = `ID: ${item.id || "-"}`;
  wrap.appendChild(idDiv);

  const mensaje = encodeURIComponent(`Hola, quiero obtener esta plantilla:\nTítulo: ${item.titulo || ""}\nID: ${item.id || ""}`);
  const whatsappLink = `https://wa.me/573184707325?text=${mensaje}`;
  const wa = document.createElement("a");
  wa.className = "whatsapp";
  wa.href = whatsappLink;
  wa.target = "_blank";
  wa.rel = "noopener noreferrer";
  wa.textContent = "Contactar por WhatsApp";
  wrap.appendChild(wa);

  return wrap;
}

function renderItems(filtro = "") {
  contenedor.innerHTML = "";
  if (!Array.isArray(data)) {
    contenedor.textContent = "No hay datos en esta página";
    contador.textContent = "";
    return;
  }
  const q = (filtro || "").toString().trim().toLowerCase();
  const filtrados = data.filter(item =>
    ((item.titulo || "").toString().toLowerCase().includes(q)) ||
    ((item.autor || "").toString().toLowerCase().includes(q)) ||
    ((item.id || "").toString().toLowerCase().includes(q))
  );

  contador.textContent = `Mostrando ${filtrados.length} de ${data.length} plantillas`;

  if (filtrados.length === 0) {
    const nores = document.createElement("p");
    nores.textContent = "No se encontraron resultados";
    contenedor.appendChild(nores);
    return;
  }

  const fragment = document.createDocumentFragment();
  filtrados.forEach(item => fragment.appendChild(createItemNode(item)));
  contenedor.appendChild(fragment);
}

/**
 * Calcula lista de elementos a mostrar en paginación:
 * devuelve array con números y '...' como separador
 */
function getVisiblePages(current, total, maxVisible) {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];
  const sideSlots = maxVisible - 2; // reservamos 1 y total
  let left = Math.max(2, current - Math.floor(sideSlots / 2));
  let right = Math.min(total - 1, left + sideSlots - 1);
  left = Math.max(2, right - sideSlots + 1);

  pages.push(1);
  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

/**
 * Renderiza la paginación de forma responsiva:
 * - usa overflow-x:auto como fallback
 * - en pantallas estrechas muestra un subconjunto con "..."
 */
function renderPaginacion() {
  paginacion.innerHTML = "";
  // estilos básicos para que quede navegable en móvil si no caben todos
  paginacion.style.display = "flex";
  paginacion.style.flexWrap = "nowrap";
  paginacion.style.overflowX = "auto";
  paginacion.style.gap = "6px";
  paginacion.style.alignItems = "center";
  paginacion.setAttribute("role", "navigation");
  paginacion.setAttribute("aria-label", "Paginación");

  // calcular cuántos botones caben aproximadamente
  const btnMin = 44; // px aproximado por botón/icono (ajustar si cambias CSS)
  const availableWidth = Math.max(200, paginacion.clientWidth || window.innerWidth);
  let maxVisible = Math.floor(availableWidth / btnMin);
  if (maxVisible < 5) maxVisible = 5; // mostrar al menos 5 elementos en la estructura (1 ... n ... last)

  const pages = getVisiblePages(paginaActual, totalPaginas, maxVisible);

  pages.forEach(p => {
    if (p === '...') {
      const span = document.createElement("span");
      span.textContent = "...";
      span.className = "puntos";
      span.setAttribute("aria-hidden", "true");
      paginacion.appendChild(span);
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p;
    btn.className = p === paginaActual ? "activo" : "";
    btn.setAttribute("aria-label", `Página ${p}`);
    if (p === paginaActual) {
      btn.setAttribute("aria-current", "page");
    }
    btn.addEventListener("click", () => {
      if (p === paginaActual) return;
      cargarPagina(p);
    });
    paginacion.appendChild(btn);
  });

  // desplazar el botón activo al centro (si es posible)
  requestAnimationFrame(() => {
    const active = paginacion.querySelector("button.activo");
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
  });
}

// re-render en resize (debounced)
function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
window.addEventListener("resize", debounce(() => {
  renderPaginacion();
}, 150));

function updateHash() {
  const q = encodeURIComponent(buscador.value || "");
  location.hash = `p=${paginaActual}&q=${q}`;
}

function readHash() {
  const hash = location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const p = parseInt(params.get("p"), 10);
  const q = params.get("q");
  return { p: isNaN(p) ? 1 : p, q: q ? decodeURIComponent(q) : "" };
}

buscador.addEventListener("input", debounce(e => {
  renderItems(e.target.value);
  updateHash();
}, 250));

window.addEventListener("hashchange", () => {
  const { p, q } = readHash();
  paginaActual = p;
  if (typeof q === "string") buscador.value = q;
  cargarPagina(p);
});

async function init() {
  // seguridad: si algún elemento no existe, detener y mostrar en consola
  if (!contenedor || !buscador || !paginacion || !contador) {
    console.error("Faltan elementos DOM requeridos (contenedor, buscador, paginacion, contador).");
    return;
  }

  // detectar automáticamente cuántas páginas hay en /data
  await detectTotalPages(200);

  const { p, q } = readHash();
  // garantizar que la página inicial esté dentro del rango detectado
  paginaActual = Math.min(Math.max(1, p), totalPaginas);
  if (q) buscador.value = q;

  // Intentar cargar la página indicada (fallback a 1 si falla)
  try {
    await cargarPagina(paginaActual);
    // Si buscador tiene texto, aplicar filtro inmediatamente
    if (buscador.value) renderItems(buscador.value);
  } catch {
    if (paginaActual !== 1) {
      paginaActual = 1;
      cargarPagina(1);
    }
  }
}

init();
// ...existing code...