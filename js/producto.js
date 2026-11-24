(function () {
    'use strict';

    const commerce = window.VigilixCommerce;
    const ui = window.VigilixUI;
    const params = new URLSearchParams(location.search);
    const sku = params.get('sku');
    const product = commerce.PRODUCTS[sku];

    function selectedQuantity() {
        const input = document.getElementById('quantity');
        const value = Math.max(1, Math.min(20, Math.floor(Number(input.value) || 1)));
        input.value = value;
        return value;
    }

    function stepQuantity(delta) {
        const input = document.getElementById('quantity');
        if (!input) return;
        const next = Math.max(1, Math.min(20, (Number(input.value) || 1) + delta));
        input.value = next;
    }

    function addSelected() {
        if (!product) return;
        const quantity = selectedQuantity();
        commerce.addItem(sku, quantity);
        ui.updateCartCounters(true);
        ui.showToast(
            'Carrito actualizado',
            `${quantity} ${quantity === 1 ? 'unidad agregada' : 'unidades agregadas'} de <strong>${commerce.escapeHtml(product.shortName || product.name)}</strong>.`,
            {
                actionLabel: 'Ver carrito rápido',
                onAction: () => ui.openCartDrawer()
            }
        );
    }

    function addRelatedProduct(targetSku) {
        const item = commerce.PRODUCTS[targetSku];
        if (!item) return;
        commerce.addItem(targetSku, 1);
        ui.updateCartCounters(true);
        ui.showToast('Agregado', `<strong>${commerce.escapeHtml(item.shortName || item.name)}</strong> añadido al carrito.`, {
            actionLabel: 'Ver carrito rápido',
            onAction: () => ui.openCartDrawer()
        });
    }

    function buyNow() {
        if (!product) return;
        commerce.addItem(sku, selectedQuantity());
        location.href = 'carrito.html';
    }

    function injectProductSeo(current) {
        const setMeta = (selector, content) => {
            const tag = document.querySelector(selector);
            if (tag) tag.setAttribute('content', content);
        };
        setMeta('meta[name="description"]', `${current.name} (${current.sku}) — ${current.description} Precio: ${commerce.formatMoney(current.price)}.`);
        setMeta('meta[property="og:title"]', `${current.name} | Vigilix`);
        setMeta('meta[property="og:description"]', `${current.description} Precio online: ${commerce.formatMoney(current.price)}.`);

        const jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            sku: current.sku,
            name: current.name,
            description: current.description,
            brand: { '@type': 'Brand', name: current.brand || 'Vigilix' },
            category: current.category,
            offers: {
                '@type': 'Offer',
                priceCurrency: 'PEN',
                price: current.price,
                availability: 'https://schema.org/InStock',
                url: location.href
            }
        };
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(jsonLd);
        document.head.appendChild(script);
    }

    function renderRelated(current) {
        const container = document.getElementById('related-products');
        if (!container) return;
        const related = Object.values(commerce.PRODUCTS)
            .filter(item => item.sku !== current.sku && item.filterGroup === current.filterGroup)
            .slice(0, 4);

        if (!related.length) {
            const section = container.closest('section');
            if (section) section.classList.add('hidden');
            return;
        }

        container.innerHTML = related.map(item => `
            <article class="featured-card">
                <a href="producto.html?sku=${encodeURIComponent(item.sku)}">
                    <img src="${commerce.escapeHtml(item.image)}" alt="${commerce.escapeHtml(item.name)}" loading="lazy" ${item.fallbackImage ? `data-fb="${commerce.escapeHtml(item.fallbackImage)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}"` : ''}>
                </a>
                <div>
                    <span>${commerce.escapeHtml(item.brand || item.category)}</span>
                    <h3><a href="producto.html?sku=${encodeURIComponent(item.sku)}">${commerce.escapeHtml(item.shortName || item.name)}</a></h3>
                    <strong>${commerce.formatMoney(item.price)}</strong>
                    <div class="featured-actions">
                        <a href="producto.html?sku=${encodeURIComponent(item.sku)}">Ver detalles</a>
                        <button type="button" onclick="addRelatedProduct('${commerce.escapeHtml(item.sku)}')" title="Agregar al carrito">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </article>
        `).join('');
    }

    window.addSelected = addSelected;
    window.addRelatedProduct = addRelatedProduct;
    window.buyNow = buyNow;
    window.stepQuantity = stepQuantity;

    document.addEventListener('DOMContentLoaded', () => {
        if (!product) {
            document.getElementById('product-missing').classList.remove('hidden');
            return;
        }

        document.getElementById('product-content').classList.remove('hidden');
        document.title = `${product.name} | Vigilix`;
        document.getElementById('breadcrumb-name').textContent = product.name;
        document.getElementById('product-category').textContent = product.category;
        document.getElementById('product-name').textContent = product.name;
        document.getElementById('product-description').textContent = product.description;
        document.getElementById('product-sku').textContent = product.sku;
        document.getElementById('product-price').textContent = commerce.formatMoney(product.price);

        const waBtn = document.getElementById('product-whatsapp-btn');
        if (waBtn) {
            waBtn.href = commerce.whatsappUrl(
                `Hola Vigilix, me interesa el producto: ${product.name} (SKU: ${product.sku}) publicado a ${commerce.formatMoney(product.price)}. ¿Tienen stock disponible?`
            );
            waBtn.addEventListener('click', () => {
                commerce.trackEvent('contacto_whatsapp', {
                    ubicacion: 'producto',
                    sku: product.sku,
                    numero_pedido: ''
                });
            });
        }

        const img = document.getElementById('product-image');
        img.src = product.image;
        img.alt = product.name;
        if (product.fallbackImage) {
            img.onerror = () => {
                if (img.src !== product.fallbackImage) img.src = product.fallbackImage;
            };
        }

        document.getElementById('cta-name').textContent = `${product.shortName || product.name} listo para tu proyecto`;
        document.getElementById('product-features').innerHTML = product.features
            .map(item => `<li><i class="fa-solid fa-check"></i> ${commerce.escapeHtml(item)}</li>`)
            .join('');

        const icons = ['fa-shield-halved', 'fa-gears', 'fa-diagram-project', 'fa-circle-check'];
        document.getElementById('feature-cards').innerHTML = product.features
            .map((item, index) => `
                <article class="detail-card">
                    <i class="fa-solid ${icons[index % icons.length]}"></i>
                    <h3>${commerce.escapeHtml(item)}</h3>
                    <p>Característica integrada para mejorar la operación y confiabilidad del sistema.</p>
                </article>
            `).join('');

        document.getElementById('spec-table').innerHTML = Object.entries(product.specs)
            .map(([key, value]) => `<tr><th>${commerce.escapeHtml(key)}</th><td>${commerce.escapeHtml(value)}</td></tr>`)
            .join('');

        injectProductSeo(product);
        renderRelated(product);

        commerce.track('view_item', {
            value: product.price,
            items: [{
                item_id: product.sku,
                item_name: product.name,
                item_category: product.category,
                price: product.price,
                quantity: 1
            }]
        });
    });
})();
