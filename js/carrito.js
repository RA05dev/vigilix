(function () {
    'use strict';

    const commerce = window.VigilixCommerce;
    let clearArmed = false;
    let lastRemoved = null;

    function showCartFeedback(message, allowUndo = false) {
        const box = document.getElementById('cart-feedback');
        if (!box) return;
        box.classList.remove('hidden');
        box.innerHTML = `
            <span>${message}</span>
            ${allowUndo ? '<button type="button" class="link-btn" id="undo-remove-btn">Deshacer</button>' : ''}
        `;
        if (allowUndo) {
            const undoBtn = document.getElementById('undo-remove-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', () => {
                    if (lastRemoved) {
                        commerce.addItem(lastRemoved.sku, lastRemoved.quantity);
                        lastRemoved = null;
                        box.classList.add('hidden');
                    }
                });
            }
        }
    }

    function renderRecommendations(cartSkus) {
        const section = document.getElementById('cart-recommendations');
        const grid = document.getElementById('recommended-grid');
        if (!section || !grid) return;

        const suggestions = Object.values(commerce.PRODUCTS)
            .filter(p => !cartSkus.has(p.sku) && p.filterGroup !== 'licencias')
            .slice(0, 4);

        if (!suggestions.length) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        grid.innerHTML = suggestions.map(item => `
            <article class="rec-card">
                <a href="producto.html?sku=${encodeURIComponent(item.sku)}" class="rec-thumb">
                    <img src="${commerce.escapeHtml(item.image)}" alt="${commerce.escapeHtml(item.name)}" ${item.fallbackImage ? `data-fb="${commerce.escapeHtml(item.fallbackImage)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}"` : ''}>
                </a>
                <div class="rec-body">
                    <small>${commerce.escapeHtml(item.brand || item.category)}</small>
                    <h3><a href="producto.html?sku=${encodeURIComponent(item.sku)}">${commerce.escapeHtml(item.shortName || item.name)}</a></h3>
                    <div class="rec-footer">
                        <strong>${commerce.formatMoney(item.price)}</strong>
                        <button type="button" class="button button-secondary button-sm" data-quick-add="${commerce.escapeHtml(item.sku)}">+ Agregar</button>
                    </div>
                </div>
            </article>
        `).join('');
    }

    function renderShippingProgress(sub) {
        const bar = document.getElementById('free-shipping-bar');
        if (!bar) return;
        const threshold = commerce.FREE_SHIPPING_THRESHOLD;
        const remaining = Math.max(0, threshold - sub);
        const pct = Math.min(100, Math.round((sub / threshold) * 100));

        bar.innerHTML = remaining > 0
            ? `<div class="shipping-progress-text">Te faltan <strong>${commerce.formatMoney(remaining)}</strong> para obtener <span>envío GRATIS</span> en Lima Metropolitana.</div><div class="shipping-progress-track"><div class="shipping-progress-fill" style="width:${pct}%"></div></div>`
            : `<div class="shipping-progress-text unlocked">✓ ¡Felicidades! Tu pedido califica para <strong>envío GRATIS</strong> en Lima Metropolitana.</div><div class="shipping-progress-track"><div class="shipping-progress-fill" style="width:100%"></div></div>`;
    }

    function renderCouponState(sub, discount) {
        const coupon = commerce.getCoupon();
        const discountRow = document.getElementById('discount-row');
        const discountValue = document.getElementById('discount-amount');
        const couponApplied = document.getElementById('coupon-applied');
        const couponInput = document.getElementById('coupon-input');

        if (coupon && discount > 0) {
            if (discountRow) discountRow.classList.remove('hidden');
            if (discountValue) discountValue.textContent = `− ${commerce.formatMoney(discount)}`;
            if (couponApplied) {
                couponApplied.classList.remove('hidden');
                couponApplied.innerHTML = `<span>Cupón <strong>${commerce.escapeHtml(coupon.code)}</strong> activo (${commerce.escapeHtml(coupon.label)})</span><button type="button" class="link-btn" id="remove-coupon-btn">Quitar</button>`;
                document.getElementById('remove-coupon-btn').addEventListener('click', () => {
                    commerce.clearCoupon();
                    if (couponInput) couponInput.value = '';
                });
            }
        } else {
            if (discountRow) discountRow.classList.add('hidden');
            if (couponApplied) couponApplied.classList.add('hidden');
        }
    }

    function renderCart() {
        const empty = document.getElementById('cart-empty');
        const layout = document.getElementById('cart-layout');
        const itemsContainer = document.getElementById('cart-items');
        const items = commerce.getDetailedCart();
        const cartSkus = new Set(items.map(i => i.sku));

        empty.classList.toggle('hidden', items.length > 0);
        layout.classList.toggle('hidden', items.length === 0);
        renderRecommendations(cartSkus);

        const countBadge = document.getElementById('cart-items-count');
        const totalUnits = commerce.count();
        if (countBadge) countBadge.textContent = `${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}`;

        if (!items.length) return;

        itemsContainer.innerHTML = items.map(item => `
            <article class="cart-row">
                <a href="producto.html?sku=${encodeURIComponent(item.sku)}" class="cart-thumb">
                    <img src="${commerce.escapeHtml(item.image)}" alt="${commerce.escapeHtml(item.name)}" ${item.fallbackImage ? `data-fb="${commerce.escapeHtml(item.fallbackImage)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}"` : ''}>
                </a>
                <div>
                    <span class="cart-category">${commerce.escapeHtml(item.category)}</span>
                    <p class="item-name"><a href="producto.html?sku=${encodeURIComponent(item.sku)}">${commerce.escapeHtml(item.name)}</a></p>
                    <div class="muted">SKU: ${commerce.escapeHtml(item.sku)} · ${commerce.formatMoney(item.price)} c/u</div>
                    <div class="qty-wrap">
                        <label for="qty-${commerce.escapeHtml(item.sku)}">Cantidad</label>
                        <div class="qty-stepper">
                            <button type="button" class="qty-step-btn" data-step="-1" data-sku="${commerce.escapeHtml(item.sku)}" aria-label="Disminuir cantidad">−</button>
                            <input id="qty-${commerce.escapeHtml(item.sku)}" type="number" min="1" max="99" value="${item.quantity}" data-qty="${commerce.escapeHtml(item.sku)}">
                            <button type="button" class="qty-step-btn" data-step="1" data-sku="${commerce.escapeHtml(item.sku)}" aria-label="Aumentar cantidad">+</button>
                        </div>
                        <button class="button button-danger" type="button" data-remove="${commerce.escapeHtml(item.sku)}">Eliminar</button>
                    </div>
                </div>
                <strong class="cart-price">${commerce.formatMoney(item.subtotal)}</strong>
            </article>
        `).join('');

        const sub = commerce.subtotal();
        const discount = commerce.discountAmount(sub);
        const estimatedTotal = Math.max(0, sub - discount);
        const shippingPreview = document.getElementById('shipping-preview');

        document.getElementById('subtotal').textContent = commerce.formatMoney(sub);
        document.getElementById('total').textContent = commerce.formatMoney(estimatedTotal);
        if (shippingPreview) {
            shippingPreview.textContent = sub >= commerce.FREE_SHIPPING_THRESHOLD
                ? 'Gratis (Lima)'
                : 'Desde S/ 10.00 o Recojo Gratis';
        }

        renderShippingProgress(sub);
        renderCouponState(sub, discount);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const itemsContainer = document.getElementById('cart-items');
        const recommendedGrid = document.getElementById('recommended-grid');
        const couponForm = document.getElementById('coupon-form');
        const couponMessage = document.getElementById('coupon-message');
        const clearBtn = document.getElementById('clear-cart-btn');
        const quoteCartBtn = document.getElementById('quote-cart-btn');
        const continueBtn = document.getElementById('continue-button');

        itemsContainer.addEventListener('change', event => {
            const sku = event.target.dataset.qty;
            if (sku) commerce.updateQuantity(sku, Number(event.target.value));
        });

        itemsContainer.addEventListener('click', event => {
            const stepBtn = event.target.closest('[data-step]');
            if (stepBtn) {
                const sku = stepBtn.dataset.sku;
                const delta = Number(stepBtn.dataset.step);
                const current = commerce.getCart().find(entry => entry.sku === sku);
                if (current) commerce.updateQuantity(sku, current.quantity + delta);
                return;
            }
            const removeBtn = event.target.closest('[data-remove]');
            if (removeBtn) {
                const sku = removeBtn.dataset.remove;
                const existing = commerce.getDetailedCart().find(entry => entry.sku === sku);
                if (existing) {
                    lastRemoved = { sku: existing.sku, quantity: existing.quantity, name: existing.shortName || existing.name };
                    commerce.removeItem(sku);
                    showCartFeedback(`Se eliminó <strong>${commerce.escapeHtml(lastRemoved.name)}</strong> del carrito.`, true);
                }
            }
        });

        if (recommendedGrid) {
            recommendedGrid.addEventListener('click', event => {
                const btn = event.target.closest('[data-quick-add]');
                if (!btn) return;
                const sku = btn.dataset.quickAdd;
                const product = commerce.PRODUCTS[sku];
                if (!product) return;
                commerce.addItem(sku, 1);
                showCartFeedback(`Agregaste <strong>${commerce.escapeHtml(product.shortName || product.name)}</strong> a tu carrito.`);
            });
        }

        if (couponForm) {
            couponForm.addEventListener('submit', event => {
                event.preventDefault();
                const input = document.getElementById('coupon-input');
                const code = String(input.value || '').trim().toUpperCase();
                const result = commerce.applyCoupon(code);
                commerce.trackEvent('aplicar_cupon', {
                    codigo_cupon: code || 'vacio',
                    estado_cupon: result.ok ? 'valido' : 'invalido'
                });
                if (couponMessage) {
                    couponMessage.textContent = result.message;
                    couponMessage.className = `coupon-msg ${result.ok ? 'ok' : 'err'}`;
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (!clearArmed) {
                    clearArmed = true;
                    clearBtn.textContent = '¿Confirmar vaciar carrito?';
                    setTimeout(() => {
                        clearArmed = false;
                        clearBtn.textContent = 'Vaciar carrito';
                    }, 3500);
                    return;
                }
                clearArmed = false;
                clearBtn.textContent = 'Vaciar carrito';
                commerce.clearCart();
                showCartFeedback('Se vació el carrito correctamente.');
            });
        }

        if (quoteCartBtn) {
            quoteCartBtn.addEventListener('click', () => {
                if (commerce.saveQuoteDraftFromCart()) {
                    commerce.trackEvent('cotizar_desde_carrito', {
                        cantidad_items: commerce.count(),
                        valor_estimado: Number(Math.max(0, commerce.subtotal() - commerce.discountAmount()).toFixed(2))
                    });
                    location.href = 'index.html#cotizar';
                }
            });
        }

        if (continueBtn) {
            continueBtn.addEventListener('click', () => commerce.trackCartEvent('begin_checkout'));
        }

        window.addEventListener('vigilix:cart-updated', renderCart);
        commerce.trackCartEvent('view_cart');
        renderCart();
    });
})();
