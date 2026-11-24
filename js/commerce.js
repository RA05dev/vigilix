(function () {
    'use strict';

    const CART_KEY = 'vigilix_cart_v1';
    const SHIPPING_KEY = 'vigilix_shipping_v1';
    const ORDER_KEY = 'vigilix_last_order_v1';
    const COUPON_KEY = 'vigilix_coupon_v1';
    const QUOTE_DRAFT_KEY = 'vigilix_quote_draft_v1';
    const FREE_SHIPPING_THRESHOLD = 500;
    const WHATSAPP_NUMBER = '51987654321';

    const PRODUCTS = window.VigilixProducts || {};

    const COUPONS = {
        'VIGILIX10': { code: 'VIGILIX10', type: 'percent', value: 10, minSubtotal: 100, label: '10% de descuento en tu compra' },
        'PROYECTO5': { code: 'PROYECTO5', type: 'percent', value: 5, minSubtotal: 0, label: '5% de descuento para integradores' },
        'BIENVENIDO': { code: 'BIENVENIDO', type: 'fixed', value: 20, minSubtotal: 150, label: 'S/ 20.00 de descuento de bienvenida' }
    };

    const PAYMENT_METHODS = {
        'tarjeta': {
            id: 'tarjeta',
            label: 'Tarjeta de Crédito / Débito',
            shortLabel: 'Tarjeta',
            description: 'Visa, Mastercard, Amex o Diners con validación inmediata.',
            statusLabel: 'Pago aprobado',
            statusColor: 'var(--green)'
        },
        'yape': {
            id: 'yape',
            label: 'Yape',
            shortLabel: 'Yape',
            description: 'Escanea el QR o yapea al 987 654 321 (Vigilix Security S.A.C.).',
            statusLabel: 'Verificando comprobante Yape',
            statusColor: '#c084fc'
        },
        'plin': {
            id: 'plin',
            label: 'Plin',
            shortLabel: 'Plin',
            description: 'Escanea el QR o plinea al 987 654 321 (BBVA / Interbank / Scotiabank).',
            statusLabel: 'Verificando comprobante Plin',
            statusColor: 'var(--cyan)'
        },
        'cash-on-delivery': {
            id: 'cash-on-delivery',
            label: 'Pago contraentrega',
            shortLabel: 'Contraentrega',
            description: 'Paga en efectivo o con POS al momento de recibir tu pedido.',
            statusLabel: 'Pendiente de confirmación',
            statusColor: 'var(--amber)'
        }
    };

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[char]));
    }

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getCart() {
        const cart = readJson(CART_KEY, []);
        if (!Array.isArray(cart)) return [];
        return cart.filter(item => PRODUCTS[item.sku] && Number.isInteger(item.quantity) && item.quantity > 0);
    }

    function saveCart(cart) {
        writeJson(CART_KEY, cart);
        window.dispatchEvent(new CustomEvent('vigilix:cart-updated', { detail: cart }));
    }

    function addItem(sku, quantity = 1) {
        if (!PRODUCTS[sku]) throw new Error('Producto no disponible');
        const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
        const cart = getCart();
        const existing = cart.find(item => item.sku === sku);
        if (existing) existing.quantity = Math.min(99, existing.quantity + qty);
        else cart.push({ sku, quantity: qty });
        saveCart(cart);
        track('add_to_cart', { items: [gaItem(PRODUCTS[sku], qty)], value: PRODUCTS[sku].price * qty });
        return cart;
    }

    function updateQuantity(sku, quantity) {
        const next = Math.max(0, Math.min(99, Math.floor(Number(quantity) || 0)));
        const cart = getCart();
        const item = cart.find(entry => entry.sku === sku);
        if (!item) return cart;
        if (next === 0) return removeItem(sku);
        item.quantity = next;
        saveCart(cart);
        return cart;
    }

    function removeItem(sku) {
        const product = PRODUCTS[sku];
        const current = getCart().find(item => item.sku === sku);
        const cart = getCart().filter(item => item.sku !== sku);
        saveCart(cart);
        if (product && current) {
            track('remove_from_cart', {
                items: [gaItem(product, current.quantity)],
                value: product.price * current.quantity
            });
        }
        return cart;
    }

    function clearCart() {
        saveCart([]);
        clearCoupon();
    }

    function getDetailedCart() {
        return getCart().map(item => ({
            ...PRODUCTS[item.sku],
            quantity: item.quantity,
            subtotal: Number((PRODUCTS[item.sku].price * item.quantity).toFixed(2))
        }));
    }

    function subtotal() {
        return Number(getDetailedCart().reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    }

    function count() {
        return getCart().reduce((sum, item) => sum + item.quantity, 0);
    }

    function getCoupon() {
        const saved = readJson(COUPON_KEY, null);
        if (!saved || !COUPONS[saved.code]) return null;
        return COUPONS[saved.code];
    }

    function applyCoupon(rawCode) {
        const code = String(rawCode || '').trim().toUpperCase();
        const coupon = COUPONS[code];
        if (!coupon) return { ok: false, message: 'Cupón no válido. Prueba VIGILIX10 o PROYECTO5.' };
        const currentSubtotal = subtotal();
        if (currentSubtotal < coupon.minSubtotal) {
            return {
                ok: false,
                message: `Este cupón requiere una compra mínima de ${formatMoney(coupon.minSubtotal)}.`
            };
        }
        writeJson(COUPON_KEY, { code: coupon.code });
        window.dispatchEvent(new CustomEvent('vigilix:cart-updated', { detail: getCart() }));
        return { ok: true, coupon, message: `Cupón ${coupon.code} aplicado: ${coupon.label}.` };
    }

    function clearCoupon() {
        localStorage.removeItem(COUPON_KEY);
        window.dispatchEvent(new CustomEvent('vigilix:cart-updated', { detail: getCart() }));
    }

    function discountAmount(baseSubtotal = subtotal()) {
        const coupon = getCoupon();
        if (!coupon || baseSubtotal < coupon.minSubtotal) return 0;
        if (coupon.type === 'percent') return Number(((baseSubtotal * coupon.value) / 100).toFixed(2));
        return Math.min(baseSubtotal, coupon.value);
    }

    function formatMoney(value) {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value) || 0);
    }

    function gaItem(product, quantity) {
        return {
            item_id: product.sku,
            item_name: product.name,
            item_category: product.category,
            price: product.price,
            quantity
        };
    }

    function track(eventName, ecommerce = {}) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ ecommerce: null });
        window.dataLayer.push({ event: eventName, ecommerce: { currency: 'PEN', ...ecommerce } });
    }

    function trackEvent(eventName, params = {}) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: eventName, ...params });
    }

    function trackCartEvent(eventName, extra = {}) {
        const items = getDetailedCart();
        const coupon = getCoupon();
        const sub = subtotal();
        const discount = discountAmount(sub);
        track(eventName, {
            items: items.map(item => gaItem(item, item.quantity)),
            value: Number(Math.max(0, sub - discount).toFixed(2)),
            ...(coupon ? { coupon: coupon.code, discount } : {}),
            ...extra
        });
    }

    function saveShipping(data) {
        writeJson(SHIPPING_KEY, data);
    }

    function getShipping() {
        return readJson(SHIPPING_KEY, null);
    }

    function shippingCost(method, currentSubtotal = subtotal()) {
        if (method === 'pickup') return 0;
        if (method === 'delivery-provincia') return 25;
        if (method === 'delivery-lima') return currentSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 10;
        return 0;
    }

    function shippingMethodLabel(method) {
        if (method === 'pickup') return 'Recojo coordinado';
        if (method === 'delivery-provincia') return 'Envío a Provincias (Shalom / Olva)';
        return 'Envío en Lima Metropolitana';
    }

    function saveQuoteDraftFromCart() {
        const items = getDetailedCart();
        if (!items.length) return false;
        const lines = items.map(item => `• ${item.quantity}x [${item.sku}] ${item.name} (${formatMoney(item.subtotal)})`);
        const total = Number(Math.max(0, subtotal() - discountAmount()).toFixed(2));
        writeJson(QUOTE_DRAFT_KEY, {
            text: `Solicito cotización formal B2B para los siguientes equipos:\n${lines.join('\n')}\nTotal referencial web: ${formatMoney(total)}`,
            total
        });
        return true;
    }

    function consumeQuoteDraft() {
        const draft = readJson(QUOTE_DRAFT_KEY, null);
        if (draft) localStorage.removeItem(QUOTE_DRAFT_KEY);
        return draft;
    }

    function makeOrder(paymentInfo = {}) {
        const items = getDetailedCart();
        const shipping = getShipping();
        if (!items.length || !shipping) throw new Error('El pedido está incompleto');

        const sub = subtotal();
        const coupon = getCoupon();
        const discount = discountAmount(sub);
        const deliveryCost = shippingCost(shipping.deliveryMethod, sub);
        const total = Number(Math.max(0, sub - discount + deliveryCost).toFixed(2));
        const methodKey = PAYMENT_METHODS[paymentInfo.method] ? paymentInfo.method : 'cash-on-delivery';
        const methodMeta = PAYMENT_METHODS[methodKey];
        const now = new Date();

        const order = {
            id: `VGX-${now.getFullYear()}-${String(Date.now()).slice(-6)}`,
            createdAt: now.toISOString(),
            items,
            shipping,
            subtotal: sub,
            coupon: coupon ? coupon.code : null,
            discount,
            shippingCost: deliveryCost,
            total,
            paymentMethod: methodKey,
            paymentLabel: methodMeta.label,
            paymentDetail: paymentInfo.detail || methodMeta.description,
            paymentMeta: paymentInfo.meta || {},
            invoice: paymentInfo.invoice || { type: 'boleta', docNumber: '', businessName: '' },
            status: methodKey === 'tarjeta' ? 'paid' : 'pending-confirmation',
            statusLabel: methodMeta.statusLabel
        };

        writeJson(ORDER_KEY, order);
        track('purchase', {
            transaction_id: order.id,
            value: order.total,
            shipping: order.shippingCost,
            payment_type: order.paymentMethod,
            tipo_comprobante: order.invoice.type,
            ...(order.coupon ? { coupon: order.coupon, discount: order.discount } : {}),
            items: items.map(item => gaItem(item, item.quantity))
        });
        clearCart();
        return order;
    }

    function getLastOrder() {
        return readJson(ORDER_KEY, null);
    }

    function whatsappUrl(message) {
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(String(message || 'Hola Vigilix, deseo información comercial.'))}`;
    }

    async function syncOrderToServer(order, endpoint = '../guardar_pedido.php') {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            });
            const result = await response.json();
            if (result && result.exito) {
                order.serverSaved = true;
                order.serverRecordId = result.id_registro || null;
                writeJson(ORDER_KEY, order);
                return result;
            }
        } catch (error) {
            // Modo estático / sin backend PHP: el pedido ya quedó guardado localmente
        }
        return null;
    }

    window.VigilixCommerce = {
        PRODUCTS,
        COUPONS,
        PAYMENT_METHODS,
        FREE_SHIPPING_THRESHOLD,
        WHATSAPP_NUMBER,
        escapeHtml,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        getCart,
        getDetailedCart,
        subtotal,
        count,
        getCoupon,
        applyCoupon,
        clearCoupon,
        discountAmount,
        formatMoney,
        track,
        trackEvent,
        trackCartEvent,
        saveShipping,
        getShipping,
        shippingCost,
        shippingMethodLabel,
        saveQuoteDraftFromCart,
        consumeQuoteDraft,
        makeOrder,
        getLastOrder,
        whatsappUrl,
        syncOrderToServer
    };
})();
