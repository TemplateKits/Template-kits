const contenedor = document.getElementById("contenedor");
const buscador = document.getElementById("buscador");
const paginacion = document.getElementById("paginacion");
const paginacionBottom = document.getElementById("paginacion-bottom");
const contador = document.getElementById("contador");
const themeToggle = document.getElementById("themeToggle");

let data = [];
let paginaActual = 1;
let totalPaginas = 11;
const cache = new Map();

function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const icon = themeToggle.querySelector(".theme-icon");
  icon.textContent = theme === "dark" ? "☀️" : "🌙";
}

themeToggle?.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);
});

function showLoading(show) {
  let loader = document.getElementById("loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loader";
    loader.textContent = "Cargando...";
    document.body.appendChild(loader);
  }
  loader.style.display = show ? "block" : "none";
}

async function detectTotalPages(maxProbe = 200) {
  showLoading(true);
  try {
    let i = 1;
    for (; i <= maxProbe; i++) {
      const url = `data/data${i}.json`;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (!res.ok) break;
      } catch {
        break;
      }
    }
    totalPaginas = Math.max(1, i - 1);
  } finally {
    showLoading(false);
  }
}

async function fetchPageJson(pagina) {
  const url = `data/data${pagina}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Archivo ${url} no encontrado`);
  return res.json();
}

async function cargarPagina(pagina) {
  try {
    showLoading(true);
    pagina = Math.min(Math.max(1, pagina), totalPaginas);

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

    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    contenedor.innerHTML = `<p style="text-align: center; color: var(--color-text-secondary);">Error al cargar la página ${pagina}</p>`;
    console.error(err);
  } finally {
    showLoading(false);
  }
}

function createItemNode(item = {}) {
  const wrap = document.createElement("div");
  wrap.className = "item";
  wrap.setAttribute("role", "listitem");

  const imgWrapper = document.createElement("div");
  imgWrapper.className = "item-image-wrapper";

  if (item.imagen) {
    const img = document.createElement("img");
    img.src = item.imagen;
    img.alt = item.titulo || "Plantilla";
    img.loading = "lazy";
    imgWrapper.appendChild(img);
  }
  wrap.appendChild(imgWrapper);

  const content = document.createElement("div");
  content.className = "item-content";

  const titulo = document.createElement("div");
  titulo.className = "titulo";
  const a = document.createElement("a");
  a.href = item.link || "#";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = item.titulo || "Sin título";
  a.title = item.titulo || "Sin título";
  titulo.appendChild(a);
  content.appendChild(titulo);

  const autor = document.createElement("div");
  autor.className = "autor";
  autor.textContent = item.autor || "Autor desconocido";
  content.appendChild(autor);

  const idDiv = document.createElement("div");
  idDiv.className = "id";
  idDiv.textContent = item.id || "-";
  content.appendChild(idDiv);

  const mensaje = encodeURIComponent(
    `Hola, me interesa esta plantilla:\n\nTítulo: ${item.titulo || ""}\nID: ${item.id || ""}\n\n¿Podrías darme más información?`
  );
  const whatsappLink = `https://wa.me/573184707325?text=${mensaje}`;
  const wa = document.createElement("a");
  wa.className = "whatsapp";
  wa.href = whatsappLink;
  wa.target = "_blank";
  wa.rel = "noopener noreferrer";
  wa.textContent = "Contactar por WhatsApp";
  wa.setAttribute("aria-label", `Contactar sobre ${item.titulo || "plantilla"}`);
  content.appendChild(wa);

  wrap.appendChild(content);
  return wrap;
}

function renderItems(filtro = "") {
  contenedor.innerHTML = "";

  if (!Array.isArray(data)) {
    contenedor.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">No hay datos disponibles</p>';
    contador.textContent = "";
    return;
  }

  const q = filtro.trim().toLowerCase();
  const filtrados = data.filter(item =>
    (item.titulo || "").toLowerCase().includes(q) ||
    (item.autor || "").toLowerCase().includes(q) ||
    (item.id || "").toLowerCase().includes(q)
  );

  contador.textContent = filtrados.length === data.length
    ? `${data.length} plantillas`
    : `${filtrados.length} de ${data.length} plantillas`;

  if (filtrados.length === 0) {
    contenedor.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: 3rem 0;">No se encontraron resultados para tu búsqueda</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtrados.forEach(item => fragment.appendChild(createItemNode(item)));
  contenedor.appendChild(fragment);
}

function getVisiblePages(current, total, maxVisible = 7) {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];
  const sideSlots = maxVisible - 3;
  let left = Math.max(2, current - Math.floor(sideSlots / 2));
  let right = Math.min(total - 1, left + sideSlots - 1);
  left = Math.max(2, right - sideSlots + 1);

  pages.push(1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  if (total > 1) pages.push(total);

  return pages;
}

function renderPaginacion() {
  [paginacion, paginacionBottom].forEach(container => {
    if (!container) return;

    container.innerHTML = "";
    const pages = getVisiblePages(paginaActual, totalPaginas);

    pages.forEach(p => {
      if (p === "...") {
        const span = document.createElement("span");
        span.textContent = "...";
        span.className = "puntos";
        span.setAttribute("aria-hidden", "true");
        container.appendChild(span);
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
        if (p !== paginaActual) cargarPagina(p);
      });

      container.appendChild(btn);
    });
  });
}

function debounce(fn, wait = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function updateHash() {
  const q = encodeURIComponent(buscador.value || "");
  history.replaceState(null, "", `#p=${paginaActual}&q=${q}`);
}

function readHash() {
  const hash = location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const p = parseInt(params.get("p"), 10);
  const q = params.get("q");
  return { p: isNaN(p) ? 1 : p, q: q ? decodeURIComponent(q) : "" };
}

buscador?.addEventListener(
  "input",
  debounce(e => {
    renderItems(e.target.value);
    updateHash();
  }, 300)
);

window.addEventListener("hashchange", () => {
  const { p, q } = readHash();
  if (q) buscador.value = q;
  cargarPagina(p);
});

async function init() {
  if (!contenedor || !buscador || !paginacion || !contador) {
    console.error("Faltan elementos DOM requeridos");
    return;
  }

  initTheme();
  await detectTotalPages(200);

  const { p, q } = readHash();
  paginaActual = Math.min(Math.max(1, p), totalPaginas);
  if (q) buscador.value = q;

  try {
    await cargarPagina(paginaActual);
    if (buscador.value) renderItems(buscador.value);
  } catch {
    if (paginaActual !== 1) cargarPagina(1);
  }
}

init();
