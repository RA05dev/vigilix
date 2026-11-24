(function () {
    'use strict';

    const commerce = window.VigilixCommerce;

    function getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(title, message, options = {}) {
        const container = getToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${options.variant ? `toast-${options.variant}` : ''}`.trim();
        const iconClass = options.icon || 'fa-circle-check';
        const actionHtml = options.actionLabel
            ? `<button type="button" class="toast-action">${commerce.escapeHtml(options.actionLabel)}</button>`
            : '';

        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="toast-content">
                <h5>${commerce.escapeHtml(title)}</h5>
                <p>${message}</p>
                ${actionHtml}
            </div>
        `;

        if (options.actionLabel && typeof options.onAction === 'function') {
            toast.querySelector('.toast-action').addEventListener('click', () => {
                options.onAction();
                toast.remove();
            });
        }

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 350);
        }, options.duration || 3600);
    }

    function updateCartCounters(animate = false) {
        const totalItems = commerce.count();
        document.querySelectorAll('.cart-counter').forEach(counter => {
            counter.textContent = totalItems;
            if (animate) {
                counter.style.transform = 'scale(1.38)';
                setTimeout(() => { counter.style.transform = 'scale(1)'; }, 220);
            }
        });
    }

    function ensureCartDrawer() {
        if (document.getElementById('vx-cart-drawer')) return;
        const backdrop = document.createElement('div');
        backdrop.id = 'vx-cart-backdrop';
        backdrop.className = 'cart-drawer-backdrop';
        backdrop.addEventListener('click', closeCartDrawer);

        const drawer = document.createElement('aside');
        drawer.id = 'vx-cart-drawer';
        drawer.className = 'cart-drawer';
        drawer.setAttribute('aria-label', 'Resumen rápido del carrito');
        drawer.innerHTML = `
            <div class="cart-drawer-header">
                <h3><i class="fa-solid fa-cart-shopping"></i> Tu carrito <span id="vx-drawer-count">0</span></h3>
                <button type="button" class="cart-drawer-close" aria-label="Cerrar carrito"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="vx-drawer-shipping-bar" class="drawer-shipping-bar"></div>
            <div id="vx-drawer-body" class="cart-drawer-body"></div>
            <div id="vx-drawer-footer" class="cart-drawer-footer"></div>
        `;

        drawer.querySelector('.cart-drawer-close').addEventListener('click', closeCartDrawer);
        drawer.addEventListener('click', event => {
            const dec = event.target.closest('[data-drawer-dec]');
            const inc = event.target.closest('[data-drawer-inc]');
            const rem = event.target.closest('[data-drawer-remove]');
            if (dec) {
                const sku = dec.dataset.drawerDec;
                const item = commerce.getCart().find(entry => entry.sku === sku);
                if (item) commerce.updateQuantity(sku, item.quantity - 1);
            } else if (inc) {
                const sku = inc.dataset.drawerInc;
                const item = commerce.getCart().find(entry => entry.sku === sku);
                if (item) commerce.updateQuantity(sku, item.quantity + 1);
            } else if (rem) {
                commerce.removeItem(rem.dataset.drawerRemove);
            }
        });

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);
    }

    function renderCartDrawer() {
        const drawer = document.getElementById('vx-cart-drawer');
        if (!drawer) return;
        const items = commerce.getDetailedCart();
        const sub = commerce.subtotal();
        const count = commerce.count();
        const threshold = commerce.FREE_SHIPPING_THRESHOLD;
        const remaining = Math.max(0, threshold - sub);
        const pct = Math.min(100, Math.round((sub / threshold) * 100));

        document.getElementById('vx-drawer-count').textContent = count;
        const bar = document.getElementById('vx-drawer-shipping-bar');
        const body = document.getElementById('vx-drawer-body');
        const footer = document.getElementById('vx-drawer-footer');

        if (!items.length) {
            bar.innerHTML = '';
            body.innerHTML = `
                <div class="drawer-empty">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <p>Tu carrito está vacío</p>
                    <small>Agrega equipos de videovigilancia, incendios o redes.</small>
                </div>
            `;
            footer.innerHTML = `<a href="index.html#equipos" class="btn-outline drawer-btn" onclick="VigilixUI.closeCartDrawer()">Explorar catálogo</a>`;
            return;
        }

        bar.innerHTML = remaining > 0
            ? `<div class="shipping-progress-text">Agrega <strong>${commerce.formatMoney(remaining)}</strong> más para <span>envío GRATIS</span> en Lima</div><div class="shipping-progress-track"><div class="shipping-progress-fill" style="width:${pct}%"></div></div>`
            : `<div class="shipping-progress-text unlocked"><i class="fa-solid fa-truck-fast"></i> ¡Tienes <strong>envío GRATIS</strong> en Lima Metropolitana!</div><div class="shipping-progress-track"><div class="shipping-progress-fill" style="width:100%"></div></div>`;

        body.innerHTML = items.map(item => `
            <div class="drawer-item">
                <img src="${commerce.escapeHtml(item.image)}" alt="${commerce.escapeHtml(item.name)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}" data-fb="${commerce.escapeHtml(item.fallbackImage || '')}">
                <div class="drawer-item-info">
                    <a href="producto.html?sku=${encodeURIComponent(item.sku)}" class="drawer-item-title">${commerce.escapeHtml(item.shortName || item.name)}</a>
                    <div class="drawer-item-price">${commerce.formatMoney(item.price)} c/u</div>
                    <div class="drawer-qty-row">
                        <div class="mini-stepper">
                            <button type="button" data-drawer-dec="${commerce.escapeHtml(item.sku)}" aria-label="Reducir cantidad">−</button>
                            <span>${item.quantity}</span>
                            <button type="button" data-drawer-inc="${commerce.escapeHtml(item.sku)}" aria-label="Aumentar cantidad">+</button>
                        </div>
                        <button type="button" class="drawer-remove" data-drawer-remove="${commerce.escapeHtml(item.sku)}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
                <strong class="drawer-item-sub">${commerce.formatMoney(item.subtotal)}</strong>
            </div>
        `).join('');

        footer.innerHTML = `
            <div class="drawer-total-row">
                <span>Subtotal (${count} ${count === 1 ? 'ud.' : 'uds.'})</span>
                <strong>${commerce.formatMoney(sub)}</strong>
            </div>
            <div class="drawer-payment-pills">
                <span><i class="fa-regular fa-credit-card"></i> Tarjeta</span>
                <span class="pill-yape">Yape</span>
                <span class="pill-plin">Plin</span>
                <span>Contraentrega</span>
            </div>
            <div class="drawer-actions">
                <a href="carrito.html" class="btn-outline drawer-btn">Ver carrito completo</a>
                <a href="checkout/envio.html" class="btn-primary drawer-btn" onclick="VigilixCommerce.trackCartEvent('begin_checkout')">Ir a pagar →</a>
            </div>
        `;
    }

    function openCartDrawer() {
        ensureCartDrawer();
        renderCartDrawer();
        document.getElementById('vx-cart-backdrop').classList.add('open');
        document.getElementById('vx-cart-drawer').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCartDrawer() {
        const backdrop = document.getElementById('vx-cart-backdrop');
        const drawer = document.getElementById('vx-cart-drawer');
        if (backdrop) backdrop.classList.remove('open');
        if (drawer) drawer.classList.remove('open');
        document.body.style.overflow = '';
    }

    function setupMobileMenu() {
        const toggle = document.querySelector('.mobile-menu-toggle');
        const nav = document.querySelector('.nav-menu');
        if (!toggle || !nav) return;

        toggle.addEventListener('click', () => {
            const open = nav.classList.toggle('mobile-open');
            toggle.setAttribute('aria-expanded', String(open));
            const icon = toggle.querySelector('i');
            if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
        });

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('mobile-open');
                toggle.setAttribute('aria-expanded', 'false');
                const icon = toggle.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-bars';
            });
        });
    }

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeCartDrawer();
    });

    window.addEventListener('vigilix:cart-updated', () => {
        updateCartCounters(false);
        renderCartDrawer();
    });

    document.addEventListener('DOMContentLoaded', () => {
        updateCartCounters(false);
        setupMobileMenu();
    });

    window.VigilixUI = {
        showToast,
        updateCartCounters,
        openCartDrawer,
        closeCartDrawer,
        renderCartDrawer
    };
})();
