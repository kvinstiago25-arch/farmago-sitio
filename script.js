/* ===== Bloque 1/9 ===== */
(function () {
  // Evita que el navegador "recuerde" la posición de scroll al recargar,
  // así el logo siempre lleva de verdad al inicio de la página.
  if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }

  const ASISTENTE_WHATSAPP_NUMBER = '573014466722';

  // Cada kit referencia productos por nombre EXACTO tal como existen en el
  // arreglo `productos` del catálogo, para que el precio mostrado siempre
  // coincida con el precio real configurado en el inventario.
  const ASISTENTE_KITS = {
    dolor: {
      titulo: 'Kit para el dolor y el malestar',
      subtitulo: 'Para dolor de cabeza, cuerpo cortado o fiebre.',
      icono: 'fa-solid fa-face-dizzy',
      nombreKit: 'Kit de Dolores',
      productos: ['Dolex Avanzado', 'Advil FastGel'],
    },
    hidratacion: {
      titulo: 'Kit de vitaminas y defensas',
      subtitulo: 'Para fortalecer tus defensas y tu energía.',
      icono: 'fa-solid fa-droplet',
      nombreKit: 'Kit de Vitaminas y Defensas',
      productos: ['Centrum Adulto', 'Vita C 500mg MK'],
    },
    piel: {
      titulo: 'Kit de cuidado personal',
      subtitulo: 'Higiene diaria para toda la familia.',
      icono: 'fa-solid fa-pump-soap',
      nombreKit: 'Kit de Cuidado Personal',
      productos: ['Colgate Triple Acción'],
    },
    bebe: {
      titulo: 'Kit de cuidado del bebé',
      subtitulo: 'Los esenciales para el día a día.',
      icono: 'fa-solid fa-baby',
      nombreKit: 'Kit de Cuidado del Bebé',
      productos: ['Pañales Huggies Natural Care M', 'Similac 1', 'Enfamil Premium 1'],
    },
  };

  const menuEl = document.getElementById('asistenteMenu');
  const resultadoEl = document.getElementById('asistenteResultado');
  const itemsEl = document.getElementById('asistenteResultadoItems');
  const totalEl = document.getElementById('asistenteResultadoTotal');
  const tituloEl = document.getElementById('asistenteResultadoTitulo');
  const subtituloEl = document.getElementById('asistenteResultadoSubtitulo');
  const iconoEl = document.getElementById('asistenteResultadoIcono');
  const whatsappBtn = document.getElementById('asistenteWhatsappBtn');
  const volverBtn = document.getElementById('asistenteVolverBtn');

  // La sección "Asistente de bienestar" fue eliminada de la página;
  // si sus elementos no existen, no seguimos con este bloque.
  if (!menuEl || !resultadoEl || !itemsEl || !totalEl || !tituloEl || !subtituloEl || !iconoEl || !whatsappBtn || !volverBtn) {
    return;
  }

  function formatoCOP(n) {
    return '$' + Number(n).toLocaleString('es-CO');
  }

  function mostrarKit(kitKey) {
    const kit = ASISTENTE_KITS[kitKey];
    if (!kit) return;

    // `productos` es la variable global del catálogo principal (declarada más
    // abajo en la página). Para cuando el usuario hace clic, todo el resto de
    // scripts ya se ejecutó, así que aquí ya existe y está poblada.
    const disponibles = (typeof productos !== 'undefined' && Array.isArray(productos)) ? productos : [];
    const encontrados = kit.productos
      .map(nombre => disponibles.find(p => p.nombre === nombre))
      .filter(Boolean);

    if (encontrados.length === 0) {
      // Si por algún motivo el producto no está en el inventario activo,
      // evitamos mostrar un kit vacío o con precio $0.
      itemsEl.innerHTML = `<p class="text-sm text-ink/50 text-center">Estos productos no están disponibles en este momento. Escríbenos por WhatsApp y te confirmamos.</p>`;
      totalEl.textContent = '—';
    } else {
      itemsEl.innerHTML = encontrados.map(p => `
        <div class="flex items-center justify-between bg-white rounded-xl border border-ink/10 px-4 py-3">
          <span class="text-sm text-ink font-medium">${escapeHTML(p.nombre)}</span>
          <span class="text-sm text-orange-dark font-semibold">${p.precio ? formatoCOP(p.precio) : 'Consultar'}</span>
        </div>
      `).join('');
      const total = encontrados.reduce((sum, p) => sum + (p.precio || 0), 0);
      totalEl.textContent = formatoCOP(total);
    }

    tituloEl.textContent = kit.titulo;
    subtituloEl.textContent = kit.subtitulo;
    iconoEl.className = kit.icono;

    const nombresProductos = encontrados.map(p => p.nombre).join(' + ') || kit.productos.join(' + ');
    const totalTexto = encontrados.length ? formatoCOP(encontrados.reduce((s, p) => s + (p.precio || 0), 0)) : 'consultar';
    const mensaje = encodeURIComponent(
      `Hola FarmaGo, usé el Asistente de Bienestar y quiero pedir el ${kit.nombreKit} (${nombresProductos}) por un valor de ${totalTexto}.`
    );
    whatsappBtn.href = `https://wa.me/${ASISTENTE_WHATSAPP_NUMBER}?text=${mensaje}`;

    crossfade(menuEl, resultadoEl);
  }

  // Transición suave: desvanece el panel actual y luego aparece el nuevo.
  function crossfade(elFuera, elDentro) {
    elFuera.style.opacity = '0';
    setTimeout(() => {
      elFuera.classList.add('hidden');
      elDentro.classList.remove('hidden');
      elDentro.style.opacity = '0';
      requestAnimationFrame(() => { elDentro.style.opacity = '1'; });
    }, 300);
  }

  menuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-kit]');
    if (!btn) return;
    mostrarKit(btn.dataset.kit);
  });

  volverBtn.addEventListener('click', () => {
    crossfade(resultadoEl, menuEl);
  });
})();

/* ===== Bloque 2/9 ===== */
let productos = [];
  let categoriaActiva = 'todas';
  let busqueda = '';
  const PRODUCTOS_POR_PAGINA = 42;
  let productosVisibles = PRODUCTOS_POR_PAGINA;
  // Filtro de subcategoría del mega-menú: { cats: string[], kw: RegExp|null, label: string } o null.
  // Tiene prioridad sobre categoriaActiva/busqueda mientras esté activo.
  let subcategoriaActiva = null;

  function quitarAcentos(s) {
    return (s || '')
      .replace(/[áàä]/g, 'a')
      .replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[ÁÀÄ]/g, 'A')
      .replace(/[ÉÈË]/g, 'E')
      .replace(/[ÍÌÏ]/g, 'I')
      .replace(/[ÓÒÖ]/g, 'O')
      .replace(/[ÚÙÜ]/g, 'U')
      .replace(/Ñ/g, 'N');
  }

  function jumpToSubcategoria(filtro) {
    subcategoriaActiva = filtro;
    categoriaActiva = 'todas';
    busqueda = '';
    productosVisibles = PRODUCTOS_POR_PAGINA;
    renderTabs();
    renderProducts();
    const catalogoEl = document.getElementById('catalogo');
    if (catalogoEl) catalogoEl.scrollIntoView({ behavior: 'smooth' });
  }
  const carrito = {}; // { nombreProducto: cantidad }
  const IMAGE_CACHE_BUSTER = Date.now();
  const PRODUCT_IMAGE_FALLBACK_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#f5f7fb"/>
      <rect x="20" y="20" width="260" height="260" rx="20" ry="20" fill="#ffffff" stroke="#e6eaf2"/>
      <g fill="#9aa6bf" font-family="Arial, sans-serif" text-anchor="middle">
        <text x="150" y="140" font-size="18" font-weight="700">FarmaGo</text>
        <text x="150" y="166" font-size="13">Imagen no disponible</text>
      </g>
    </svg>`
  )}`;

  // Normaliza categorías y rutas para tolerar variantes sin tilde/espacios
  // y corregir typos de carpetas sin cambiar la estructura visual del sitio.
  function normalizarTextoBase(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  const CATEGORIA_ALIAS = {
    antibioticos: 'Antibióticos',
    analgesicos: 'Analgésicos',
    antigripales: 'Antigripales',
    vitaminas: 'Vitaminas',
    antiinflamatorios: 'Antiinflamatorios',
    bebidas: 'Bebidas',
    'cuidado personal': 'Cuidado personal',
    cuidadopersonal: 'Cuidado personal',
    bebes: 'Bebés',
    'adulto mayor': 'Adulto mayor',
    otros: 'Otros',
  };

  const CATEGORIA_IMAGENES_GENERICAS = {
    'Analgésicos': 'assets/imagenesmedimentos/genericas/analgesicos.svg',
    'Antibióticos': 'assets/imagenesmedimentos/genericas/antibioticos.svg',
    'Antigripales': 'assets/imagenesmedimentos/genericas/antigripales.svg',
    'Vitaminas': 'assets/imagenesmedimentos/genericas/vitaminas.svg',
    'Antiinflamatorios': 'assets/imagenesmedimentos/genericas/antiinflamatorios.svg',
    'Bebidas': 'assets/imagenesmedimentos/genericas/bebidas.svg',
    'Cuidado personal': 'assets/imagenesmedimentos/genericas/cuidado-personal.svg',
    'Bebés': 'assets/imagenesmedimentos/genericas/bebes.svg',
    'Adulto mayor': 'assets/imagenesmedimentos/genericas/adulto-mayor.svg',
    'Otros': 'assets/imagenesmedimentos/genericas/otros.svg',
  };

  const IMAGENES_MEDICAMENTOS_REGLAS = [
    { re: /enalapril/i, img: 'assets/imagenesmedimentos/enalapril20mg.jpg' },
    { re: /losartan/i, img: 'assets/imagenesmedimentos/losartan50mg.png' },
    { re: /acetaminofen/i, img: 'assets/imagenesmedimentos/Acetaminofen500mg.png' },
    { re: /aspirina|cardioaspirina/i, img: 'assets/imagenesmedimentos/aspirina500mg.png' },
    { re: /dolex/i, img: 'assets/imagenesmedimentos/dolex.jpg' },
    { re: /hioscina|dipirona|buscapina/i, img: 'assets/imagenesmedimentos/buscapnacompositum.jpg' },
    { re: /amoxicilina|amoxidal/i, img: 'assets/imagenesmedimentos/amoxicilina500mg.jpg' },
    { re: /cefalexina/i, img: 'assets/imagenesmedimentos/cefalexina500mg.png' },
    { re: /advil/i, img: 'assets/imagenesmedimentos/advil.jpg' },
    { re: /noxpirin/i, img: 'assets/imagenesmedimentos/nospirina.jpg' },
    { re: /loratadina/i, img: 'assets/imagenesmedimentos/loratadina10mg.png' },
    { re: /diclofenaco|dormex/i, img: 'assets/imagenesmedimentos/diclofenacogel.png' },
    { re: /ibuprofeno/i, img: 'assets/imagenesmedimentos/Ibuprofeno800mg.png' },
    { re: /naproxeno/i, img: 'assets/imagenesmedimentos/naproxeno500mg.png' },
    { re: /similac/i, img: 'assets/imagenesmedimentos/similac1.jpg' },
    { re: /enfamil/i, img: 'assets/imagenesmedimentos/enfamilpremium.jpg' },
    { re: /pa[ñn]al|huggies/i, img: 'assets/imagenesmedimentos/pañaleshuggies.jpg' },
    { re: /winny/i, img: 'assets/imagenesmedimentos/pañaleswinny.jpg' },
    { re: /electrolit/i, img: 'assets/imagenesmedimentos/electrolit.png' },
    { re: /pedialyte/i, img: 'assets/imagenesmedimentos/pedialyte.png' },
    { re: /omeprazol/i, img: 'assets/imagenesmedimentos/omeprazol.png' },
    { re: /diosmectita/i, img: 'assets/imagenesmedimentos/diosmectita.png' },
    { re: /salbutamol/i, img: 'assets/imagenesmedimentos/salbutamol100mcg.png' },
    { re: /colgate/i, img: 'assets/imagenesmedimentos/colgatetripleaccion.jpg' },
    { re: /hidrocortisona/i, img: 'assets/imagenesmedimentos/hidrocortisonacrema.png' },
    { re: /ketoconazol/i, img: 'assets/imagenesmedimentos/ketoconazolcrema.jpg' },
    { re: /glibenclamida/i, img: 'assets/imagenesmedimentos/glibenclamida5mg.jpg' },
    { re: /metformina/i, img: 'assets/imagenesmedimentos/metformina850mg.png' },
    { re: /desodorante|gillette/i, img: 'assets/imagenesmedimentos/desoderantegillette82gx2.png' },
    { re: /centrum/i, img: 'assets/imagenesmedimentos/centrum.jpg' },
    { re: /scott/i, img: 'assets/imagenesmedimentos/scott.jpg' },
    { re: /vita\s*c|vitac/i, img: 'assets/imagenesmedimentos/vitac500mg.jpg' },
  ];

  // Índice opcional para forzar una imagen comercial verificada por ID.
  // Prioridad máxima dentro del resolver de catálogo.
  const IMAGENES_COMERCIALES_VERIFICADAS = {
    'prod-00432': 'assets/imagenesmedimentos/losartan50mg.png',
    'prod-00533': 'assets/imagenesmedimentos/loratadina10mg.png',
    'prod-00823': 'assets/imagenesmedimentos/similac1.jpg',
    'prod-00175': 'assets/imagenesmedimentos/desoderantegillette82gx2.png',
    'prod-00529': 'assets/imagenesmedimentos/buscapnacompositum.jpg',
    'prod-00712': 'assets/imagenesmedimentos/desoderantegillette82gx2.png',
};

  function normalizarCategoria(cat) {
    if (!cat) return cat;
    const clave = normalizarTextoBase(cat).replace(/\s+/g, ' ');
    return CATEGORIA_ALIAS[clave] || cat;
  }

  function normalizarRutaImagen(ruta) {
    if (!ruta) return ruta;
    const rutaNormalizada = String(ruta)
      .replace(/^magenesmedimentos\//i, 'assets/imagenesmedimentos/')
      .trim();

    // Ruta legacy que no existe en este proyecto: usar placeholder remoto.
    if (/^assets\/img\/productos\/default\.png$/i.test(rutaNormalizada)) {
      return PRODUCT_IMAGE_FALLBACK_URL;
    }

    // Si quedó una URL de placeholder remoto en cache/JSON, convertirla a
    // placeholder local para que no dependa de internet ni de terceros.
    if (/^https?:\/\/via\.placeholder\.com\//i.test(rutaNormalizada)) {
      return PRODUCT_IMAGE_FALLBACK_URL;
    }

    return rutaNormalizada;
  }

  function agregarVersionImagenSiEsLocal(ruta) {
    if (!ruta) return ruta;
    const texto = String(ruta).trim();
    if (!/^imagenesmedimentos\//i.test(texto)) return texto;
    const sep = texto.includes('?') ? '&' : '?';
    return `${texto}${sep}v=${IMAGE_CACHE_BUSTER}`;
  }

  function esPlaceholderRemotoFarmaGo(ruta) {
    if (!ruta) return false;
    return /^https?:\/\/placehold\.co\//i.test(String(ruta).trim());
  }

  function esImagenGenericaLocal(ruta) {
    if (!ruta) return false;
    const texto = String(ruta).trim().toLowerCase();
    return /^imagenesmedimentos\/genericas\//.test(texto);
  }

  function imagenGenericaPorCategoria(categoria) {
    const categoriaN = normalizarCategoria(categoria || 'Otros') || 'Otros';
    return CATEGORIA_IMAGENES_GENERICAS[categoriaN] || CATEGORIA_IMAGENES_GENERICAS.Otros;
  }

  function resolverImagenMedicamentoPorTexto(nombre, descripcion) {
    const texto = normalizarTextoBase(`${nombre || ''} ${descripcion || ''}`);
    if (!texto) return null;
    const regla = IMAGENES_MEDICAMENTOS_REGLAS.find(r => r.re.test(texto));
    return regla ? regla.img : null;
  }

  function resolverImagenCatalogoProducto(producto) {
    const categoria = normalizarCategoria(producto && producto.categoria);
    const imagenBase = normalizarRutaImagen(producto && producto.imagen);
    const idProducto = (producto && producto.id ? String(producto.id) : '').trim();
    const imagenComercialVerificada = normalizarRutaImagen(
      idProducto ? IMAGENES_COMERCIALES_VERIFICADAS[idProducto] : ''
    );
    const imagenInferida = resolverImagenMedicamentoPorTexto(
      producto && producto.nombre,
      (producto && (producto.presentacion || producto.descripcion)) || ''
    );

    // Prioridad 1: imagen comercial verificada manualmente por ID.
    if (imagenComercialVerificada) {
      return agregarVersionImagenSiEsLocal(imagenComercialVerificada);
    }

    // Si ya trae una imagen específica (no genérica), se respeta tal cual.
    if (imagenBase && imagenBase !== PRODUCT_IMAGE_FALLBACK_URL && !esPlaceholderRemotoFarmaGo(imagenBase) && !esImagenGenericaLocal(imagenBase)) {
      return agregarVersionImagenSiEsLocal(imagenBase);
    }

    // Si la imagen base es genérica, intentamos primero una imagen concreta.
    if (imagenInferida) return agregarVersionImagenSiEsLocal(imagenInferida);
    const imagenCategoria = agregarVersionImagenSiEsLocal(imagenGenericaPorCategoria(categoria));
    if (imagenCategoria) return imagenCategoria;
    return CATEGORIA_IMAGENES[categoria] || imagenGenericaFallback();
  }

  function renderTabs() {
    const categoriasConProductos = CATEGORIAS.filter(cat => productos.some(p => p.categoria === cat));
    const tabsEl = document.getElementById('categoryTabs');
    tabsEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.textContent = 'Todas';
    allBtn.dataset.cat = 'todas';
    tabsEl.appendChild(allBtn);

    categoriasConProductos.forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.dataset.cat = cat;
      tabsEl.appendChild(btn);
    });

    tabsEl.querySelectorAll('button').forEach(btn => {
      btn.className = 'shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition ' +
        (!subcategoriaActiva && btn.dataset.cat === categoriaActiva
          ? 'bg-orange text-white border-orange'
          : 'bg-white text-ink/70 border-ink/15 hover:border-orange/50');
      btn.addEventListener('click', () => {
        subcategoriaActiva = null;
        categoriaActiva = btn.dataset.cat;
        productosVisibles = PRODUCTOS_POR_PAGINA;
        renderTabs();
        renderProducts();
      });
    });
  }

  function jumpToCategory(cat) {
    subcategoriaActiva = null;
    categoriaActiva = cat === 'todas' ? 'todas' : normalizarCategoria(cat);
    productosVisibles = PRODUCTOS_POR_PAGINA;
    renderTabs();
    renderProducts();
  }

  // ===== Buscador interno de "Arma tu pedido" =====
  // Comparte el mismo estado (`busqueda` + `categoriaActiva`) que los botones
  // de categoría, de modo que ambos filtros se aplican combinados.
  (function initCatalogoSearch() {
    const input = document.getElementById('catalogoSearch');
    const clearBtn = document.getElementById('catalogoSearchClear');
    if (!input) return;

    function filtrarProductosArmaTuPedido() {
      subcategoriaActiva = null;
      busqueda = input.value.trim().toLowerCase();
      productosVisibles = PRODUCTOS_POR_PAGINA;
      if (clearBtn) clearBtn.classList.toggle('hidden', !input.value);
      renderProducts();
    }

    // `input` cubre teclado, pegar y la "x" nativa del type=search
    input.addEventListener('input', filtrarProductosArmaTuPedido);
    input.addEventListener('search', filtrarProductosArmaTuPedido);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; filtrarProductosArmaTuPedido(); }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        filtrarProductosArmaTuPedido();
        input.focus();
      });
    }

    // Si el buscador del header manda texto al catálogo, se refleja aquí
    document.addEventListener('farmago:busqueda', (e) => {
      input.value = e.detail || '';
      if (clearBtn) clearBtn.classList.toggle('hidden', !input.value);
    });
  })();

  document.querySelectorAll('[data-jump-cat]').forEach(link => {
    link.addEventListener('click', () => jumpToCategory(link.dataset.jumpCat));
  });

  function renderSearchResults(resultsEl, rawQuery, onVerTodos) {
    const query = rawQuery.trim();
    if (!query) {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
      return;
    }
    const q = query.toLowerCase();
    const todosMatches = productos.filter(p => p.nombre.toLowerCase().includes(q));
    const matches = todosMatches.slice(0, 6);
    const waveSvg = `<svg class="search-drop-wave" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,13 C70,24 140,2 200,11 C260,20 330,4 400,14 L400,24 L0,24 Z"></path>
      </svg>`;

    if (matches.length === 0) {
      resultsEl.innerHTML = `
        <div class="search-drop-header">
          ${waveSvg}
          <span class="search-drop-title">Sin resultados para "${escapeHTML(query)}"</span>
        </div>
        <p class="text-sm text-ink/50 px-4 py-4 text-center">Escríbenos por WhatsApp y te ayudamos.</p>`;
      resultsEl.classList.remove('hidden');
      return;
    }

    // Miniatura: se usa la foto real del producto. Si el archivo no carga
    // (o el producto no tiene imagen), se muestra el ícono de categoría.
    const filas = matches.map(p => {
      const precioTxt = p.precio ? `$${Number(p.precio).toLocaleString('es-CO')}` : 'Precio a confirmar';
      const iconoFallback = escapeHTML(p.icono || CATEGORIA_ICONOS[p.categoria] || 'fa-solid fa-box');
      const imagenRespaldo = escapeHTML(imagenGenericaPorCategoria(p.categoria));
      const nombreSeguro = escapeHTML(p.nombre);
      const miniatura = p.imagen
        ? `<img src="${escapeHTML(p.imagen)}" alt="${nombreSeguro}" loading="lazy"
               class="search-thumb w-full h-full object-contain p-1"
               onerror="this.onerror=null;this.src='${imagenRespaldo}';" />`
        : `<span class="search-thumb-fallback w-full h-full flex items-center justify-center text-sm">
             <i class="${iconoFallback}"></i>
           </span>`;
      return `
        <div class="search-drop-row flex items-center gap-3 px-4 py-3" data-nombre-jump="${nombreSeguro}" role="button" tabindex="0">
          <span class="search-thumb-wrap w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">${miniatura}</span>
          <div class="min-w-0 flex-1">
            <p class="search-drop-nombre truncate">${nombreSeguro}</p>
            <p class="search-drop-cat truncate">${escapeHTML(p.categoria)}</p>
          </div>
          <span class="search-drop-precio shrink-0">${precioTxt}</span>
          <button type="button" data-add-nombre="${nombreSeguro}" class="search-drop-add shrink-0 inline-flex items-center justify-center rounded-full transition" aria-label="Añadir ${nombreSeguro} al carrito">
            <i class="fa-solid fa-cart-plus"></i>
          </button>
        </div>`;
    }).join('');

    resultsEl.innerHTML = `
      <div class="search-drop-header">
        ${waveSvg}
        <span class="search-drop-title">${todosMatches.length} resultado${todosMatches.length === 1 ? '' : 's'} para "${escapeHTML(query)}"</span>
        <button type="button" class="search-drop-vertodos">Ver todos <i class="fa-solid fa-arrow-right text-[10px]"></i></button>
      </div>
      <div class="search-drop-list">${filas}</div>`;

    resultsEl.querySelectorAll('[data-add-nombre]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        volarAlCarrito(btn);
        cambiarCantidad(btn.dataset.addNombre, 'inc');
      });
    });
    // Clic en la fila (fuera del botón de añadir): lleva directo a ese
    // producto dentro del catálogo y lo resalta un instante.
    resultsEl.querySelectorAll('[data-nombre-jump]').forEach(row => {
      const ir = () => { resultsEl.classList.add('hidden'); irAProducto(row.dataset.nombreJump); };
      row.addEventListener('click', ir);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
    });
    const verTodosBtn = resultsEl.querySelector('.search-drop-vertodos');
    if (verTodosBtn && onVerTodos) verTodosBtn.addEventListener('click', onVerTodos);

    resultsEl.classList.remove('hidden');
  }

  // Salta al catálogo mostrando (filtrado) un único producto y lo resalta
  // con un pulso breve, para que la sugerencia del buscador lleve "directo
  // al producto" en vez de solo cerrar el dropdown.
  function irAProducto(nombre) {
    subcategoriaActiva = null;
    categoriaActiva = 'todas';
    busqueda = nombre;
    productosVisibles = PRODUCTOS_POR_PAGINA;
    document.dispatchEvent(new CustomEvent('farmago:busqueda', { detail: nombre }));
    renderTabs();
    renderProducts();
    const catalogoEl = document.getElementById('catalogo');
    if (catalogoEl) catalogoEl.scrollIntoView({ behavior: 'smooth' });
    requestAnimationFrame(() => {
      const card = document.querySelector(`#productList [data-producto="${CSS.escape(nombre)}"]`);
      if (card) {
        card.classList.add('product-jump-highlight');
        setTimeout(() => card.classList.remove('product-jump-highlight'), 1800);
      }
    });
  }

  function wireHeaderSearch(inputId, btnId, resultsId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    const resultsEl = resultsId ? document.getElementById(resultsId) : null;
    if (!input) return;

    const doFullSearch = () => {
      subcategoriaActiva = null;
      busqueda = input.value.trim().toLowerCase();
      categoriaActiva = 'todas';
      productosVisibles = PRODUCTOS_POR_PAGINA;
      // Avisa al buscador interno del catálogo para que muestre el mismo texto
      document.dispatchEvent(new CustomEvent('farmago:busqueda', { detail: input.value.trim() }));
      renderTabs();
      renderProducts();
      if (resultsEl) resultsEl.classList.add('hidden');
      document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFullSearch(); });
    if (btn) btn.addEventListener('click', doFullSearch);

    if (resultsEl) {
      input.addEventListener('input', () => renderSearchResults(resultsEl, input.value, doFullSearch));
      input.addEventListener('focus', () => {
        if (input.value.trim()) renderSearchResults(resultsEl, input.value, doFullSearch);
      });
      document.addEventListener('click', (e) => {
        if (e.target !== input && !resultsEl.contains(e.target)) {
          resultsEl.classList.add('hidden');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') resultsEl.classList.add('hidden');
      });
    }
  }
  wireHeaderSearch('headerSearch', 'headerSearchBtn', 'searchResultsDesktop');
  wireHeaderSearch('headerSearchMobile', 'headerSearchBtnMobile', 'searchResultsMobile');

  // ===== Mega Menú de Categorías (2 columnas: lista + panel de 3 sub-columnas) =====
  // Categorías de navegación curadas para el menú (distintas de las categorías
  // exactas de inventario usadas para filtrar el catálogo). Cada subcategoría
  // enlaza a la categoría real más cercana disponible en `productos`; cuando
  // no existe una categoría tan específica en el inventario todavía, cae a
  // 'todas' para no dejar nunca un clic sin efecto.
  // Cada subcategoría filtra el catálogo real: "cats" son valores exactos
  // del campo productos.categoria (la reclasificación de 24 categorías),
  // y "kw" es un patrón que se busca en nombre+descripcion (sin acentos,
  // insensible a mayúsculas) para acotar dentro de esas categorías.
  // "catsTodas" (por categoría principal) es la unión de las categorías
  // reales de sus subcategorías, usada por el botón "Ver todo en X".
  // Auditado contra productos.json el 2026-08-21: se eliminaron 6
  // subcategorías sin ningún producto real detrás (Suplementos
  // Deportivos, Higiene de Manos, Movilidad y Soporte, Cuidado Postural,
  // Fiebre y Malestar General, Sales de Rehidratación — las últimas dos
  // por ser redundantes con una subcategoría hermana, no por falta de
  // productos).
  const MEGA_MENU = [
    {
      key: 'ofertas', label: 'Ofertas', icono: 'fa-solid fa-tags', jump: 'todas',
      tint: { bg: 'rgba(255, 106, 61, 0.22)', fg: '#FF9A6B', panelBg: '#FFE3D6', panelFg: '#FF6A3D' },
      promo: {
        titulo: 'Precios rebajados de la semana',
        texto: 'Los mejores precios en los productos más pedidos de la droguería, actualizados constantemente.',
      },
    },
    {
      key: 'medicamentos', label: 'Medicamentos', icono: 'fa-solid fa-pills',
      tint: { bg: 'rgba(59, 130, 246, 0.22)', fg: '#93C5FD', panelBg: '#DBEAFE', panelFg: '#2563EB' },
      catsTodas: ['Analgésicos y antiinflamatorios', 'Antigripales y tos', 'Antibióticos', 'Gastrointestinal', 'Alergias y antihistamínicos', 'Insumos y curación médica'],
      columnas: [
        [
          { label: 'Alivio del Dolor', cats: ['Analgésicos y antiinflamatorios'], kw: null },
          { label: 'Antiinflamatorios', cats: ['Analgésicos y antiinflamatorios'], kw: /inflamat|ibuprofen|naproxeno|diclofenaco|ketoprofeno/i },
          { label: 'Gripa y Tos', cats: ['Antigripales y tos'], kw: null },
        ],
        [
          { label: 'Sistema Respiratorio', cats: ['Antigripales y tos'], kw: /vaporub|bronqui|inhalador|expectorante|salbutamol|respirator|eclosynt|sacrusyt/i },
          { label: 'Antibióticos', cats: ['Antibióticos'], kw: null },
          { label: 'Salud Digestiva', cats: ['Gastrointestinal'], kw: null },
        ],
        [
          { label: 'Antialérgicos', cats: ['Alergias y antihistamínicos'], kw: null },
          { label: 'Primeros Auxilios', cats: ['Insumos y curación médica'], kw: /algodon|gasa|venda|esparadrapo|alcohol|guante|jeringa|cateter|termometro|tapabocas|micropore|aposito|gotero|cura|bajalengua/i },
        ],
      ],
    },
    {
      key: 'vitaminas', label: 'Vitaminas', icono: 'fa-solid fa-capsules',
      tint: { bg: 'rgba(251, 191, 36, 0.22)', fg: '#FCD34D', panelBg: '#FEF3C7', panelFg: '#D97706' },
      catsTodas: ['Vitaminas y suplementos'],
      columnas: [
        [
          { label: 'Vitamina C', cats: ['Vitaminas y suplementos'], kw: /vitamina c\b|vit\.? c\b|redoxon|cebion/i },
          { label: 'Multivitamínicos', cats: ['Vitaminas y suplementos'], kw: /multivitamin|multi ?vita|centrum|bion 3/i },
          { label: 'Vitamina D', cats: ['Vitaminas y suplementos'], kw: /vitamina d\b|vit\.? d\b|\bd3\b|caltrate/i },
        ],
        [
          { label: 'Complejo B', cats: ['Vitaminas y suplementos'], kw: /complejo b|neurobion|bedoyecta|tiamina|fosfogen|activit b|multicomplex|neuro ?bion|neuro 15/i },
          { label: 'Calcio y Huesos', cats: ['Vitaminas y suplementos'], kw: /calcio|caltrate|calfafem|hueso|osteo/i },
          { label: 'Hierro y Energía', cats: ['Vitaminas y suplementos'], kw: /hierro|ferroso|anemidox|vitafer/i },
        ],
        [
          { label: 'Omega 3', cats: ['Vitaminas y suplementos'], kw: /omega/i },
          { label: 'Defensas e Inmunidad', cats: ['Vitaminas y suplementos'], kw: /defensas|inmun|bion 3|equinacea|\bzinc\b/i },
        ],
      ],
    },
    {
      key: 'bebidas', label: 'Bebidas', icono: 'fa-solid fa-bottle-water',
      tint: { bg: 'rgba(34, 211, 238, 0.22)', fg: '#67E8F9', panelBg: '#CFFAFE', panelFg: '#0E7490' },
      catsTodas: ['Snacks y bebidas'],
      columnas: [
        [
          { label: 'Sueros e Hidratación', cats: ['Snacks y bebidas'], kw: /suero|electrolit|hidrat|pedialyte/i },
          { label: 'Agua y Minerales', cats: ['Snacks y bebidas'], kw: /\bagua\b|mineral/i },
        ],
        [
          { label: 'Bebidas Energizantes', cats: ['Snacks y bebidas'], kw: /energy|amper|red bull|vive 100|mega max/i },
          { label: 'Jugos y Nutrición', cats: ['Snacks y bebidas'], kw: /jugo|glucerna|ensure|nutricion|boost|nutren/i },
        ],
        [
          { label: 'Bebidas para Niños', cats: ['Snacks y bebidas'], kw: /jugo hit|ni[ñn]o|infantil|kids/i },
        ],
      ],
    },
    {
      key: 'cuidado-personal', label: 'Cuidado Personal', icono: 'fa-solid fa-pump-soap',
      tint: { bg: 'rgba(244, 114, 182, 0.22)', fg: '#F9A8D4', panelBg: '#FCE7F3', panelFg: '#DB2777' },
      catsTodas: ['Cuidado personal', 'Insumos y curación médica', 'Dermatológico y piel', 'Maquillaje y cuidado facial/labial'],
      columnas: [
        [
          { label: 'Jabones y Geles', cats: ['Cuidado personal'], kw: /jabon|gel de ducha|gelilab/i },
          { label: 'Antisépticos', cats: ['Cuidado personal', 'Insumos y curación médica', 'Dermatológico y piel'], kw: /alcohol|isodine|yodopovil|clorhexidina|antisept/i },
        ],
        [
          { label: 'Cremas Corporales', cats: ['Cuidado personal'], kw: /nivea.*(milk|soft)|lubriderm|bio oil|locion corporal|crema corporal/i },
          { label: 'Cuidado Facial', cats: ['Cuidado personal', 'Maquillaje y cuidado facial/labial', 'Dermatológico y piel'], kw: /ponds|nude solar|agua micelar|acid mantle|lubriderm|bloqueador|nutribela|facial|hidrahialuronico|sundark/i },
        ],
        [
          { label: 'Desodorantes', cats: ['Cuidado personal'], kw: /desodorante|antitranspirante/i },
        ],
      ],
    },
    {
      key: 'bebes', label: 'Bebés', icono: 'fa-solid fa-baby',
      tint: { bg: 'rgba(52, 211, 153, 0.22)', fg: '#6EE7B7', panelBg: '#D1FAE5', panelFg: '#059669' },
      catsTodas: ['Pañales y protección', 'Bebés y maternidad', 'Cuidado personal', 'Dermatológico y piel'],
      columnas: [
        [
          { label: 'Pañales', cats: ['Pañales y protección', 'Bebés y maternidad'], kw: /pa[ñn]al/i },
          { label: 'Toallitas Húmedas', cats: ['Bebés y maternidad', 'Cuidado personal'], kw: /pa[ñn]itos|toallita/i },
        ],
        [
          { label: 'Fórmulas y Nutrición Infantil', cats: ['Bebés y maternidad'], kw: /formula|similac|leche klim|nestum|pediasure|surelab child/i },
          { label: 'Higiene del Bebé', cats: ['Bebés y maternidad', 'Dermatológico y piel'], kw: /pa[ñn]itos|talco.*bebe|bebe.*talco|johnson/i },
        ],
        [
          { label: 'Chupos y Accesorios', cats: ['Bebés y maternidad'], kw: /chupo|biberon|tetero/i },
          { label: 'Cuidado de la Piel del Bebé', cats: ['Bebés y maternidad', 'Dermatológico y piel', 'Cuidado personal'], kw: /talco|acid mantle baby|crema.*bebe|arrurru/i },
        ],
      ],
    },
    {
      key: 'adulto-mayor', label: 'Adulto Mayor', icono: 'fa-solid fa-person-walking-with-cane',
      tint: { bg: 'rgba(167, 139, 250, 0.22)', fg: '#C4B5FD', panelBg: '#EDE9FE', panelFg: '#7C3AED' },
      catsTodas: ['Cardiovascular y metabólico', 'Pruebas y diagnóstico', 'Pañales y protección', 'Cuidado personal', 'Vitaminas y suplementos'],
      columnas: [
        [
          { label: 'Control de Presión', cats: ['Cardiovascular y metabólico'], kw: /losartan|amlodipino|enalapril|valsartan|captopril|hidroclorotiazida|espironolactona|nifedipino|presion|hipertens|tensofar/i },
          { label: 'Glucómetros y Diabetes', cats: ['Cardiovascular y metabólico', 'Pruebas y diagnóstico'], kw: /glucofage|metformina|glucometr|diabet|glucosa/i },
        ],
        [
          { label: 'Pañales para Adultos', cats: ['Pañales y protección', 'Cuidado personal'], kw: /tena|adult/i },
          { label: 'Suplementos para Mayores', cats: ['Vitaminas y suplementos'], kw: /centrum silver|geriatr|senior|\+50/i },
        ],
      ],
    },
  ];

  // Tarjetas de categoría de "Destacados" (.cat-card, data-mega-key): cada
  // una agrupa varias categorías reales del catálogo, igual que el botón
  // "Ver todo en X" del menú de categorías (reutiliza item.catsTodas, ya
  // auditado contra productos.json), en vez de una sola categoría exacta
  // que casi nunca coincide con el nombre real de los datos.
  document.querySelectorAll('[data-mega-key]').forEach(el => {
    el.addEventListener('click', () => {
      const item = MEGA_MENU.find(m => m.key === el.dataset.megaKey);
      if (!item) return;
      if (item.catsTodas) {
        jumpToSubcategoria({ cats: item.catsTodas, kw: null, label: item.label });
      } else if (item.jump) {
        jumpToCategory(item.jump);
      }
    });
  });

  function buildCategoriesDropdown() {
    const listEl = document.getElementById('categoriesMenuList');
    const panelEl = document.getElementById('categoriesMenuPanel');
    const dropdown = document.getElementById('categoriesMenuDropdown');
    if (!listEl || !panelEl || !dropdown) return;

    function cerrarMenu() {
      dropdown.classList.add('opacity-0', 'scale-[0.98]');
      setTimeout(() => dropdown.classList.add('hidden'), 200);
    }

    function renderPanel(item) {
      // "Ofertas" no tiene sub-columnas: se muestra un bloque promocional.
      if (item.promo) {
        panelEl.innerHTML = `
          <div class="flex items-center mb-4">
            <h3 class="font-display text-lg megamenu-panel-title">${escapeHTML(item.label)}</h3>
          </div>
          <p class="text-sm megamenu-panel-desc mb-5 max-w-sm">${escapeHTML(item.promo.texto)}</p>
          <button type="button" data-role="todas" class="megamenu-cta inline-flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition">
            ${escapeHTML(item.promo.titulo)} <i class="fa-solid fa-arrow-right text-xs"></i>
          </button>`;
        const btnTodas = panelEl.querySelector('[data-role="todas"]');
        if (btnTodas) {
          btnTodas.addEventListener('click', () => {
            jumpToCategory(item.jump);
            cerrarMenu();
          });
        }
        return;
      }

      // data-col/data-idx apuntan de vuelta a item.columnas[col][idx] para
      // recuperar el filtro real (cats/kw) sin tener que serializar un
      // RegExp en un atributo HTML.
      const columnasHtml = item.columnas.map((columna, ci) => `
        <div class="space-y-1">
          ${columna.map((sub, si) => `
            <button type="button" data-col="${ci}" data-idx="${si}" class="megamenu-sublink w-full flex items-center gap-2 text-left text-sm transition py-1.5 group">
              <i class="fa-solid fa-chevron-right text-[9px] megamenu-sublink-chevron transition"></i>
              <span class="truncate">${escapeHTML(sub.label)}</span>
            </button>
          `).join('')}
        </div>
      `).join('');

      panelEl.innerHTML = `
        <div class="flex items-center mb-5">
          <h3 class="font-display text-lg megamenu-panel-title">${escapeHTML(item.label)}</h3>
        </div>
        <div class="grid grid-cols-3 gap-6 mb-5">${columnasHtml}</div>
        <button type="button" data-role="vertodo" class="megamenu-cta inline-flex items-center gap-2 text-white font-semibold text-sm px-5 py-2.5 rounded-full transition">Ver todo en ${escapeHTML(item.label)} <i class="fa-solid fa-arrow-right text-xs"></i></button>`;

      panelEl.querySelectorAll('[data-col]').forEach(btn => {
        const sub = item.columnas[Number(btn.dataset.col)][Number(btn.dataset.idx)];
        btn.addEventListener('click', () => {
          jumpToSubcategoria({ cats: sub.cats, kw: sub.kw, label: sub.label });
          cerrarMenu();
        });
      });
      const btnVerTodo = panelEl.querySelector('[data-role="vertodo"]');
      if (btnVerTodo) {
        btnVerTodo.addEventListener('click', () => {
          jumpToSubcategoria({ cats: item.catsTodas, kw: null, label: item.label });
          cerrarMenu();
        });
      }
    }

    let listHTML = '';
    MEGA_MENU.forEach(item => {
      listHTML += `<button type="button" data-key="${item.key}" class="megamenu-item w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-left transition">
        <span class="truncate">${escapeHTML(item.label)}</span>
        <i class="fa-solid fa-chevron-right text-[10px] megamenu-item-chevron shrink-0"></i>
      </button>`;
    });
    listEl.innerHTML = listHTML;

    const buttons = listEl.querySelectorAll('[data-key]');
    function setActive(key) {
      const item = MEGA_MENU.find(m => m.key === key);
      if (!item) return;
      buttons.forEach(b => {
        const isActive = b.dataset.key === key;
        // Resaltado en naranja, el color de acento del resto del sitio
        // (el verde queda reservado para los botones de WhatsApp).
        b.classList.toggle('megamenu-item-active', isActive);
      });
      renderPanel(item);
    }
    buttons.forEach(btn => {
      const item = MEGA_MENU.find(m => m.key === btn.dataset.key);
      const tieneSubmenu = !!(item && item.columnas && item.columnas.length);

      // Con el ratón basta pasar por encima para previsualizar el panel
      btn.addEventListener('mouseenter', () => setActive(btn.dataset.key));
      // Con teclado, el foco hace lo mismo (accesibilidad)
      btn.addEventListener('focus', () => setActive(btn.dataset.key));

      btn.addEventListener('click', () => {
        // Si la categoría tiene subcategorías, el clic DESPLIEGA el panel en
        // vez de saltar y cerrar. Antes se cerraba el menú de inmediato, así
        // que el submenú era imposible de ver (y en móvil, inalcanzable,
        // porque en pantallas táctiles no existe `mouseenter`).
        if (tieneSubmenu) {
          setActive(btn.dataset.key);
          if (panelEl) panelEl.scrollTop = 0;
          return;
        }
        jumpToCategory(item.jump);
        cerrarMenu();
      });
    });
    setActive(MEGA_MENU[0].key);
  }

  const categoriesMenuBtn = document.getElementById('categoriesMenuBtn');
  const categoriesMenuDropdown = document.getElementById('categoriesMenuDropdown');
  if (categoriesMenuBtn && categoriesMenuDropdown) {
    categoriesMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estaOculto = categoriesMenuDropdown.classList.contains('hidden');
      if (estaOculto) {
        categoriesMenuDropdown.classList.remove('hidden');
        // Se fuerza un reflow antes de quitar las clases de "oculto" para
        // que la transición de opacidad/escala sí se anime (toggle suave).
        void categoriesMenuDropdown.offsetHeight;
        categoriesMenuDropdown.classList.remove('opacity-0', 'scale-[0.98]');
      } else {
        categoriesMenuDropdown.classList.add('opacity-0', 'scale-[0.98]');
        setTimeout(() => categoriesMenuDropdown.classList.add('hidden'), 200);
      }
    });
    document.addEventListener('click', (e) => {
      if (categoriesMenuDropdown.classList.contains('hidden')) return;
      if (!categoriesMenuDropdown.contains(e.target) && !categoriesMenuBtn.contains(e.target)) {
        categoriesMenuDropdown.classList.add('opacity-0', 'scale-[0.98]');
        setTimeout(() => categoriesMenuDropdown.classList.add('hidden'), 200);
      }
    });
  }

  function renderProducts() {
    // Filtro combinado: si hay una subcategoría del mega-menú activa, manda
    // sobre categoriaActiva/busqueda. Si no, es el filtro normal de
    // categoría + texto (nombre o marca).
    let list;
    if (subcategoriaActiva) {
      list = productos.filter(p => {
        if (subcategoriaActiva.cats && !subcategoriaActiva.cats.includes(p.categoria)) return false;
        if (subcategoriaActiva.kw) {
          const texto = quitarAcentos(`${p.nombre || ''} ${p.descripcion || p.presentacion || ''}`).toLowerCase();
          if (!subcategoriaActiva.kw.test(texto)) return false;
        }
        return true;
      });
    } else {
      list = categoriaActiva === 'todas' ? productos : productos.filter(p => p.categoria === categoriaActiva);
      if (busqueda) {
        const q = busqueda.toLowerCase();
        list = list.filter(p =>
          (p.nombre || '').toLowerCase().includes(q) ||
          (p.fabricante || '').toLowerCase().includes(q)
        );
      }
    }
    const container = document.getElementById('productList');
    const emptyState = document.getElementById('catalogEmptyState');
    const moreWrap = document.getElementById('productListMore');
    const moreBtn = document.getElementById('productListMoreBtn');
    const moreCount = document.getElementById('productListMoreCount');
    container.innerHTML = '';

    // Contador de resultados junto al buscador interno
    const countEl = document.getElementById('catalogoSearchCount');
    if (countEl) {
      if (subcategoriaActiva) {
        countEl.textContent = list.length === 1
          ? `1 producto en "${subcategoriaActiva.label}"`
          : `${list.length} productos en "${subcategoriaActiva.label}"`;
        countEl.classList.remove('hidden');
      } else if (busqueda || categoriaActiva !== 'todas') {
        countEl.textContent = list.length === 1
          ? '1 producto encontrado'
          : `${list.length} productos encontrados`;
        countEl.classList.remove('hidden');
      } else {
        countEl.classList.add('hidden');
      }
    }

    if (list.length === 0) {
      if (emptyState) {
        emptyState.textContent = subcategoriaActiva
          ? `No encontramos productos en "${subcategoriaActiva.label}" por ahora. Escríbenos por WhatsApp y te ayudamos igual.`
          : busqueda
            ? `No encontramos productos que coincidan con tu búsqueda.`
            : 'No hay productos disponibles en esta categoría por ahora. Escríbenos por WhatsApp y te ayudamos igual.';
        emptyState.classList.remove('hidden');
      }
      if (moreWrap) moreWrap.classList.add('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    // Carga progresiva: solo se renderiza un lote (PRODUCTOS_POR_PAGINA) del
    // total filtrado; el botón "Ver más productos" amplía productosVisibles
    // y vuelve a llamar renderProducts(). Los filtros/búsqueda siempre
    // operan sobre `list` completo (arriba), nunca sobre lo ya renderizado.
    const listVisible = list.slice(0, productosVisibles);

    if (moreWrap && moreBtn) {
      const restantes = list.length - listVisible.length;
      if (restantes > 0) {
        moreWrap.classList.remove('hidden');
        if (moreCount) moreCount.textContent = `Mostrando ${listVisible.length} de ${list.length} productos`;
      } else {
        moreWrap.classList.add('hidden');
      }
    }

    listVisible.forEach(p => {
      const cantidad = carrito[p.nombre] || 0;
      const nombreSeguro = escapeHTML(p.nombre);
      const categoriaSegura = escapeHTML(p.categoria);
      const imagenRespaldo = escapeHTML(imagenGenericaPorCategoria(p.categoria));
      const imagenSegura = p.imagen ? escapeHTML(p.imagen) : '';
      const iconoSeguro = escapeHTML(p.icono || CATEGORIA_ICONOS[p.categoria] || 'fa-solid fa-box');
      const card = document.createElement('div');
      card.className = 'rounded-2xl overflow-hidden flex flex-col transition';
      card.dataset.producto = p.nombre;
      const iconoFallback = `
          <span class="w-16 h-16 rounded-full bg-cloud flex items-center justify-center text-orange text-2xl icon-3d icon-glow" style="${p.imagen ? 'display:none;' : ''}">
            <i class="${iconoSeguro}"></i>
          </span>`;
      const fabricanteSeguro = p.fabricante ? escapeHTML(p.fabricante) : '';
      card.innerHTML = `
        <div class="prod-img-wrap h-64 flex items-center justify-center overflow-hidden">
          ${imagenSegura ? `<img src="${imagenSegura}" alt="${nombreSeguro}" loading="lazy" class="max-w-full max-h-full object-contain" onerror="this.onerror=null;this.src='${imagenRespaldo}';" />` : ''}
          ${iconoFallback}
        </div>
        <div class="p-4 flex flex-col flex-1">
          ${fabricanteSeguro ? `<p class="text-[10px] text-ink/40 uppercase tracking-wide mb-0.5">${fabricanteSeguro}</p>` : ''}
          <p class="font-medium text-sm text-ink mb-1 flex-1">${nombreSeguro}</p>
          <p class="text-[10px] text-blue font-semibold uppercase tracking-wide mb-2">${categoriaSegura}</p>
          ${p.precio ? `<p class="text-orange-dark font-display text-2xl mb-3">$${Number(p.precio).toLocaleString('es-CO')}</p>` : `<p class="text-ink/40 text-xs mb-3">Precio a confirmar por WhatsApp</p>`}
          <div class="flex items-center gap-2" data-acciones="${nombreSeguro}">
            ${renderAccionesProductoHTML(nombreSeguro, cantidad)}
          </div>
        </div>`;
      // Clic en la tarjeta (imagen, nombre, etc.) abre el detalle del
      // producto; los botones de +/- y "Añadir al carrito" (dentro de
      // [data-acciones]) siguen funcionando igual, sin abrir el modal.
      // Usa composedPath() en vez de e.target.closest(): al pasar de
      // cantidad 0→1, actualizarTarjetaProducto reemplaza el innerHTML de
      // [data-acciones] en ese mismo clic, desconectando el botón original
      // del DOM antes de que este handler corra — un closest() sobre un
      // nodo ya huérfano no encuentra el ancestro y "se cuela" el modal.
      // composedPath() queda fijo desde el momento del clic, así que no
      // se ve afectado por esa mutación.
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        const dentroDeAcciones = e.composedPath().some(
          (node) => node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-acciones')
        );
        if (dentroDeAcciones) return;
        abrirDetalleProducto(p);
      });
      container.appendChild(card);
    });

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'open-cart') {
          openCart();
          return;
        }
        if (btn.dataset.action === 'inc') volarAlCarrito(btn);
        cambiarCantidad(btn.dataset.nombre, btn.dataset.action);
      });
    });
  }

  // Botón "Ver más productos": amplía el lote visible sin tocar los
  // filtros activos. Se engancha una sola vez (el botón vive fuera de
  // #productList, así que container.innerHTML='' en renderProducts()
  // nunca lo borra ni duplica el listener).
  (function wireProductListMoreBtn() {
    const btn = document.getElementById('productListMoreBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      productosVisibles += PRODUCTOS_POR_PAGINA;
      renderProducts();
    });
  })();

  // Genera solo el HTML de los botones de acción de una tarjeta (los
  // controles +/- o el botón "Añadir al carrito"), para poder reutilizarlo
  // tanto en el render inicial como en actualizaciones puntuales de una
  // sola tarjeta (sin reconstruir toda la cuadrícula).
  function renderAccionesProductoHTML(nombreSeguro, cantidad) {
    if (cantidad > 0) {
      return `
        <div class="flex items-center gap-2 flex-1">
          <div class="flex items-center gap-2 flex-1 justify-between bg-cloud rounded-full px-3 py-2">
            <button data-action="dec" data-nombre="${nombreSeguro}" class="w-6 h-6 rounded-full bg-white hover:bg-orange hover:text-white text-ink flex items-center justify-center transition"><i class="fa-solid fa-minus text-xs"></i></button>
            <span class="text-sm font-semibold">${cantidad}</span>
            <button data-action="inc" data-nombre="${nombreSeguro}" class="w-6 h-6 rounded-full bg-white hover:bg-orange hover:text-white text-ink flex items-center justify-center transition"><i class="fa-solid fa-plus text-xs"></i></button>
          </div>
          <button data-action="open-cart" class="w-10 h-10 rounded-full bg-blue text-white hover:scale-110 transition flex items-center justify-center shrink-0" title="Ver carrito">
            <i class="fa-solid fa-cart-shopping text-sm"></i>
          </button>
        </div>
      `;
    }
    return `
      <button data-action="inc" data-nombre="${nombreSeguro}" class="w-full inline-flex items-center justify-center gap-2 bg-orange text-white text-sm font-semibold py-2.5 rounded-full hover:bg-orange-dark transition btn-3d btn-3d-orange">
        Añadir al carrito
      </button>
    `;
  }

  // Actualiza únicamente la tarjeta de un producto en la cuadrícula del
  // catálogo (sin tocar el resto de tarjetas). Si la cantidad entra o sale
  // de 0, la estructura de botones cambia, así que reconstruimos solo esa
  // pequeña sección; si no, solo tocamos el número. Esto evita el
  // parpadeo tanto al agregar el primer producto como al subir/bajar.
  function actualizarTarjetaProducto(nombre, cantidadPrevia, nuevaCantidad) {
    const accionesDiv = Array.from(document.querySelectorAll('#productList [data-acciones]'))
      .find(el => el.dataset.acciones === nombre);
    if (!accionesDiv) return;

    if (cantidadPrevia === 0 || nuevaCantidad === 0) {
      const nombreSeguro = escapeHTML(nombre);
      accionesDiv.innerHTML = renderAccionesProductoHTML(nombreSeguro, nuevaCantidad);
      accionesDiv.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.action === 'open-cart') {
            openCart();
            return;
          }
          if (btn.dataset.action === 'inc') volarAlCarrito(btn);
          cambiarCantidad(btn.dataset.nombre, btn.dataset.action);
        });
      });
    } else {
      const botonDec = accionesDiv.querySelector('[data-action="dec"]');
      const span = botonDec ? botonDec.nextElementSibling : null;
      if (span) {
        span.textContent = nuevaCantidad;
        rebotarNumero(span);
      }
    }
  }

  // ===== Bloqueo de scroll del body mientras hay un modal abierto =====
  // Con contador: si dos modales llegaran a solaparse un instante (p.ej.
  // el flujo "cerrar detalle → abrir carrito" de abajo), el scroll solo se
  // restaura cuando el último modal también se cierra, nunca antes.
  let modalesAbiertos = 0;
  function bloquearScrollBody() {
    modalesAbiertos++;
    document.body.style.overflow = 'hidden';
  }
  function restaurarScrollBody() {
    modalesAbiertos = Math.max(0, modalesAbiertos - 1);
    if (modalesAbiertos === 0) document.body.style.overflow = '';
  }

  // ===== Modal de detalle de producto =====
  // Se abre al hacer clic en la tarjeta del catálogo (imagen/nombre, no en
  // los botones de [data-acciones]). Reutiliza renderAccionesProductoHTML
  // para que el selector de cantidad y "Añadir al carrito" se comporten
  // exactamente igual que en la tarjeta.
  function renderProductDetailAcciones(nombre) {
    const cont = document.getElementById('pdAcciones');
    if (!cont) return;
    const cantidad = carrito[nombre] || 0;
    cont.innerHTML = renderAccionesProductoHTML(escapeHTML(nombre), cantidad);
    cont.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        // "Añadir al carrito" (primer clic, cantidad todavía en 0) o el
        // ícono de carrito ya con cantidad>0: en ambos casos el detalle se
        // cierra primero y el carrito abre limpio, sin quedar uno detrás
        // del otro. Los pasos +/- para solo ajustar cantidad (cantidad ya
        // > 0) se quedan dentro del modal de detalle.
        if (btn.dataset.action === 'open-cart') {
          cerrarDetalleProducto();
          openCart();
          return;
        }
        const eraPrimerAgregado = btn.dataset.action === 'inc' && (carrito[btn.dataset.nombre] || 0) === 0;
        if (btn.dataset.action === 'inc') volarAlCarrito(btn);
        cambiarCantidad(btn.dataset.nombre, btn.dataset.action);
        if (eraPrimerAgregado) {
          cerrarDetalleProducto();
          openCart();
          return;
        }
        renderProductDetailAcciones(btn.dataset.nombre);
      });
    });
  }

  function abrirDetalleProducto(p) {
    const overlay = document.getElementById('productDetailOverlay');
    const panel = document.getElementById('productDetailPanel');
    if (!overlay || !panel || !p) return;

    const nombreSeguro = escapeHTML(p.nombre || '');
    const imagenRespaldo = imagenGenericaPorCategoria(p.categoria);

    const imgEl = document.getElementById('pdImg');
    if (p.imagen) {
      imgEl.src = p.imagen;
      imgEl.alt = nombreSeguro;
      imgEl.style.display = '';
      imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = imagenRespaldo; };
    } else if (imagenRespaldo) {
      imgEl.src = imagenRespaldo;
      imgEl.alt = nombreSeguro;
      imgEl.style.display = '';
    } else {
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
    }

    const fabricanteEl = document.getElementById('pdFabricante');
    fabricanteEl.textContent = p.fabricante || '';
    fabricanteEl.classList.toggle('hidden', !p.fabricante);

    document.getElementById('pdNombre').textContent = p.nombre || '';

    const categoriaEl = document.getElementById('pdCategoria');
    categoriaEl.textContent = p.categoria || '';
    categoriaEl.classList.toggle('hidden', !p.categoria);

    // La "descripción" de productos.json suele repetir el nombre tal cual:
    // solo se muestra si realmente aporta información distinta.
    const descEl = document.getElementById('pdDescripcion');
    const tieneDescripcionPropia = p.descripcion &&
      p.descripcion.trim().toLowerCase() !== (p.nombre || '').trim().toLowerCase();
    descEl.textContent = tieneDescripcionPropia ? p.descripcion : '';
    descEl.classList.toggle('hidden', !tieneDescripcionPropia);

    const presEl = document.getElementById('pdPresentacion');
    presEl.textContent = p.presentacion || '';
    presEl.classList.toggle('hidden', !p.presentacion);

    document.getElementById('pdPrecio').textContent = p.precio
      ? `$${Number(p.precio).toLocaleString('es-CO')}`
      : 'Precio a confirmar por WhatsApp';

    renderProductDetailAcciones(p.nombre);

    panel.classList.remove('hidden');
    overlay.classList.remove('hidden');
    bloquearScrollBody();
  }

  function cerrarDetalleProducto() {
    const overlay = document.getElementById('productDetailOverlay');
    const panel = document.getElementById('productDetailPanel');
    if (panel && panel.classList.contains('hidden')) return; // ya cerrado
    if (panel) panel.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
    restaurarScrollBody();
  }

  (function wireProductDetailModal() {
    const overlay = document.getElementById('productDetailOverlay');
    const closeBtn = document.getElementById('closeProductDetailBtn');
    if (overlay) overlay.addEventListener('click', cerrarDetalleProducto);
    if (closeBtn) closeBtn.addEventListener('click', cerrarDetalleProducto);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const panel = document.getElementById('productDetailPanel');
      if (panel && !panel.classList.contains('hidden')) cerrarDetalleProducto();
    });
  })();

  function totalItemsCarrito() {
    return Object.values(carrito).reduce((a, b) => a + b, 0);
  }

  function actualizarBadgesCarrito() {
    const total = totalItemsCarrito();
    const cartCount = document.getElementById('cartCount');
    const cartCountHeader = document.getElementById('cartCountHeader');
    [cartCount, cartCountHeader].forEach(el => {
      if (!el) return;
      if (total > 0) {
        el.textContent = total;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  // ===== Animaciones del carrito =====
  // "Vuelo al carrito": una pastillita naranja sale del botón presionado y
  // vuela hasta el botón flotante del carrito, que late al recibirla.
  function volarAlCarrito(desdeEl) {
    const destino = document.getElementById('cartFab');
    if (!desdeEl || !destino) return;
    const a = desdeEl.getBoundingClientRect();
    const b = destino.getBoundingClientRect();
    if (a.width === 0 || b.width === 0) return; // elementos ocultos: no animar

    const dot = document.createElement('div');
    dot.className = 'fly-dot';
    dot.innerHTML = '<i class="fa-solid fa-pills"></i>';
    dot.style.left = (a.left + a.width / 2 - 17) + 'px';
    dot.style.top = (a.top + a.height / 2 - 17) + 'px';
    document.body.appendChild(dot);

    requestAnimationFrame(() => {
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      dot.style.transform = `translate(${dx}px, ${dy}px) scale(0.25)`;
      dot.style.opacity = '0.15';
    });

    setTimeout(() => {
      dot.remove();
      destino.classList.add('cart-fab-pulse');
      setTimeout(() => destino.classList.remove('cart-fab-pulse'), 500);
    }, 650);
  }

  // Hace "saltar" un número cuando cambia (reiniciando la animación si
  // el usuario hace clics rápidos seguidos).
  function rebotarNumero(el) {
    if (!el) return;
    el.classList.remove('qty-bump');
    void el.offsetWidth; // fuerza reflow para reiniciar la animación
    el.classList.add('qty-bump');
  }

  // ===== Magia interactiva: Lluvia de Salud + dron del encabezado =====
  // "Lluvia de Salud": 2-3 capsulitas SVG caen desde la parte superior del
  // modal con un mini rebote y se desvanecen. Los elementos se autodestruyen
  // al terminar, así que nunca se acumulan en el DOM (rendimiento seguro).
  function lluviaDeSalud() {
    const panel = document.getElementById('cartPanel');
    if (!panel || panel.classList.contains('hidden')) return; // modal cerrado: nada que mostrar

    const cuantas = 2 + Math.floor(Math.random() * 2); // 2 o 3 cápsulas
    for (let i = 0; i < cuantas; i++) {
      const cap = document.createElement('span');
      cap.className = 'salud-particula';
      cap.innerHTML = `
        <svg viewBox="0 0 24 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="1" y="1" width="22" height="10" rx="5" fill="#ff6a1f"/>
          <rect x="1" y="1" width="11" height="10" rx="5" fill="#ffd9bf"/>
          <circle cx="6" cy="4" r="1.2" fill="#ffffff" opacity="0.8"/>
        </svg>`;
      cap.style.left = (12 + Math.random() * 76) + '%';
      cap.style.animationDelay = (i * 130) + 'ms';
      cap.style.animationDuration = (1200 + Math.random() * 400) + 'ms';
      panel.appendChild(cap);
      setTimeout(() => cap.remove(), 2100 + i * 130);
    }
  }

  // Caja de pedido junto al título "Tu pedido": se inyecta una sola vez
  // al cargar (sin tocar el HTML). Flota siempre; da un salto con giro
  // cada vez que aumenta la cantidad de productos.
  (function initDronPedido() {
    const titulo = document.querySelector('.cart-panel-header h3, .cart-hero-titulo h3');
    if (!titulo || document.getElementById('dronPedido')) return;
    const dron = document.createElement('span');
    dron.id = 'dronPedido';
    dron.className = 'dron-pedido';
    dron.innerHTML = `<img src="assets/logospagos/cajapedido.png" alt="" class="caja-pedido-img" onerror="this.parentElement.style.display='none'" />`;
    titulo.appendChild(dron);
  })();

  // Dispara el modo "turbo" del dron: giro de 360° + hélices aceleradas.
  function animarDron() {
    const dron = document.getElementById('dronPedido');
    if (!dron) return;
    dron.classList.remove('dron-turbo');
    void dron.offsetWidth; // reinicia la animación en clics rápidos seguidos
    dron.classList.add('dron-turbo');
    setTimeout(() => dron.classList.remove('dron-turbo'), 750);
  }

  // Cambia una cantidad sin reconstruir toda la cuadrícula ni todo el
  // carrito: solo toca el número en pantalla donde haga falta. Solo se
  // reconstruye por completo cuando el producto entra o sale del carrito
  // (porque ahí sí cambia la estructura de botones que se muestra).
  function cambiarCantidad(nombre, accion) {
    const cantidadPrevia = carrito[nombre] || 0;

    if (accion === 'inc') {
      carrito[nombre] = cantidadPrevia + 1;
    } else {
      carrito[nombre] = Math.max(0, cantidadPrevia - 1);
      if (carrito[nombre] === 0) delete carrito[nombre];
    }

    const nuevaCantidad = carrito[nombre] || 0;

    actualizarBadgesCarrito();
    actualizarTotalPedido();

    // Magia visual al aumentar: lluvia de cápsulas + turbo del dron.
    if (accion === 'inc') {
      lluviaDeSalud();
      animarDron();
    }

    // Actualizar solo la tarjeta de este producto en el catálogo (sin
    // reconstruir toda la cuadrícula, evitando el parpadeo).
    actualizarTarjetaProducto(nombre, cantidadPrevia, nuevaCantidad);

    // Actualizar la fila correspondiente dentro del modal del carrito, si
    // está abierto (o si el usuario lo abre después, ya estará al día).
    const filaBotonDec = Array.from(document.querySelectorAll('#cartItems [data-action="dec"]'))
      .find(b => b.dataset.nombre === nombre);

    if (nuevaCantidad === 0) {
      if (filaBotonDec) {
        const fila = filaBotonDec.closest('.cart-ficha');
        if (fila) {
          // Salida animada: la ficha se desliza y encoge antes de eliminarse.
          fila.classList.add('cart-row-exit');
          setTimeout(() => {
            fila.remove();
            if (Object.keys(carrito).length === 0) {
              const emptyMsg = document.getElementById('cartEmptyMsg');
              if (emptyMsg) emptyMsg.classList.remove('hidden');
            }
          }, 240);
        }
      } else if (Object.keys(carrito).length === 0) {
        const emptyMsg = document.getElementById('cartEmptyMsg');
        if (emptyMsg) emptyMsg.classList.remove('hidden');
      }
    } else if (filaBotonDec) {
      const span = filaBotonDec.nextElementSibling;
      if (span) {
        span.textContent = nuevaCantidad;
        rebotarNumero(span);
      }
      // Subtotal en vivo: precio unitario x nueva cantidad.
      const ficha = filaBotonDec.closest('.cart-ficha');
      const subtotalEl = ficha ? ficha.querySelector('[data-subtotal]') : null;
      if (subtotalEl) {
        const prod = productos.find(x => x.nombre === nombre);
        if (prod && prod.precio) {
          subtotalEl.textContent = '$' + Number(prod.precio * nuevaCantidad).toLocaleString('es-CO');
          rebotarNumero(subtotalEl);
        }
      }
    }
  }

  // Construye la ficha completa de un producto dentro del modal: foto,
  // marca, presentación, precio unitario, subtotal, selector de cantidad
  // y botón de eliminar. Los datos se buscan por nombre en el catálogo.
  function crearFichaProducto(nombre, cantidad, idx) {
    const p = productos.find(x => x.nombre === nombre) || {};
    const nombreSeguro = escapeHTML(nombre);
    const precio = p.precio || 0;
    const subtotal = precio * cantidad;
    const icono = escapeHTML(p.icono || CATEGORIA_ICONOS[p.categoria] || 'fa-solid fa-box');
    const imagenRespaldo = escapeHTML(imagenGenericaPorCategoria(p.categoria));
    const imagenSegura = p.imagen ? escapeHTML(p.imagen) : '';

    const row = document.createElement('div');
    row.className = 'cart-ficha';
    // Entrada en cascada: cada ficha espera un poquito más que la anterior.
    row.style.animationDelay = `${idx * 60}ms`;
    row.innerHTML = `
      <div class="cart-ficha-img">
        ${imagenSegura
          ? `<img src="${imagenSegura}" alt="${nombreSeguro}" loading="lazy"
               onerror="this.onerror=null;this.src='${imagenRespaldo}';" />
             <span class="cart-ficha-icono" style="display:none;"><i class="${icono}"></i></span>`
          : `<span class="cart-ficha-icono"><i class="${icono}"></i></span>`}
      </div>
      <div class="cart-ficha-info">
        <p class="cart-ficha-nombre">${nombreSeguro}</p>
        ${p.fabricante ? `<p class="cart-ficha-marca">${escapeHTML(p.fabricante)}</p>` : ''}
        ${p.presentacion ? `<p class="cart-ficha-presentacion">${escapeHTML(p.presentacion)}</p>` : ''}
        <p class="cart-ficha-precio">${precio ? '$' + Number(precio).toLocaleString('es-CO') : 'Precio a confirmar'}${precio ? ' <span class="cart-ficha-unidad">c/u</span>' : ''}</p>
        <div class="cart-ficha-controles">
          <div class="cart-ficha-qty">
            <button data-action="dec" data-nombre="${nombreSeguro}">−</button>
            <span>${cantidad}</span>
            <button data-action="inc" data-nombre="${nombreSeguro}">+</button>
          </div>
          <p class="cart-ficha-subtotal">Subtotal <b data-subtotal>${precio ? '$' + Number(subtotal).toLocaleString('es-CO') : '—'}</b></p>
          <button class="cart-ficha-del" data-action="del" data-nombre="${nombreSeguro}" title="Eliminar producto" aria-label="Eliminar ${nombreSeguro}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>`;

    row.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'del') {
          eliminarProducto(btn.dataset.nombre);
          return;
        }
        cambiarCantidad(btn.dataset.nombre, btn.dataset.action);
      });
    });
    return row;
  }

  // Elimina un producto completo del pedido (botón de caneca), con la misma
  // salida animada que cuando la cantidad llega a 0.
  function eliminarProducto(nombre) {
    const cantidadPrevia = carrito[nombre] || 0;
    if (cantidadPrevia === 0) return;
    delete carrito[nombre];

    actualizarBadgesCarrito();
    actualizarTotalPedido();
    actualizarTarjetaProducto(nombre, cantidadPrevia, 0);

    const filaBotonDec = Array.from(document.querySelectorAll('#cartItems [data-action="dec"]'))
      .find(b => b.dataset.nombre === nombre);
    if (filaBotonDec) {
      const fila = filaBotonDec.closest('.cart-ficha');
      if (fila) {
        fila.classList.add('cart-row-exit');
        setTimeout(() => {
          fila.remove();
          if (Object.keys(carrito).length === 0) {
            const emptyMsg = document.getElementById('cartEmptyMsg');
            if (emptyMsg) emptyMsg.classList.remove('hidden');
          }
        }, 240);
      }
    } else if (Object.keys(carrito).length === 0) {
      const emptyMsg = document.getElementById('cartEmptyMsg');
      if (emptyMsg) emptyMsg.classList.remove('hidden');
    }
  }

  // Calcula el gran total acumulado (precio x cantidad de cada producto) y
  // actualiza la caja del total en tiempo real. Se llama en cada +, -,
  // eliminación y al abrir el modal.
  function actualizarTotalPedido() {
    const box = document.getElementById('modalTotalBox');
    if (!box) return;

    const items = Object.entries(carrito);
    const totalItems = items.reduce((sum, [, c]) => sum + c, 0);
    const totalPagar = items.reduce((sum, [nombre, c]) => {
      const prod = productos.find(x => x.nombre === nombre);
      return sum + (prod && prod.precio ? prod.precio * c : 0);
    }, 0);

    // Si no hay productos, la caja se oculta (el estado vacío ya se muestra).
    box.classList.toggle('hidden', items.length === 0);

    const itemsEl = document.getElementById('modalTotalItems');
    const pagarEl = document.getElementById('modalTotalPagar');
    if (itemsEl) {
      itemsEl.textContent = `${totalItems} ${totalItems === 1 ? 'ítem seleccionado' : 'ítems seleccionados'}`;
    }
    if (pagarEl) {
      pagarEl.textContent = '$' + Number(totalPagar).toLocaleString('es-CO');
      rebotarNumero(pagarEl);
    }
  }

  function renderizarCarritoModal() {
    const items = Object.entries(carrito);
    const cartItemsEl = document.getElementById('cartItems');
    const emptyMsg = document.getElementById('cartEmptyMsg');

    actualizarBadgesCarrito();

    cartItemsEl.innerHTML = '';
    if (items.length === 0) {
      emptyMsg.classList.remove('hidden');
      actualizarTotalPedido();
      return;
    }
    emptyMsg.classList.add('hidden');

    items.forEach(([nombre, cantidad], idx) => {
      cartItemsEl.appendChild(crearFichaProducto(nombre, cantidad, idx));
    });

    actualizarTotalPedido();
  }

  // ===== Estado vacío animado del carrito =====
  // Inyecta una sola vez (al cargar la página) el contenido animado dentro
  // de #cartEmptyMsg: un SVG de bolsa de farmacia con flotación infinita y
  // resplandor naranja. Como renderizarCarritoModal() solo muestra/oculta este elemento
  // (nunca borra su contenido), no hace falta volver a inyectarlo.
  (function initEstadoVacioCarrito() {
    const emptyMsg = document.getElementById('cartEmptyMsg');
    if (!emptyMsg) return;
    emptyMsg.innerHTML = `
      <div class="modal-empty-animation">
        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Bolsa de farmacia -->
          <path d="M30 44 L90 44 L84 102 Q83.5 108 77 108 L43 108 Q36.5 108 36 102 Z"
                fill="rgba(255,255,255,0.08)" stroke="#ff6a1f" stroke-width="3" stroke-linejoin="round"/>
          <!-- Asas de la bolsa -->
          <path d="M44 44 Q44 24 60 24 Q76 24 76 44"
                fill="none" stroke="#ff6a1f" stroke-width="3" stroke-linecap="round"/>
          <!-- Cruz de farmacia -->
          <path d="M55 62 L65 62 L65 71 L74 71 L74 81 L65 81 L65 90 L55 90 L55 81 L46 81 L46 71 L55 71 Z"
                fill="#ff6a1f" opacity="0.9"/>
          <!-- Destellos -->
          <circle cx="24" cy="34" r="2.5" fill="#ff6a1f" opacity="0.5"/>
          <circle cx="98" cy="56" r="2" fill="#ff6a1f" opacity="0.4"/>
          <circle cx="92" cy="26" r="3" fill="#ff6a1f" opacity="0.35"/>
        </svg>
        <p class="modal-empty-title">Tu pedido está vacío</p>
        <p class="modal-empty-text">¡Explora nuestro catálogo y llena tu pedido!</p>
      </div>`;
  })();

  const cartFab = document.getElementById('cartFab');
  const cartPanel = document.getElementById('cartPanel');
  const cartOverlay = document.getElementById('cartOverlay');

  // ===== Caja del Gran Total =====
  // Se inserta una sola vez, justo después de la lista de productos y antes
  // del formulario (footer con nombre/observaciones/WhatsApp), sin tocar el
  // HTML. Su contenido lo actualiza actualizarTotalPedido() en tiempo real.
  (function initCajaTotal() {
    if (document.getElementById('modalTotalBox')) return;
    const cartItemsEl = document.getElementById('cartItems');
    const footer = document.querySelector('.cart-panel-footer');
    if (!cartItemsEl) return;
    const box = document.createElement('div');
    box.id = 'modalTotalBox';
    box.className = 'modal-total-box hidden';
    box.innerHTML = `
      <span id="modalTotalItems" class="modal-total-items">0 ítems seleccionados</span>
      <span class="modal-total-right">
        <span class="modal-total-label">TOTAL A PAGAR:</span>
        <b id="modalTotalPagar" class="modal-total-monto">$0</b>
      </span>`;
    // Insertar entre la lista y el formulario. Ambos viven dentro de
    // .cart-panel-scroll, así que la caja queda en medio de forma natural.
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(box, footer);
    } else {
      cartItemsEl.insertAdjacentElement('afterend', box);
    }
  })();

  function openCart() {
    renderizarCarritoModal();
    cartPanel.classList.remove('hidden');
    cartOverlay.classList.remove('hidden');
    bloquearScrollBody();
  }
  function closeCart() {
    if (cartPanel.classList.contains('hidden')) return; // ya cerrado
    cartPanel.classList.add('hidden');
    cartOverlay.classList.add('hidden');
    restaurarScrollBody();
  }
  cartFab.addEventListener('click', openCart);
  const cartFabHeader = document.getElementById('cartFabHeader');
  if (cartFabHeader) cartFabHeader.addEventListener('click', openCart);
  document.getElementById('closeCartBtn').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  // Validación básica de los campos del pedido antes de armar el link de
  // WhatsApp: evita envíos vacíos/demasiado cortos o largos, y descarta
  // caracteres que no corresponden a un nombre o dirección reales. No es
  // "seguridad" en el sentido de sanitizar HTML (el mensaje va a wa.me vía
  // encodeURIComponent, que ya escapa cualquier carácter de forma segura),
  // es sobre todo higiene de datos y una primera barrera contra spam.
  const RE_NOMBRE_VALIDO = /^[\p{L}\p{M}\s.'-]+$/u;
  const RE_DIRECCION_VALIDA = /^[\p{L}\p{M}\p{N}\s.,#\-\/°ºª]+$/u;

  function validarCampoPedido(valor, { minLen, maxLen, patron }) {
    if (valor.length < minLen || valor.length > maxLen) return false;
    if (patron && !patron.test(valor)) return false;
    return true;
  }

  document.getElementById('sendCartBtn').addEventListener('click', () => {
    const items = Object.entries(carrito);
    if (items.length === 0) {
      alert('Agrega al menos un producto antes de enviar tu pedido.');
      return;
    }

    // Honeypot anti-spam: campo oculto que un humano nunca llena. Si trae
    // texto, es casi seguro un bot — se descarta el envío en silencio (sin
    // decirle al bot por qué, para no darle pistas de cómo evadirlo).
    const honeypotEl = document.getElementById('cartWebsite');
    if (honeypotEl && honeypotEl.value.trim() !== '') {
      return;
    }

    const nombreInput = document.getElementById('cartNombre');
    const nombreCliente = nombreInput.value.trim();
    if (!validarCampoPedido(nombreCliente, { minLen: 2, maxLen: 80, patron: RE_NOMBRE_VALIDO })) {
      alert('Por favor escribe tu nombre completo (solo letras y espacios, entre 2 y 80 caracteres).');
      nombreInput.focus();
      return;
    }

    const direccionEl = document.getElementById('cartDireccion');
    const direccion = direccionEl ? direccionEl.value.trim() : '';
    if (!validarCampoPedido(direccion, { minLen: 5, maxLen: 150, patron: RE_DIRECCION_VALIDA })) {
      alert('Por favor escribe una dirección de entrega válida (entre 5 y 150 caracteres).');
      if (direccionEl) direccionEl.focus();
      return;
    }

    const observacionesEl = document.getElementById('cartObservaciones');
    const observaciones = observacionesEl ? observacionesEl.value.trim() : '';
    if (observaciones.length > 300) {
      alert('Las observaciones son demasiado largas (máximo 300 caracteres).');
      observacionesEl.focus();
      return;
    }

    let lineas = [`¡Hola FarmaGo! Quiero hacer este pedido:`, `Nombre: ${nombreCliente}`];
    if (direccion) lineas.push(`Dirección de entrega: ${direccion}`);
    lineas.push('');
    items.forEach(([nombre, cantidad]) => {
      lineas.push(`• ${nombre} x${cantidad}`);
    });
    if (observaciones) {
      lineas.push('');
      lineas.push(`Observaciones: ${observaciones}`);
    }

    const mensaje = encodeURIComponent(lineas.join('\n'));
    window.open(`https://wa.me/573014466722?text=${mensaje}`, '_blank');
  });

  function refreshPublicCatalog() {
    productos = loadInventario()
      .filter(p => p.activo)
      .map(p => {
        const categoria = normalizarCategoria(p.categoria);
        return {
          ...p,
          categoria,
          imagen: resolverImagenCatalogoProducto({ ...p, categoria }),
        };
      });
    subcategoriaActiva = null;
    productosVisibles = PRODUCTOS_POR_PAGINA;
    renderTabs();
    renderProducts();
    renderizarCarritoModal();
    buildCategoriesDropdown();
  }

/* ===== Bloque 3/9 ===== */
(function () {
    const today = new Date().getDay();
    const item = document.querySelector('#scheduleList li[data-day="' + today + '"]');
    if (item) {
      item.classList.add('bg-blue', 'shadow-md');
      item.querySelector('span').classList.add('text-white');
      item.querySelector('b').classList.remove('text-blue');
      item.querySelector('b').classList.add('text-white');
      const badge = document.createElement('span');
      badge.textContent = 'HOY';
      badge.className = 'text-[10px] font-bold bg-white text-blue px-2 py-0.5 rounded-full ml-2';
      item.querySelector('span').appendChild(badge);
    }

    const now = new Date();
    const hour = now.getHours();
    const isOpen = hour >= 8 && hour < 20;
    const banner = document.getElementById('openStatusBanner');
    const statusText = document.getElementById('openStatusText');
    if (!isOpen && banner && statusText) {
      banner.classList.remove('from-orange', 'to-blue');
      banner.classList.add('bg-ink');
      statusText.textContent = 'Cerrado ahora · Abrimos a las 8:00 a.m.';
    }
  })();

/* ===== Bloque 4/9 ===== */
function setNavHeight() {
    const navEl = document.getElementById('mainNav');
    if (navEl) {
      document.documentElement.style.setProperty('--nav-height', navEl.offsetHeight + 'px');
    }
  }
  setNavHeight();
  window.addEventListener('resize', setNavHeight);
  window.addEventListener('load', setNavHeight);

  const nav = document.getElementById('mainNav');
  let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
  let navTicking = false;

  function updateNavOnScroll() {
    if (!nav) return;
    const st = window.pageYOffset || document.documentElement.scrollTop || 0;
    const down = st > lastScrollTop + 4;
    const up = st < lastScrollTop - 4;
    const nearTop = st <= 90;
    const dropdown = document.getElementById('categoriesMenuDropdown');
    const mobileMenuEl = document.getElementById('mobileMenu');
    const dropdownOpen = !!(dropdown && (dropdown.classList.contains('menu-open') || !dropdown.classList.contains('hidden')));
    const mobileOpen = !!(mobileMenuEl && mobileMenuEl.classList.contains('menu-open'));

    if (st > 20) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');

    if (nearTop || up || dropdownOpen || mobileOpen) {
      nav.classList.remove('nav-hidden');
    } else if (down) {
      nav.classList.add('nav-hidden');
    }

    lastScrollTop = Math.max(0, st);
    setNavHeight();
  }

  window.addEventListener('scroll', () => {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(() => {
      updateNavOnScroll();
      navTicking = false;
    });
  }, { passive: true });

  window.addEventListener('wheel', () => {
    updateNavOnScroll();
  }, { passive: true });

  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const honeypot = document.getElementById('newsletterHoneypot');
      if (honeypot && honeypot.value !== '') {
        // Un campo invisible que un humano nunca llena, pero sí los bots automáticos.
        newsletterForm.reset();
        return;
      }
      document.getElementById('newsletterMsg').classList.remove('hidden');
      newsletterForm.reset();
    });
  }

  const burger = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  let menuOpen = false;
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      menuOpen = !menuOpen;
      if (menuOpen) {
        mobileMenu.style.maxHeight = mobileMenu.scrollHeight + 'px';
        mobileMenu.style.opacity = '1';
        burger.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      } else {
        mobileMenu.style.maxHeight = '0px';
        mobileMenu.style.opacity = '0';
        burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
      }
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuOpen = false;
        mobileMenu.style.maxHeight = '0px';
        mobileMenu.style.opacity = '0';
        burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
      });
    });
  }

  const formulaInput = document.getElementById('formulaInput');
  const formulaPreview = document.getElementById('formulaPreview');
  const formulaFileName = document.getElementById('formulaFileName');
  const formulaDropZone = document.getElementById('formulaDropZone');
  if (formulaInput) {
    formulaDropZone.addEventListener('click', (e) => {
      e.preventDefault();
      formulaInput.click();
    });
    formulaInput.addEventListener('change', () => {
      const file = formulaInput.files[0];
      if (!file) return;
      formulaFileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        formulaPreview.src = e.target.result;
        formulaPreview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

/* ===== Bloque 5/9 ===== */
// ===== Capa de datos compartida (inventario) =====
  const STORAGE_KEY = 'farmago_inventario';
  const STORAGE_SOURCE_KEY = 'farmago_inventario_source';
  const CATALOG_VERSION_KEY = 'farmago_catalog_version';
  const CATALOG_VERSION = '2026-07-29-v9';
  const PRODUCTOS_JSON_PATH = 'productos.json';
  const PRODUCTOS_JSON_SOURCE_VERSION = 'productos-json-v9';
  const CATEGORIAS = ['Antibióticos', 'Analgésicos', 'Antigripales', 'Vitaminas', 'Antiinflamatorios', 'Bebidas', 'Cuidado personal', 'Bebés', 'Adulto mayor', 'Otros'];
  const CATEGORIA_ICONOS = {
    'Antibióticos': 'fa-solid fa-capsules',
    'Analgésicos': 'fa-solid fa-pills',
    'Antigripales': 'fa-solid fa-head-side-cough',
    'Vitaminas': 'fa-solid fa-lemon',
    'Antiinflamatorios': 'fa-solid fa-bandage',
    'Bebidas': 'fa-solid fa-bottle-water',
    'Cuidado personal': 'fa-solid fa-pump-soap',
    'Bebés': 'fa-solid fa-baby',
    'Adulto mayor': 'fa-solid fa-heart-pulse',
    'Otros': 'fa-solid fa-box',
  };

  // Fallbacks locales verificadas para que el catálogo no dependa de redes
  // externas ni de rutas generadas que puedan no existir en disco.
  const CATEGORIA_IMAGENES = {
    'Analgésicos': 'assets/imagenesmedimentos/genericas/analgesicos.svg',
    'Antibióticos': 'assets/imagenesmedimentos/genericas/antibioticos.svg',
    'Vitaminas': 'assets/imagenesmedimentos/genericas/vitaminas.svg',
    'Antiinflamatorios': 'assets/imagenesmedimentos/genericas/antiinflamatorios.svg',
    'Bebidas': 'assets/imagenesmedimentos/genericas/bebidas.svg',
    'Cuidado personal': 'assets/imagenesmedimentos/genericas/cuidado-personal.svg',
    'Bebés': 'assets/imagenesmedimentos/genericas/bebes.svg',
    'Adulto mayor': 'assets/imagenesmedimentos/genericas/adulto-mayor.svg',
  };
  const DIAS_ALERTA_VENCIMIENTO = 30;

  // Precios de referencia (COP) para productos típicos de droguería.
  // Ajusta cada precio real desde el panel de inventario (#panel-farmago-2026).
const SEED_DATA = [
    { id: 'seed-1', nombre: 'Centrum Adulto', fabricante: 'Pfizer', categoria: 'Vitaminas', icono: 'fa-solid fa-capsules', imagen: 'assets/imagenesmedimentos/centrum.jpg', lote: 'L-2026-101', vencimiento: '2027-08-01', stock: 25, umbral: 5, precio: 34320, presentacion: 'Frasco x 30 comprimidos', referencia: 'REF-101', activo: true },
    { id: 'seed-2', nombre: 'Scott Emulsión Tradicional', fabricante: 'Gsk', categoria: 'Vitaminas', icono: 'fa-solid fa-bottle-droplet', imagen: 'assets/imagenesmedimentos/scott.jpg', lote: 'L-2026-102', vencimiento: '2027-05-01', stock: 20, umbral: 5, precio: 14750, presentacion: 'Frasco x 180 ml', referencia: 'REF-102', activo: true },
    { id: 'seed-3', nombre: 'Vita C 500mg MK', fabricante: 'Tecnoquimicas', categoria: 'Vitaminas', icono: 'fa-solid fa-lemon', imagen: 'assets/imagenesmedimentos/vitac500mg.jpg', lote: 'L-2026-103', vencimiento: '2027-09-01', stock: 30, umbral: 8, precio: 58900, presentacion: 'Frasco x 100 tabletas masticables', referencia: 'REF-103', activo: true },
    { id: 'seed-4', nombre: 'Similac 1', fabricante: 'Abbott', categoria: 'Bebés', icono: 'fa-solid fa-baby', imagen: 'assets/imagenesmedimentos/similac1.jpg', lote: 'L-2026-104', vencimiento: '2027-04-01', stock: 15, umbral: 5, precio: 76150, presentacion: 'Lata x 350 g (Etapa 1)', referencia: 'REF-104', activo: true },
    { id: 'seed-5', nombre: 'Enfamil Premium 1', fabricante: 'Mead Johnson', categoria: 'Bebés', icono: 'fa-solid fa-baby', imagen: 'assets/imagenesmedimentos/enfamilpremium.jpg', lote: 'L-2026-105', vencimiento: '2027-04-01', stock: 15, umbral: 5, precio: 80600, presentacion: 'Lata x 375 g (Etapa 1)', referencia: 'REF-105', activo: true },
    { id: 'seed-6', nombre: 'Pañales Huggies Natural Care M', fabricante: 'Kimberly Clark', categoria: 'Bebés', icono: 'fa-solid fa-baby', imagen: 'assets/imagenesmedimentos/pañaleshuggies.jpg', lote: 'L-2026-106', vencimiento: '2028-01-01', stock: 20, umbral: 5, precio: 95000, presentacion: 'Paquete x 78 unidades (Talla M)', referencia: 'REF-106', activo: true },
    { id: 'seed-7', nombre: 'Pañales Winny Ultratrim Sec E5 XXG', fabricante: 'Tecnoquimicas', categoria: 'Bebés', icono: 'fa-solid fa-baby', imagen: 'assets/imagenesmedimentos/pañaleswinny.jpg', lote: 'L-2026-107', vencimiento: '2028-01-01', stock: 18, umbral: 5, precio: 18200, presentacion: 'Paquete x 10 unidades (E5 XXG)', referencia: 'REF-107', activo: true },
    { id: 'seed-8', nombre: 'Noxpirin Plus', fabricante: 'Siegfried', categoria: 'Antigripales', icono: 'fa-solid fa-head-side-cough', imagen: 'assets/imagenesmedimentos/nospirina.jpg', lote: 'L-2026-108', vencimiento: '2027-03-01', stock: 25, umbral: 6, precio: 15680, presentacion: 'Caja x 12 tabletas', referencia: 'REF-108', activo: true },
    { id: 'seed-9', nombre: 'Buscapina Compositum', fabricante: 'Boehringer Ingelheim', categoria: 'Analgésicos', icono: 'fa-solid fa-pills', imagen: 'assets/imagenesmedimentos/buscapnacompositum.jpg', lote: 'L-2026-109', vencimiento: '2027-06-01', stock: 20, umbral: 5, precio: 35000, presentacion: 'Caja x 20 comprimidos', referencia: 'REF-109', activo: true },
    { id: 'seed-10', nombre: 'Dolex Avanzado', fabricante: 'Glaxosmithkline', categoria: 'Analgésicos', icono: 'fa-solid fa-pills', imagen: 'assets/imagenesmedimentos/dolex.jpg', lote: 'L-2026-110', vencimiento: '2027-07-01', stock: 30, umbral: 8, precio: 14500, presentacion: 'Caja x 10 tabletas', referencia: 'REF-110', activo: true },
    { id: 'seed-11', nombre: 'Advil FastGel', fabricante: 'Glaxosmithkline', categoria: 'Antiinflamatorios', icono: 'fa-solid fa-capsules', imagen: 'assets/imagenesmedimentos/advil.jpg', lote: 'L-2026-111', vencimiento: '2027-07-01', stock: 25, umbral: 6, precio: 40400, presentacion: 'Caja x 36 cápsulas líquidas', referencia: 'REF-111', activo: true },
    { id: 'seed-12', nombre: 'Colgate Triple Acción', fabricante: 'Colgate Palmolive', categoria: 'Cuidado personal', icono: 'fa-solid fa-tooth', imagen: 'assets/imagenesmedimentos/colgatetripleaccion.jpg', lote: 'L-2026-112', vencimiento: '2028-01-01', stock: 40, umbral: 10, precio: 5000, presentacion: 'Tubo x 100 ml', referencia: 'REF-112', activo: true },
    { id: 'seed-13', nombre: 'Electrolit Maracuyá 625 ml', fabricante: 'Pisa', categoria: 'Bebes', icono: 'fa-solid fa-bottle-water', imagen: 'assets/imagenesmedimentos/electrolit.png', lote: 'L-2026-113', vencimiento: '2027-06-01', stock: 20, umbral: 5, precio: 9500, presentacion: 'Botella x 625 ml', referencia: 'REF-113', activo: true },
    { id: 'seed-14', nombre: 'Pedialyte Active Fresa 500 ml', fabricante: 'Abbott', categoria: 'Bebes', icono: 'fa-solid fa-bottle-water', imagen: 'assets/imagenesmedimentos/pedialyte.png', lote: 'L-2026-114', vencimiento: '2027-06-01', stock: 18, umbral: 5, precio: 12900, presentacion: 'Botella x 500 ml', referencia: 'REF-114', activo: true },
    { id: 'seed-15', nombre: 'Omeprazol 20 mg Genfar', fabricante: 'Genfar', categoria: 'Analgesicos', icono: 'fa-solid fa-capsules', imagen: 'assets/imagenesmedimentos/omeprazol.png', lote: 'L-2026-115', vencimiento: '2027-09-01', stock: 30, umbral: 5, precio: 8400, presentacion: 'Caja x 30 cápsulas', referencia: 'REF-115', activo: true },
    { id: 'seed-16', nombre: 'Diosmectita 3 g Genfar', fabricante: 'Genfar', categoria: 'Analgesicos', icono: 'fa-solid fa-prescription-bottle-medical', imagen: 'assets/imagenesmedimentos/diosmectita.png', lote: 'L-2026-116', vencimiento: '2027-07-01', stock: 22, umbral: 5, precio: 15600, presentacion: 'Caja x 18 sobres', referencia: 'REF-116', activo: true },
    { id: 'seed-17', nombre: 'Diclofenaco Gel 1% Genfar', fabricante: 'Genfar', categoria: 'Antiinflamatorios', icono: 'fa-solid fa-pump-medical', imagen: 'assets/imagenesmedimentos/diclofenacogel.png', lote: 'L-2026-117', vencimiento: '2027-10-01', stock: 15, umbral: 5, precio: 18700, presentacion: 'Tubo x 50 g', referencia: 'REF-117', activo: true },
    { id: 'seed-18', nombre: 'Acetaminofén 500mg', fabricante: 'MK', categoria: 'Analgesicos', icono: 'fa-solid fa-tablets', imagen: 'assets/imagenesmedimentos/Acetaminofen500mg.png', lote: 'L-2026-118', vencimiento: '2028-03-01', stock: 60, umbral: 10, precio: 3500, presentacion: 'Caja x 100 tabletas', referencia: 'REF-118', activo: true },
    { id: 'seed-19', nombre: 'Aspirina 500mg', fabricante: 'Bayer', categoria: 'Analgesicos', icono: 'fa-solid fa-tablets', imagen: 'assets/imagenesmedimentos/aspirina500mg.png', lote: 'L-2026-119', vencimiento: '2028-01-01', stock: 45, umbral: 8, precio: 9800, presentacion: 'Caja x 100 tabletas', referencia: 'REF-119', activo: true },
    { id: 'seed-20', nombre: 'Ibuprofeno 800mg', fabricante: 'Genfar', categoria: 'Antiinflamatorios', icono: 'fa-solid fa-pills', imagen: 'assets/imagenesmedimentos/ibuprofeno800mg.png', lote: 'L-2026-120', vencimiento: '2027-11-01', stock: 50, umbral: 10, precio: 14900, presentacion: 'Caja x 50 tabletas', referencia: 'REF-120', activo: true },
    { id: 'seed-21', nombre: 'Naproxeno 500mg', fabricante: 'MK', categoria: 'Antiinflamatorios', icono: 'fa-solid fa-pills', imagen: 'assets/imagenesmedimentos/naproxeno500mg.png', lote: 'L-2026-121', vencimiento: '2028-02-01', stock: 40, umbral: 8, precio: 11200, presentacion: 'Caja x 30 tabletas', referencia: 'REF-121', activo: true },
    { id: 'seed-22', nombre: 'Loratadina 10mg', fabricante: 'Genfar', categoria: 'Antigripales', icono: 'fa-solid fa-head-side-cough', imagen: 'assets/imagenesmedimentos/loratadina10mg.png', lote: 'L-2026-122', vencimiento: '2028-05-01', stock: 55, umbral: 10, precio: 5900, presentacion: 'Caja x 10 tabletas', referencia: 'REF-122', activo: true },
    { id: 'seed-23', nombre: 'Salbutamol Inhalador 100mcg', fabricante: 'Gsk', categoria: 'Antigripales', icono: 'fa-solid fa-lungs', imagen: 'assets/imagenesmedimentos/salbutamol100mcg.png', lote: 'L-2026-123', vencimiento: '2027-10-01', stock: 18, umbral: 5, precio: 21500, presentacion: 'Inhalador x 200 dosis', referencia: 'REF-123', activo: true },
    { id: 'seed-24', nombre: 'Amoxicilina 500mg', fabricante: 'Genfar', categoria: 'Analgesicos', icono: 'fa-solid fa-capsules', imagen: 'assets/imagenesmedimentos/amoxicilina500mg.jpg', lote: 'L-2026-124', vencimiento: '2027-09-01', stock: 30, umbral: 8, precio: 12000, presentacion: 'Caja x 50 cápsulas', referencia: 'REF-124', activo: true },
    { id: 'seed-25', nombre: 'Cefalexina 500mg', fabricante: 'MK', categoria: 'Analgesicos', icono: 'fa-solid fa-capsules', imagen: 'assets/imagenesmedimentos/cefalexina500mg.png', lote: 'L-2026-125', vencimiento: '2027-08-01', stock: 25, umbral: 6, precio: 18500, presentacion: 'Caja x 30 cápsulas', referencia: 'REF-125', activo: true },
    { id: 'seed-26', nombre: 'Enalapril 20mg', fabricante: 'Genfar', categoria: 'Analgesicos', icono: 'fa-solid fa-tablets', imagen: 'assets/imagenesmedimentos/enalapril20mg.jpg', lote: 'L-2026-126', vencimiento: '2028-04-01', stock: 35, umbral: 8, precio: 8900, presentacion: 'Caja x 30 tabletas', referencia: 'REF-126', activo: true },
    { id: 'seed-27', nombre: 'Losartan 50mg', fabricante: 'MK', categoria: 'Analgesicos', icono: 'fa-solid fa-tablets', imagen: 'assets/imagenesmedimentos/losartan50mg.png', lote: 'L-2026-127', vencimiento: '2028-06-01', stock: 38, umbral: 8, precio: 12400, presentacion: 'Caja x 30 tabletas', referencia: 'REF-127', activo: true },
    { id: 'seed-28', nombre: 'Metformina 850mg', fabricante: 'Genfar', categoria: 'Analgesicos', icono: 'fa-solid fa-tablets', imagen: 'assets/imagenesmedimentos/metformina850mg.png', lote: 'L-2026-128', vencimiento: '2028-03-01', stock: 42, umbral: 8, precio: 9600, presentacion: 'Caja x 30 tabletas', referencia: 'REF-128', activo: true },
    { id: 'seed-29', nombre: 'Glibenclamida 5mg', fabricante: 'La Santé', categoria: 'Analgesicos', icono: 'fa-solid fa-tablets', imagen: 'assets/imagenesmedimentos/glibenclamida5mg.jpg', lote: 'L-2026-129', vencimiento: '2028-01-01', stock: 30, umbral: 8, precio: 6500, presentacion: 'Caja x 30 tabletas', referencia: 'REF-129', activo: true },
    { id: 'seed-30', nombre: 'Enterogermina 5ml x10', fabricante: 'Sanofi', categoria: 'Bebes', icono: 'fa-solid fa-vial', imagen: 'assets/imagenesmedimentos/enterogermina5ml.jpg', lote: 'L-2026-130', vencimiento: '2027-12-01', stock: 20, umbral: 5, precio: 45900, presentacion: 'Caja x 10 ampollas de 5 ml', referencia: 'REF-130', activo: true },
    { id: 'seed-31', nombre: 'Hidrocortisona Crema 1%', fabricante: 'Genfar', categoria: 'Cuidado personal', icono: 'fa-solid fa-pump-soap', imagen: 'assets/imagenesmedimentos/hidrocortisonacrema.png', lote: 'L-2026-131', vencimiento: '2027-11-01', stock: 22, umbral: 5, precio: 11500, presentacion: 'Tubo x 15 g', referencia: 'REF-131', activo: true },
    { id: 'seed-32', nombre: 'Ketoconazol Crema 2%', fabricante: 'MK', categoria: 'Cuidado personal', icono: 'fa-solid fa-pump-soap', imagen: 'assets/imagenesmedimentos/ketoconazolcrema.jpg', lote: 'L-2026-132', vencimiento: '2027-10-01', stock: 20, umbral: 5, precio: 16800, presentacion: 'Tubo x 20 g', referencia: 'REF-132', activo: true },
    { id: 'seed-33', nombre: 'Gillette Invisible Gel Cool Wave 82g x2', fabricante: 'Gillette', categoria: 'Cuidado personal', icono: 'fa-solid fa-spray-can', imagen: 'assets/imagenesmedimentos/desoderantegillette82gx2.png', lote: 'L-2026-133', vencimiento: '2028-06-01', stock: 20, umbral: 5, precio: 37240, presentacion: 'Pack x 2 unidades de 82 g', referencia: 'REF-133', activo: true },
];

  function toNumberSafe(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function ensureCatalogVersion() {
    const current = localStorage.getItem(CATALOG_VERSION_KEY);
    if (current === CATALOG_VERSION) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_SOURCE_KEY);
    localStorage.setItem(CATALOG_VERSION_KEY, CATALOG_VERSION);
  }

  function oneYearFromTodayISO() {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function mapProductosJsonToInventario(rows) {
    if (!Array.isArray(rows)) return [];
    const fallbackVencimiento = oneYearFromTodayISO();

    return rows.map((p, idx) => {
      const categoria = normalizarCategoria(p.categoria || 'Otros') || 'Otros';
      const stock = Math.max(0, toNumberSafe(p.stock, 0));
      const precio = Math.max(0, toNumberSafe(p.precio, 0));
      const id = p.id ? String(p.id) : `json-${idx + 1}`;
      const nombre = (p.nombre || '').toString().trim() || `Producto ${idx + 1}`;
      const umbral = Math.max(0, toNumberSafe(p.umbral, 3));
      const imagenFinal = resolverImagenCatalogoProducto({
        nombre,
        categoria,
        descripcion: p.descripcion,
        presentacion: p.presentacion,
        imagen: p.imagen,
      });

      return {
        id,
        nombre,
        fabricante: (p.fabricante || '').toString().trim(),
        categoria,
        icono: CATEGORIA_ICONOS[categoria] || 'fa-solid fa-box',
        imagen: imagenFinal,
        imagenTransparente: !!p.imagenTransparente,
        lote: (p.lote || `JSON-${String(idx + 1).padStart(4, '0')}`).toString(),
        vencimiento: (p.vencimiento || fallbackVencimiento).toString(),
        stock,
        umbral,
        precio,
        presentacion: (p.presentacion || p.descripcion || '').toString(),
        referencia: (p.referencia || id).toString(),
        activo: (typeof p.disponible === 'boolean') ? p.disponible : stock > 0,
      };
    });
  }

  async function hydrateInventarioFromProductosJson() {
    try {
      const productosJsonUrl = `${PRODUCTOS_JSON_PATH}?v=${Date.now()}`;
      const resp = await fetch(productosJsonUrl, { cache: 'no-store' });
      if (!resp.ok) return false;
      const rows = await resp.json();
      const mapped = mapProductosJsonToInventario(rows);
      if (!Array.isArray(mapped) || mapped.length === 0) return false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      localStorage.setItem(STORAGE_SOURCE_KEY, PRODUCTOS_JSON_SOURCE_VERSION);
      return true;
    } catch {
      return false;
    }
  }

function loadInventario() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
        localStorage.setItem(STORAGE_SOURCE_KEY, 'seed-v1');
        return [...SEED_DATA];
      }
      let data = JSON.parse(raw);
      if (!Array.isArray(data) || data.length === 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
        localStorage.setItem(STORAGE_SOURCE_KEY, 'seed-v1');
        return [...SEED_DATA];
      }

      const source = localStorage.getItem(STORAGE_SOURCE_KEY);

      if (source && source.startsWith('productos-json-v')) {
        data = data.map(p => {
          const categoriaN = normalizarCategoria(p.categoria);
          const imagenN = resolverImagenCatalogoProducto({ ...p, categoria: categoriaN });
          return {
            ...p,
            categoria: categoriaN,
            icono: p.icono || CATEGORIA_ICONOS[categoriaN] || 'fa-solid fa-box',
            imagen: imagenN,
            activo: (typeof p.activo === 'boolean') ? p.activo : (Number(p.stock) > 0),
          };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }

      // Si el catálogo base (SEED_DATA) creció con productos nuevos que este
      // navegador todavía no tiene guardados, los agregamos sin tocar lo que
      // ya existe (para no perder ediciones hechas desde el panel).
      const idsGuardados = new Set(data.map(p => p.id));
      const productosNuevos = SEED_DATA.filter(p => !idsGuardados.has(p.id));
      if (productosNuevos.length > 0) {
        data = data.concat(productosNuevos);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      // Backfill: si SEED_DATA ganó campos nuevos (presentacion, referencia)
      // que los datos ya guardados en este navegador no tienen, se copian
      // desde el seed sin pisar nada que el usuario haya editado.
      const seedPorId = new Map(SEED_DATA.map(p => [p.id, p]));
      let huboBackfill = false;
      data = data.map(p => {
        const seed = seedPorId.get(p.id);
        if (!seed) return p;
        const actualizado = { ...p };
        if (actualizado.presentacion === undefined && seed.presentacion) {
          actualizado.presentacion = seed.presentacion;
          huboBackfill = true;
        }
        if (actualizado.referencia === undefined && seed.referencia) {
          actualizado.referencia = seed.referencia;
          huboBackfill = true;
        }
        return actualizado;
      });
      let huboNormalizacion = false;
      data = data.map(p => {
        const categoriaN = normalizarCategoria(p.categoria);
        const imagenN = resolverImagenCatalogoProducto({ ...p, categoria: categoriaN });
        if (categoriaN !== p.categoria || imagenN !== p.imagen) huboNormalizacion = true;
        return {
          ...p,
          categoria: categoriaN,
          imagen: imagenN,
        };
      });

      if (huboBackfill || huboNormalizacion) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      return data;
    } catch {
      return [...SEED_DATA];
    }
  }

  function saveInventario(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ===== Seguridad: sanitización de texto antes de insertarlo en el DOM =====
  // Convierte cualquier texto (aunque venga del panel de inventario o de lo que
  // escriba un visitante) en texto plano seguro, neutralizando <script>, onerror=, etc.
 function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str === null || str === undefined ? '' : String(str);
    // Además de <, > y &, escapamos comillas para que el resultado sea seguro
    // tanto dentro de texto como dentro de atributos HTML (data-nombre="...", etc.)
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ===== Alternar entre sitio público y panel interno =====
  const ADMIN_HASH = '#panel-farmago-2026';

  function showPublicView() {
    document.getElementById('publicView').classList.remove('hidden');
    document.getElementById('adminView').classList.add('hidden');
    if (typeof refreshPublicCatalog === 'function') refreshPublicCatalog();
  }

  function showAdminView() {
    document.getElementById('publicView').classList.add('hidden');
    document.getElementById('adminView').classList.remove('hidden');
    if (typeof refreshAdminPanel === 'function') refreshAdminPanel();
  }

  function applyViewFromHash() {
    if (window.location.hash === ADMIN_HASH) {
      showAdminView();
    } else {
      showPublicView();
    }
  }

  window.addEventListener('hashchange', applyViewFromHash);

/* ===== Bloque 6/9 ===== */
let inventario = [];

  function poblarSelectsCategoria() {
    const categoriaSelects = [document.getElementById('filterCategoria'), document.getElementById('medCategoria')];
    categoriaSelects.forEach((sel) => {
      if (sel.dataset.poblado === '1') return;
      CATEGORIAS.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        sel.appendChild(opt);
      });
      sel.dataset.poblado = '1';
    });
  }
  poblarSelectsCategoria();

  function diasParaVencer(fechaStr) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaStr + 'T00:00:00');
    return Math.round((venc - hoy) / (1000 * 60 * 60 * 24));
  }

  function estadoVencimiento(fechaStr) {
    const dias = diasParaVencer(fechaStr);
    if (dias < 0) return 'vencido';
    if (dias <= DIAS_ALERTA_VENCIMIENTO) return 'por-vencer';
    return 'ok';
  }

  function renderAlerts() {
    const bajoStock = inventario.filter(m => m.stock <= m.umbral);
    const vencidos = inventario.filter(m => estadoVencimiento(m.vencimiento) === 'vencido');
    const porVencer = inventario.filter(m => estadoVencimiento(m.vencimiento) === 'por-vencer');

    const bar = document.getElementById('alertsBar');
    bar.innerHTML = '';

    if (bajoStock.length > 0) {
      bar.innerHTML += `
        <div class="bg-warn/10 border border-warn/30 rounded-xl p-4 flex items-center gap-3">
          <span class="w-10 h-10 rounded-full bg-warn/20 text-warn flex items-center justify-center shrink-0"><i class="fa-solid fa-box-open"></i></span>
          <div>
            <p class="font-semibold text-sm text-ink">${bajoStock.length} producto${bajoStock.length > 1 ? 's' : ''} con bajo stock</p>
            <p class="text-xs text-ink/60">${bajoStock.map(m => escapeHTML(m.nombre)).slice(0, 3).join(', ')}${bajoStock.length > 3 ? '...' : ''}</p>
          </div>
        </div>`;
    }
    if (vencidos.length > 0 || porVencer.length > 0) {
      const total = vencidos.length + porVencer.length;
      bar.innerHTML += `
        <div class="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center gap-3">
          <span class="w-10 h-10 rounded-full bg-danger/20 text-danger flex items-center justify-center shrink-0"><i class="fa-solid fa-calendar-xmark"></i></span>
          <div>
            <p class="font-semibold text-sm text-ink">${total} producto${total > 1 ? 's' : ''} vencido${total > 1 ? 's' : ''} o próximo${total > 1 ? 's' : ''} a vencer</p>
            <p class="text-xs text-ink/60">${vencidos.length} vencido${vencidos.length !== 1 ? 's' : ''} · ${porVencer.length} próximo${porVencer.length !== 1 ? 's' : ''} a vencer (≤${DIAS_ALERTA_VENCIMIENTO} días)</p>
          </div>
        </div>`;
    }
    if (bajoStock.length === 0 && vencidos.length === 0 && porVencer.length === 0) {
      bar.innerHTML = `
        <div class="bg-blue/10 border border-blue/20 rounded-xl p-4 flex items-center gap-3 sm:col-span-2">
          <span class="w-10 h-10 rounded-full bg-blue/20 text-blue flex items-center justify-center shrink-0"><i class="fa-solid fa-circle-check"></i></span>
          <p class="font-semibold text-sm text-ink">Todo en orden: sin alertas de stock ni de vencimiento.</p>
        </div>`;
    }
  }

  function badgeVencimiento(fechaStr) {
    const estado = estadoVencimiento(fechaStr);
    const dias = diasParaVencer(fechaStr);
    const fechaFmt = new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    if (estado === 'vencido') {
      return `<span class="inline-flex items-center gap-1 bg-danger/10 text-danger text-xs font-semibold px-2 py-1 rounded-full">${fechaFmt} · Vencido</span>`;
    }
    if (estado === 'por-vencer') {
      return `<span class="inline-flex items-center gap-1 bg-warn/10 text-warn text-xs font-semibold px-2 py-1 rounded-full">${fechaFmt} · ${dias}d</span>`;
    }
    return `<span class="text-xs text-ink/60">${fechaFmt}</span>`;
  }

  function badgeStock(m) {
    if (m.stock <= m.umbral) {
      return `<span class="inline-flex items-center gap-1 bg-warn/10 text-warn text-xs font-semibold px-2 py-1 rounded-full">${m.stock} · Bajo</span>`;
    }
    return `<span class="text-xs text-ink/70">${m.stock}</span>`;
  }

  function renderTable() {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const catFiltro = document.getElementById('filterCategoria').value;
    const alertaFiltro = document.getElementById('filterAlerta').value;

    let filtrados = inventario.filter(m => {
      const matchSearch = !search || m.nombre.toLowerCase().includes(search) || m.lote.toLowerCase().includes(search);
      const matchCat = !catFiltro || m.categoria === catFiltro;
      let matchAlerta = true;
      if (alertaFiltro === 'bajo-stock') matchAlerta = m.stock <= m.umbral;
      if (alertaFiltro === 'por-vencer') matchAlerta = estadoVencimiento(m.vencimiento) === 'por-vencer';
      if (alertaFiltro === 'vencido') matchAlerta = estadoVencimiento(m.vencimiento) === 'vencido';
      return matchSearch && matchCat && matchAlerta;
    });

    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '';

    if (filtrados.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }

    filtrados.forEach(m => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-cloud/50 transition';
      tr.innerHTML = `
        <td class="px-4 py-3 font-medium">${escapeHTML(m.nombre)}</td>
        <td class="px-4 py-3 text-ink/60">${escapeHTML(m.categoria)}</td>
        <td class="px-4 py-3 text-ink/60 font-mono text-xs">${escapeHTML(m.lote)}</td>
        <td class="px-4 py-3">${badgeVencimiento(m.vencimiento)}</td>
        <td class="px-4 py-3">${badgeStock(m)}</td>
        <td class="px-4 py-3 text-ink/60">${m.precio ? '$' + Number(m.precio).toLocaleString('es-CO') : '—'}</td>
        <td class="px-4 py-3">${m.activo ? '<span class="text-blue text-xs font-semibold"><i class="fa-solid fa-eye mr-1"></i>Visible</span>' : '<span class="text-ink/30 text-xs"><i class="fa-solid fa-eye-slash mr-1"></i>Oculto</span>'}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button data-edit="${escapeHTML(m.id)}" class="w-8 h-8 rounded-lg hover:bg-cloud text-ink/50 hover:text-blue transition"><i class="fa-solid fa-pen"></i></button>
          <button data-delete="${escapeHTML(m.id)}" class="w-8 h-8 rounded-lg hover:bg-cloud text-ink/50 hover:text-danger transition"><i class="fa-solid fa-trash"></i></button>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openModal(btn.dataset.edit));
    });
    tbody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteMedicamento(btn.dataset.delete));
    });
  }

  function refreshAdminPanel() {
    inventario = loadInventario();
    renderAlerts();
    renderTable();
  }

  ['searchInput'].forEach(id => document.getElementById(id).addEventListener('input', renderTable));
  ['filterCategoria', 'filterAlerta'].forEach(id => document.getElementById(id).addEventListener('change', renderTable));
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategoria').value = '';
    document.getElementById('filterAlerta').value = '';
    renderTable();
  });

  const medModal = document.getElementById('medModal');
  const medForm = document.getElementById('medForm');

  function openModal(id) {
    medForm.reset();
    document.getElementById('medUmbral').value = 5;
    if (id) {
      const m = inventario.find(x => x.id === id);
      if (!m) return;
      document.getElementById('modalTitle').textContent = 'Editar medicamento';
      document.getElementById('medId').value = m.id;
      document.getElementById('medNombre').value = m.nombre;
      document.getElementById('medCategoria').value = m.categoria;
      document.getElementById('medLote').value = m.lote;
      document.getElementById('medVencimiento').value = m.vencimiento;
      document.getElementById('medStock').value = m.stock;
      document.getElementById('medUmbral').value = m.umbral;
      document.getElementById('medPrecio').value = m.precio || '';
      document.getElementById('medImagen').value = m.imagen || '';
      document.getElementById('medActivo').checked = m.activo;
    } else {
      document.getElementById('modalTitle').textContent = 'Agregar medicamento';
      document.getElementById('medId').value = '';
      document.getElementById('medActivo').checked = true;
    }
    medModal.showModal();
  }

  document.getElementById('openAddModalBtn').addEventListener('click', () => openModal(null));
  document.getElementById('closeModalBtn').addEventListener('click', () => medModal.close());
  document.getElementById('cancelModalBtn').addEventListener('click', () => medModal.close());

  medForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('medId').value;
    const registro = {
      id: id || 'med-' + Date.now(),
      nombre: document.getElementById('medNombre').value.trim(),
      categoria: normalizarCategoria(document.getElementById('medCategoria').value),
      lote: document.getElementById('medLote').value.trim(),
      vencimiento: document.getElementById('medVencimiento').value,
      stock: Number(document.getElementById('medStock').value),
      umbral: Number(document.getElementById('medUmbral').value),
      precio: document.getElementById('medPrecio').value ? Number(document.getElementById('medPrecio').value) : null,
      imagen: normalizarRutaImagen(document.getElementById('medImagen').value.trim()) || null,
      activo: document.getElementById('medActivo').checked,
    };

    if (id) {
      inventario = inventario.map(m => (m.id === id ? registro : m));
    } else {
      inventario.push(registro);
    }
    saveInventario(inventario);
    medModal.close();
    refreshAdminPanel();
  });

  function deleteMedicamento(id) {
    if (!confirm('¿Eliminar este medicamento del inventario? Esta acción no se puede deshacer.')) return;
    inventario = inventario.filter(m => m.id !== id);
    saveInventario(inventario);
    refreshAdminPanel();
  }

  document.getElementById('backToPublicBtn').addEventListener('click', () => {
    window.location.hash = '';
  });

/* ===== Bloque 7/9 ===== */
// Catálogo reducido — canal Comercial, seleccionado por categoría (~27KB, carga instantánea)
  const ALBUM_PRODUCTOS = [
    {"id":"CENTRUM001","n":"Centrum Adulto","pa":"Multivitaminico (De La A Al Zinc)","c":"30 Comprimidos Recubiertos","f":"Pfizer","u":"Frasco","p":34320,"cat":"Vitaminas","img":"assets/imagenesmedimentos/centrum.jpg"},
    {"id":"SCOTT001","n":"Scott Emulsión Tradicional","pa":"Aceite De Higado De Bacalao (Vitaminas A Y D)","c":"180 ml","f":"Gsk","u":"Frasco","p":14750,"cat":"Vitaminas","img":"assets/imagenesmedimentos/scott.jpg"},
    {"id":"VITAC001","n":"Vita C 500mg Mk","pa":"Vitamina C","c":"100 Tabletas Masticables Sabor Naranja","f":"Tecnoquimicas","u":"Frasco","p":58900,"cat":"Vitaminas","img":"assets/imagenesmedimentos/vitac500mg.jpg"},
    {"id":"SIMILAC001","n":"Similac 1","pa":"Formula Infantil Con Hierro Y 5 Hmos","c":"350 g - Etapa 1 (0 A 6 Meses)","f":"Abbott","u":"Tarro","p":76150,"cat":"Bebes","img":"assets/imagenesmedimentos/similac1.jpg"},
    {"id":"ENFAMIL001","n":"Enfamil Premium 1","pa":"Formula Infantil Con Hierro Y Prebioticos","c":"375 g - Etapa 1 (0 A 6 Meses)","f":"Mead Johnson","u":"Tarro","p":80600,"cat":"Bebes","img":"assets/imagenesmedimentos/enfamilpremium.jpg"},
    {"id":"HUGGIES001","n":"Pañales Huggies Natural Care","pa":"Pañal Desechable Con Aloe Vera","c":"Talla M x 78 Unidades (5,5 A 9,5 kg)","f":"Kimberly Clark","u":"Paquete","p":95000,"cat":"Bebes","img":"assets/imagenesmedimentos/pañaleshuggies.jpg"},
    {"id":"WINNY001","n":"Pañales Winny Ultratrim Sec","pa":"Pañal Desechable","c":"Etapa 5 Xxg x 10 Unidades (+14 kg)","f":"Tecnoquimicas","u":"Paquete","p":18200,"cat":"Bebes","img":"assets/imagenesmedimentos/pañaleswinny.jpg"},
    {"id":"NOXPIRIN001","n":"Noxpirin Plus","pa":"Ibuprofeno + Fenilefrina","c":"12 Tabletas Recubiertas","f":"Siegfried","u":"Caja","p":15680,"cat":"Antigripales","img":"assets/imagenesmedimentos/nospirina.jpg"},
    {"id":"BUSCAPINA001","n":"Buscapina Compositum","pa":"Hioscina Butilbromuro + Dipirona (Metamizol Sodico)","c":"20 Comprimidos Recubiertos","f":"Boehringer Ingelheim","u":"Caja","p":35000,"cat":"Analgesicos","img":"assets/imagenesmedimentos/buscapnacompositum.jpg"},
    {"id":"DOLEX001","n":"Dolex Avanzado","pa":"Acetaminofen (Optizorb)","c":"10 Tabletas Recubiertas","f":"Glaxosmithkline","u":"Caja","p":14500,"cat":"Analgesicos","img":"assets/imagenesmedimentos/dolex.jpg"},
    {"id":"ADVIL001","n":"Advil Fastgel","pa":"Ibuprofeno","c":"36 Capsulas Liquidas","f":"Glaxosmithkline","u":"Caja","p":40400,"cat":"Analgesicos","img":"assets/imagenesmedimentos/advil.jpg"},
    {"id":"COLGATE001","n":"Colgate Triple Acción","pa":"Crema Dental Anticaries Con Fluor","c":"100 ml - Menta Original","f":"Colgate Palmolive","u":"Tubo","p":5000,"cat":"CuidadoPersonal","img":"assets/imagenesmedimentos/colgatetripleaccion.jpg"}
  ];

/* ===== Bloque 8/9 ===== */
(function () {
  const ALBUM_WHATSAPP_NUMBER = '573014466722';
  const ALBUM_PLACEHOLDER_IMG = PRODUCT_IMAGE_FALLBACK_URL;

  const ALBUM_CAT_LABELS = {
    todas: 'Todas',
    Analgesicos: 'Analgésicos',
    Antigripales: 'Antigripales',
    Antihistaminicos: 'Antihistamínicos',
    Antiacidos: 'Antiácidos',
    Vitaminas: 'Vitaminas',
    Bebes: 'Bebés',
    CuidadoPersonal: 'Cuidado Personal',
  };

  // Banco de imágenes local para el álbum secundario. Así no depende de
  // internet ni de proveedores externos que puedan bloquear o cambiar URLs.
  const ALBUM_IMG_BANK = [
    'assets/imagenesmedimentos/genericas/analgesicos.svg',
    'assets/imagenesmedimentos/genericas/antibioticos.svg',
    'assets/imagenesmedimentos/genericas/vitaminas.svg',
    'assets/imagenesmedimentos/genericas/antiinflamatorios.svg',
    'assets/imagenesmedimentos/genericas/cuidado-personal.svg',
  ];

  function albumHashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function albumImageFor(p) { return p.img || ALBUM_IMG_BANK[albumHashStr(p.n + p.f) % ALBUM_IMG_BANK.length]; }
  function albumFormatCOP(n) { return '$' + Number(n).toLocaleString('es-CO'); }
  function albumEscapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function albumWhatsappLink(p) {
    const mensaje = `¡Hola FarmaGo! Quiero pedir *${p.n}* (${p.c}) - ${albumFormatCOP(p.p)}. ¿Está disponible?`;
    return `https://wa.me/${ALBUM_WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
  }

  const ALBUM_TODOS = Array.isArray(ALBUM_PRODUCTOS)
    ? ALBUM_PRODUCTOS.map(p => ({ ...p, img: normalizarRutaImagen(p.img) }))
    : [];
  let albumCatActiva = 'todas';

  const albumGrid = document.getElementById('albumProductGrid');
  const albumSearchInput = document.getElementById('albumSearchInput');
  const albumEmptyMsg = document.getElementById('albumEmptyMsg');
  const albumResultsInfo = document.getElementById('albumResultsInfo');
  const albumTotalCount = document.getElementById('albumTotalCount');
  const albumCatFilters = document.getElementById('albumCatFilters');

  if (albumTotalCount) {
    albumTotalCount.textContent = `${ALBUM_TODOS.length} productos seleccionados — los más buscados en Colombia.`;
  }

  if (albumCatFilters) {
    const categoriasPresentes = ['todas', ...Array.from(new Set(ALBUM_TODOS.map(p => p.cat)))];
    albumCatFilters.innerHTML = categoriasPresentes.map(c =>
      `<button data-cat="${c}" class="chip shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-ink/15 ${c === 'todas' ? 'active' : ''}">${ALBUM_CAT_LABELS[c] || c}</button>`
    ).join('');

    albumCatFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      albumCatActiva = btn.dataset.cat;
      [...albumCatFilters.children].forEach(c => c.classList.toggle('active', c === btn));
      albumRender();
    });
  }

  function albumCardHTML(p) {
    const img = albumImageFor(p);
    return `
      <article class="border border-ink/10 rounded-2xl overflow-hidden bg-white flex flex-col shadow-sm hover:shadow-md transition">
        <div class="aspect-square bg-white p-2 border-b border-ink/5">
          <img src="${img}" alt="${albumEscapeHTML(p.n)}" loading="lazy" class="w-full h-full object-contain"
               onerror="this.onerror=null;this.src='${ALBUM_PLACEHOLDER_IMG}'" />
        </div>
        <div class="p-3 flex flex-col flex-1">
          <span class="text-[10px] font-semibold text-blue uppercase tracking-wide mb-1">${ALBUM_CAT_LABELS[p.cat] || p.cat}</span>
          <h3 class="font-display font-semibold text-sm leading-snug mb-0.5 text-ink">${albumEscapeHTML(p.n)}</h3>
          <p class="text-[11px] text-ink/50 mb-1">${albumEscapeHTML(p.c)}</p>
          <p class="text-[11px] text-ink/40 mb-0.5"><i class="fa-solid fa-flask text-[10px] mr-1"></i>${albumEscapeHTML(p.pa)}</p>
          <p class="text-[11px] text-ink/40 mb-2"><i class="fa-solid fa-industry text-[10px] mr-1"></i>${albumEscapeHTML(p.f)}</p>
          <p class="text-orange-dark font-display text-lg mt-auto mb-2">${albumFormatCOP(p.p)}</p>
          <a href="${albumWhatsappLink(p)}" target="_blank" rel="noopener noreferrer"
             class="inline-flex items-center justify-center gap-1.5 bg-whatsapp text-white text-xs font-semibold px-3 py-2 rounded-full hover:brightness-105 transition">
            <i class="fa-brands fa-whatsapp"></i> Pedir por WhatsApp
          </a>
        </div>
      </article>`;
  }

  function albumRender() {
    if (!albumGrid) return;
    const q = (albumSearchInput ? albumSearchInput.value.trim().toLowerCase() : '');
    const filtrados = ALBUM_TODOS.filter(p => {
      const matchTexto = !q || p.n.toLowerCase().includes(q) || p.pa.toLowerCase().includes(q) || p.f.toLowerCase().includes(q);
      const matchCat = albumCatActiva === 'todas' || p.cat === albumCatActiva;
      return matchTexto && matchCat;
    });
    albumGrid.innerHTML = filtrados.map(albumCardHTML).join('');
    if (albumEmptyMsg) albumEmptyMsg.classList.toggle('hidden', filtrados.length !== 0);
    if (albumResultsInfo) {
      albumResultsInfo.textContent = filtrados.length ? `Mostrando ${filtrados.length} de ${ALBUM_TODOS.length} productos` : '';
    }
  }

  if (albumSearchInput) {
    let albumDebounce;
    albumSearchInput.addEventListener('input', () => {
      clearTimeout(albumDebounce);
      albumDebounce = setTimeout(albumRender, 150);
    });
  }

  albumRender();
})();

/* ===== Bloque 9/9 ===== */
ensureCatalogVersion();
hydrateInventarioFromProductosJson().finally(() => {
  applyViewFromHash();
});
document.getElementById('exportInventarioBtn').addEventListener('click', () => {
  const data = loadInventario();
  const lineas = data.map(p => '    ' + JSON.stringify(p) + ',').join('\n');
  const codigo = 'const SEED_DATA = [\n' + lineas + '\n  ];';
  navigator.clipboard.writeText(codigo).then(() => {
    alert('Inventario copiado (' + data.length + ' productos). Pégalo en script.js reemplazando SEED_DATA.');
  }).catch(() => {
    prompt('Copia este texto:', codigo);
  });
});