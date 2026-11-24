(function () {
    'use strict';

    const commerce = window.VigilixCommerce;
    const ui = window.VigilixUI;
    const allProducts = Object.values(commerce.PRODUCTS);
    const catalogProducts = allProducts.filter(product => product.filterGroup !== 'licencias');
    const licenseProducts = allProducts.filter(product => product.filterGroup === 'licencias');

    let activeCategory = 'todos';
    let activeSearch = '';
    let activeSort = 'featured';

    function imageTag(product, altText) {
        const fallback = product.fallbackImage ? ` data-fb="${commerce.escapeHtml(product.fallbackImage)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}"` : '';
        return `<img src="${commerce.escapeHtml(product.image)}" alt="${commerce.escapeHtml(altText || product.name)}" loading="lazy"${fallback}>`;
    }

    function renderFeatured() {
        const container = document.querySelector('#destacados .featured-grid');
        if (!container) return;
        const featured = catalogProducts.filter(p => p.featured).slice(0, 4);
        container.innerHTML = featured.map(product => `
            <article class="featured-card">
                <a href="producto.html?sku=${encodeURIComponent(product.sku)}">${imageTag(product)}</a>
                <div>
                    <span>${commerce.escapeHtml(product.category)}</span>
                    <h3><a href="producto.html?sku=${encodeURIComponent(product.sku)}">${commerce.escapeHtml(product.shortName || product.name)}</a></h3>
                    <strong>${commerce.formatMoney(product.price)}</strong>
                    <div class="featured-actions">
                        <a href="producto.html?sku=${encodeURIComponent(product.sku)}">Ver detalles</a>
                        <button type="button" onclick="addProductToCart('${commerce.escapeHtml(product.sku)}', this)" title="Agregar al carrito" aria-label="Agregar ${commerce.escapeHtml(product.name)} al carrito">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </article>
        `).join('');
    }

    function renderNewArrivals() {
        const container = document.querySelector('.arrivals-mini-grid');
        if (!container) return;
        const arrivals = catalogProducts.filter(p => p.newArrival).slice(0, 4);
        container.innerHTML = arrivals.map(product => `
            <a class="arrival-item" href="producto.html?sku=${encodeURIComponent(product.sku)}">
                ${imageTag(product)}
                <div class="arrival-info">
                    <span class="tag-new">${commerce.escapeHtml(product.arrivalTag || 'Nuevo Ingreso')}</span>
                    <h4>${commerce.escapeHtml(product.shortName || product.name)}</h4>
                    <div class="arrival-price">${commerce.formatMoney(product.price)}</div>
                </div>
            </a>
        `).join('');
    }

    function getFilteredCatalog() {
        let list = catalogProducts.filter(product => {
            const matchesCategory = activeCategory === 'todos' || product.filterGroup === activeCategory;
            if (!matchesCategory) return false;
            if (!activeSearch) return true;
            const haystack = `${product.sku} ${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
            return haystack.includes(activeSearch);
        });

        if (activeSort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
        else if (activeSort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
        else if (activeSort === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));

        return list;
    }

    function renderCatalog() {
        const grid = document.getElementById('main-catalog');
        if (!grid) return;
        const items = getFilteredCatalog();
        const counter = document.getElementById('catalog-results-count');
        if (counter) {
            counter.textContent = `Mostrando ${items.length} de ${catalogProducts.length} equipos`;
        }

        if (!items.length) {
            grid.innerHTML = `
                <div class="catalog-empty">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <h3>No encontramos equipos con ese filtro</h3>
                    <p>Prueba otra palabra clave, SKU o limpia los filtros activos.</p>
                    <button type="button" class="btn-outline" onclick="resetCatalogFilters()">Mostrar todos los productos</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = items.map(product => `
            <article class="product-card" data-category="${commerce.escapeHtml(product.filterGroup)}">
                <div class="prod-image">
                    <a href="producto.html?sku=${encodeURIComponent(product.sku)}">${imageTag(product)}</a>
                    <span class="stock-badge"><i class="fa-solid fa-check"></i> ${commerce.escapeHtml(product.stockLabel || 'Disponible')}</span>
                    <span class="brand-pill">${commerce.escapeHtml(product.brand)}</span>
                </div>
                <div class="prod-details">
                    <div class="prod-sku-row">
                        <span class="prod-sku">SKU: ${commerce.escapeHtml(product.sku)}</span>
                        <button type="button" class="btn-compare" data-compare-sku="${commerce.escapeHtml(product.sku)}" onclick="VigilixTools.toggleCompare('${commerce.escapeHtml(product.sku)}')">
                            <i class="fa-solid fa-scale-balanced"></i> Comparar
                        </button>
                    </div>
                    <h3 class="prod-title"><a href="producto.html?sku=${encodeURIComponent(product.sku)}">${commerce.escapeHtml(product.name)}</a></h3>
                    <ul class="prod-features">
                        ${product.features.slice(0, 3).map(feat => `<li><i class="fa-solid fa-check"></i> ${commerce.escapeHtml(feat)}</li>`).join('')}
                    </ul>
                    <div class="prod-footer">
                        <span class="prod-price">${commerce.formatMoney(product.price)}</span>
                        <div class="catalog-actions">
                            <a class="btn-detail" href="producto.html?sku=${encodeURIComponent(product.sku)}">Ver detalles</a>
                            <button type="button" class="btn-add" onclick="addProductToCart('${commerce.escapeHtml(product.sku)}', this)">
                                <i class="fa-solid fa-cart-plus"></i> Agregar
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `).join('');

        if (window.VigilixTools) window.VigilixTools.syncCompareButtons();
    }

    function renderLicenses() {
        const grid = document.querySelector('#licencias .license-grid');
        if (!grid) return;
        const list = activeSearch
            ? licenseProducts.filter(p => `${p.sku} ${p.name} ${p.description} ${p.licenseBadge}`.toLowerCase().includes(activeSearch))
            : licenseProducts;

        grid.innerHTML = list.map(product => `
            <div class="license-card">
                <div class="license-header">
                    <div class="license-icon"><i class="fa-solid ${commerce.escapeHtml(product.licenseIcon || 'fa-key')}"></i></div>
                    <span class="license-type-badge">${commerce.escapeHtml(product.licenseBadge || 'Licencia')}</span>
                </div>
                <span class="prod-sku">SKU: ${commerce.escapeHtml(product.sku)}</span>
                <h3><a href="producto.html?sku=${encodeURIComponent(product.sku)}">${commerce.escapeHtml(product.name)}</a></h3>
                <p>${commerce.escapeHtml(product.description)}</p>
                <ul class="prod-features">
                    ${product.features.slice(0, 3).map(feat => `<li><i class="fa-solid fa-check"></i> ${commerce.escapeHtml(feat)}</li>`).join('')}
                </ul>
                <div class="prod-footer">
                    <span class="prod-price">${commerce.formatMoney(product.price)}</span>
                    <div class="catalog-actions">
                        <a class="btn-detail" href="producto.html?sku=${encodeURIComponent(product.sku)}">Detalles</a>
                        <button type="button" class="btn-add" onclick="addProductToCart('${commerce.escapeHtml(product.sku)}', this)">
                            <i class="fa-solid fa-cart-plus"></i> Agregar
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function addProductToCart(sku, triggerBtn = null) {
        const product = commerce.PRODUCTS[sku];
        if (!product) return;
        commerce.addItem(sku);
        ui.updateCartCounters(true);

        if (triggerBtn) {
            const originalHtml = triggerBtn.innerHTML;
            triggerBtn.classList.add('added');
            triggerBtn.innerHTML = '<i class="fa-solid fa-check"></i> Agregado';
            setTimeout(() => {
                triggerBtn.classList.remove('added');
                triggerBtn.innerHTML = originalHtml;
            }, 950);
        }

        ui.showToast(
            'Producto agregado',
            `<strong>${commerce.escapeHtml(product.shortName || product.name)}</strong> añadido por <strong>${commerce.formatMoney(product.price)}</strong>.`,
            {
                actionLabel: 'Ver carrito rápido',
                onAction: () => ui.openCartDrawer()
            }
        );
    }

    function showSystemToast(title, message) {
        ui.showToast(title, message);
    }

    function filterProducts(category, btnElement = null) {
        activeCategory = category;
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            const matches = btnElement ? btn === btnElement : btn.dataset.filter === category;
            btn.classList.toggle('active', matches);
        });
        renderCatalog();
        commerce.trackEvent('filtrar_catalogo', {
            tipo_filtro: 'categoria',
            valor_filtro: category
        });
    }

    function sortProducts(value) {
        activeSort = value || 'featured';
        renderCatalog();
        commerce.trackEvent('filtrar_catalogo', {
            tipo_filtro: 'orden',
            valor_filtro: activeSort
        });
    }

    function resetCatalogFilters() {
        activeCategory = 'todos';
        activeSearch = '';
        activeSort = 'featured';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        const sortSelect = document.getElementById('catalog-sort');
        if (sortSelect) sortSelect.value = 'featured';
        filterProducts('todos');
        renderLicenses();
    }

    function fillQuoteWithCart() {
        const items = commerce.getDetailedCart();
        if (!items.length) {
            ui.showToast('Carrito vacío', 'Agrega productos primero para importarlos a la cotización.');
            return;
        }
        const detailsField = document.getElementById('project-details');
        const totalInput = document.getElementById('total-estimado-input');
        const lines = items.map(item => `• ${item.quantity}x [${item.sku}] ${item.name} (${commerce.formatMoney(item.subtotal)})`);
        const total = Number(Math.max(0, commerce.subtotal() - commerce.discountAmount()).toFixed(2));
        if (detailsField) {
            detailsField.value = `Solicito cotización formal B2B para los siguientes equipos:\n${lines.join('\n')}\nTotal referencial web: ${commerce.formatMoney(total)}`;
        }
        if (totalInput) totalInput.value = String(total);
        ui.showToast('Carrito importado', 'Se cargaron los productos de tu carrito en el formulario de cotización.');
    }

    async function submitQuoteForm(event) {
        event.preventDefault();
        const form = document.getElementById('b2b-quote-form');
        const submitBtn = document.getElementById('btn-submit-quote');
        const company = document.getElementById('company').value;
        const totalInput = document.getElementById('total-estimado-input');
        if (totalInput && Number(totalInput.value) === 0 && commerce.subtotal() > 0) {
            totalInput.value = String(commerce.subtotal());
        }
        const formData = new FormData(form);

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando en servidor...';

        try {
            const response = await fetch('guardar_cotizacion.php', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.exito) {
                const solucion = document.getElementById('solution-type')?.value || 'Proyecto B2B';
                const estimatedValue = Number(totalInput?.value || 0);
                commerce.trackEvent('generate_lead', {
                    solucion_proyecto: solucion,
                    origen_lead: estimatedValue > 0 ? 'carrito_b2b' : 'formulario_web',
                    value: estimatedValue,
                    currency: 'PEN'
                });
                ui.showToast(
                    `Cotización #VGX-${result.id_generado} Guardada`,
                    `Gracias, <strong>${commerce.escapeHtml(company)}</strong>. Tu solicitud se registró correctamente.`
                );
                form.reset();
                if (totalInput) totalInput.value = '0';
            } else {
                ui.showToast('Error al Registrar', commerce.escapeHtml(result.mensaje || 'No se pudo guardar en la base de datos.'));
            }
        } catch (error) {
            ui.showToast('Error de Conexión', 'No se pudo conectar con guardar_cotizacion.php. Intenta desde tu servidor PHP.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Solicitud';
        }
    }

    function subscribeNewsletter(event) {
        event.preventDefault();
        const emailInput = document.getElementById('newsletter-email');
        commerce.trackEvent('suscripcion_boletin', { ubicacion: 'footer' });
        ui.showToast('Suscripción Activa', `El correo <strong>${commerce.escapeHtml(emailInput.value)}</strong> ha sido registrado en el boletín técnico.`);
        emailInput.value = '';
    }

    window.addProductToCart = addProductToCart;
    window.showSystemToast = showSystemToast;
    window.filterProducts = filterProducts;
    window.sortProducts = sortProducts;
    window.resetCatalogFilters = resetCatalogFilters;
    window.fillQuoteWithCart = fillQuoteWithCart;
    window.submitQuoteForm = submitQuoteForm;
    window.subscribeNewsletter = subscribeNewsletter;

    document.addEventListener('DOMContentLoaded', () => {
        renderFeatured();
        renderNewArrivals();
        renderCatalog();
        renderLicenses();

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimer = null;
            searchInput.addEventListener('input', event => {
                activeSearch = event.target.value.toLowerCase().trim();
                renderCatalog();
                renderLicenses();
                clearTimeout(searchTimer);
                if (activeSearch.length >= 2) {
                    searchTimer = setTimeout(() => {
                        const found = getFilteredCatalog().length;
                        commerce.trackEvent('search', {
                            search_term: activeSearch,
                            resultados_encontrados: found
                        });
                    }, 700);
                }
            });
        }

        const waFooter = document.getElementById('footer-whatsapp-link');
        if (waFooter) {
            waFooter.href = commerce.whatsappUrl('Hola Vigilix, deseo asesoría B2B sobre equipos de seguridad electrónica.');
            waFooter.addEventListener('click', () => {
                commerce.trackEvent('contacto_whatsapp', { ubicacion: 'footer', sku: '', numero_pedido: '' });
            });
        }

        const pdfBtn = document.getElementById('btn-descarga-pdf');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                commerce.trackEvent('usar_herramienta', {
                    nombre_herramienta: 'descarga_pdf',
                    accion_herramienta: 'descargar'
                });
            });
        }

        const quoteSection = document.getElementById('cotizar');
        if (quoteSection && 'IntersectionObserver' in window) {
            let quoteViewed = false;
            const observer = new IntersectionObserver(entries => {
                if (quoteViewed) return;
                if (entries.some(entry => entry.isIntersecting)) {
                    quoteViewed = true;
                    commerce.trackEvent('ver_formulario_cotizacion', { ubicacion: 'home' });
                    observer.disconnect();
                }
            }, { threshold: 0.25 });
            observer.observe(quoteSection);
        }

        const draft = commerce.consumeQuoteDraft();
        if (draft) {
            const detailsField = document.getElementById('project-details');
            const totalInput = document.getElementById('total-estimado-input');
            if (detailsField) detailsField.value = draft.text;
            if (totalInput) totalInput.value = String(draft.total);
            ui.showToast('Carrito listo para cotizar', 'Completa tus datos de empresa para enviar tu solicitud B2B.');
        }

        commerce.track('view_item_list', {
            item_list_id: 'catalogo_principal',
            item_list_name: 'Catálogo principal'
        });
    });
})();
