(function () {
    'use strict';

    const commerce = window.VigilixCommerce;

    function renderOrderSummary(deliveryMethod) {
        const itemsEl = document.getElementById('summary-items');
        const subEl = document.getElementById('subtotal');
        const shippingEl = document.getElementById('shipping-cost');
        const totalEl = document.getElementById('total');
        const discountRow = document.getElementById('summary-discount-row');
        const discountEl = document.getElementById('summary-discount');

        const items = commerce.getDetailedCart();
        const sub = commerce.subtotal();
        const discount = commerce.discountAmount(sub);
        const cost = commerce.shippingCost(deliveryMethod, sub);
        const finalTotal = Number(Math.max(0, sub - discount + cost).toFixed(2));

        if (itemsEl) {
            itemsEl.innerHTML = items.map(item => `
                <div class="summary-line">
                    <span>${item.quantity} × ${commerce.escapeHtml(item.shortName || item.name)}</span>
                    <strong>${commerce.formatMoney(item.subtotal)}</strong>
                </div>
            `).join('');
        }
        if (subEl) subEl.textContent = commerce.formatMoney(sub);
        if (discountRow && discountEl) {
            discountRow.classList.toggle('hidden', discount <= 0);
            discountEl.textContent = `− ${commerce.formatMoney(discount)}`;
        }
        if (shippingEl) shippingEl.textContent = cost ? commerce.formatMoney(cost) : 'Gratis';
        if (totalEl) totalEl.textContent = commerce.formatMoney(finalTotal);

        document.querySelectorAll('[data-order-total]').forEach(node => {
            node.textContent = commerce.formatMoney(finalTotal);
        });

        return { sub, discount, cost, finalTotal };
    }

    // === PASO 2: ENVÍO ===
    function initShippingPage() {
        if (!commerce.count()) {
            location.replace('../carrito.html');
            return;
        }

        const form = document.getElementById('shipping-form');
        const addressFields = document.getElementById('address-fields');
        const address = document.getElementById('address');
        const district = document.getElementById('district');
        const limaLabel = document.getElementById('lima-price-label');

        if (limaLabel) {
            const isFree = commerce.subtotal() >= commerce.FREE_SHIPPING_THRESHOLD;
            limaLabel.textContent = isFree ? 'Envío en Lima Metropolitana — ¡Gratis!' : 'Envío en Lima Metropolitana — S/ 10.00';
        }

        function selectedMethod() {
            return form.elements.deliveryMethod.value;
        }

        function toggleAddress() {
            const needsAddress = selectedMethod() !== 'pickup';
            addressFields.classList.toggle('hidden', !needsAddress);
            address.required = needsAddress;
            district.required = needsAddress;
            renderOrderSummary(selectedMethod());
        }

        const previous = commerce.getShipping();
        if (previous) {
            Object.entries(previous).forEach(([key, value]) => {
                const field = form.elements[key];
                if (!field) return;
                if (field instanceof RadioNodeList) {
                    const radio = [...field].find(item => item.value === value);
                    if (radio) radio.checked = true;
                } else {
                    field.value = value;
                }
            });
        }

        form.addEventListener('change', event => {
            if (event.target.name === 'deliveryMethod') toggleAddress();
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            const err = document.getElementById('form-error');
            if (!form.reportValidity()) {
                if (err) err.textContent = 'Completa los campos obligatorios para continuar al pago.';
                return;
            }
            if (err) err.textContent = '';
            const data = Object.fromEntries(new FormData(form).entries());
            commerce.saveShipping(data);
            commerce.trackCartEvent('add_shipping_info', { shipping_tier: data.deliveryMethod });
            location.href = 'pago.html';
        });

        toggleAddress();
    }

    // === PASO 3: PAGO CON ACORDEÓN COLAPSABLE + BOLETA/FACTURA ===
    function detectCardBrand(digits) {
        if (/^4/.test(digits)) return { name: 'Visa', badge: 'VISA' };
        if (/^(5[1-5]|2[2-7])/.test(digits)) return { name: 'Mastercard', badge: 'MASTERCARD' };
        if (/^3[47]/.test(digits)) return { name: 'American Express', badge: 'AMEX' };
        if (/^3(?:0[0-5]|[68])/.test(digits)) return { name: 'Diners Club', badge: 'DINERS' };
        return { name: 'Tarjeta', badge: 'TARJETA' };
    }

    function luhnValid(digits) {
        if (digits.length < 13 || digits.length > 19) return false;
        let sum = 0;
        let alt = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let n = parseInt(digits[i], 10);
            if (alt) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alt = !alt;
        }
        return sum % 10 === 0;
    }

    function initPaymentPage() {
        const shipping = commerce.getShipping();
        if (!commerce.count()) {
            location.replace('../carrito.html');
            return;
        }
        if (!shipping) {
            location.replace('envio.html');
            return;
        }

        renderOrderSummary(shipping.deliveryMethod);

        const deliveryText = shipping.deliveryMethod === 'pickup'
            ? 'Recojo coordinado en tienda / almacén'
            : `${commerce.shippingMethodLabel(shipping.deliveryMethod)} — ${shipping.address}, ${shipping.district}${shipping.reference ? ` (Ref.: ${shipping.reference})` : ''}`;

        document.getElementById('shipping-summary').innerHTML = `
            <strong style="color:#f8fafc">${commerce.escapeHtml(shipping.name)}</strong><br>
            ${commerce.escapeHtml(deliveryText)}<br>
            ${commerce.escapeHtml(shipping.phone)} · ${commerce.escapeHtml(shipping.email)}
        `;

        const triggers = document.querySelectorAll('[data-payment-toggle]');
        const panels = document.querySelectorAll('[data-payment-panel]');
        const finishBtn = document.getElementById('finish');
        const errorBox = document.getElementById('error');

        const cardNumber = document.getElementById('card-number');
        const cardName = document.getElementById('card-name');
        const cardExpiry = document.getElementById('card-expiry');
        const cardCvv = document.getElementById('card-cvv');
        const cardBrandBadge = document.getElementById('card-brand-badge');

        const invoiceRadios = document.querySelectorAll('input[name="invoiceType"]');
        const boletaFields = document.getElementById('boleta-fields');
        const facturaFields = document.getElementById('factura-fields');

        let expandedMethod = 'tarjeta';

        function currentMethod() {
            const checked = document.querySelector('input[name="paymentMethod"]:checked');
            return checked ? checked.value : 'tarjeta';
        }

        function currentInvoiceType() {
            const checked = document.querySelector('input[name="invoiceType"]:checked');
            return checked ? checked.value : 'boleta';
        }

        function syncAccordionUI(trackSelection = false) {
            const selected = currentMethod();
            panels.forEach(panel => {
                const isOpen = panel.dataset.paymentPanel === expandedMethod;
                panel.classList.toggle('hidden', !isOpen);
            });
            triggers.forEach(trigger => {
                const method = trigger.dataset.paymentToggle;
                const isOpen = method === expandedMethod;
                trigger.setAttribute('aria-expanded', String(isOpen));
                trigger.classList.toggle('is-open', isOpen);
            });

            const ctaLabels = {
                'tarjeta': 'Pagar con tarjeta ahora',
                'yape': 'Confirmar pago con Yape',
                'plin': 'Confirmar pago con Plin',
                'cash-on-delivery': 'Generar pedido contraentrega'
            };
            finishBtn.textContent = ctaLabels[selected] || 'Generar pedido';
            errorBox.textContent = '';

            if (trackSelection) {
                commerce.trackCartEvent('add_payment_info', { payment_type: selected });
            }
        }

        triggers.forEach(trigger => {
            const activate = () => {
                const method = trigger.dataset.paymentToggle;
                const radio = trigger.querySelector('input[name="paymentMethod"]');
                const wasSelected = currentMethod() === method;

                if (wasSelected && expandedMethod === method) {
                    // Volver a hacer clic en el método abierto lo contrae para cambiar cómodamente
                    expandedMethod = null;
                    syncAccordionUI(false);
                    return;
                }

                if (radio) radio.checked = true;
                expandedMethod = method;
                syncAccordionUI(!wasSelected);
            };

            trigger.addEventListener('click', event => {
                if (event.target.tagName === 'INPUT') {
                    event.stopPropagation();
                }
                activate();
            });

            trigger.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            });
        });

        // Toggle Boleta / Factura para todos los métodos de pago
        invoiceRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const isFactura = currentInvoiceType() === 'factura';
                if (boletaFields) boletaFields.classList.toggle('hidden', isFactura);
                if (facturaFields) facturaFields.classList.toggle('hidden', !isFactura);
            });
        });

        // Auto-formato de tarjeta
        if (cardNumber) {
            cardNumber.addEventListener('input', () => {
                const digits = cardNumber.value.replace(/\D/g, '').slice(0, 16);
                cardNumber.value = digits.replace(/(.{4})/g, '$1 ').trim();
                const brand = detectCardBrand(digits);
                if (cardBrandBadge) cardBrandBadge.textContent = brand.badge;
            });
        }

        if (cardExpiry) {
            cardExpiry.addEventListener('input', () => {
                const digits = cardExpiry.value.replace(/\D/g, '').slice(0, 4);
                cardExpiry.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
            });
        }

        if (cardCvv) {
            cardCvv.addEventListener('input', () => {
                cardCvv.value = cardCvv.value.replace(/\D/g, '').slice(0, 4);
            });
        }

        document.querySelectorAll('[data-copy-text]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const value = btn.dataset.copyText;
                try { await navigator.clipboard.writeText(value); } catch (e) {}
                const prev = btn.textContent;
                btn.textContent = '✓ Copiado';
                setTimeout(() => { btn.textContent = prev; }, 1600);
            });
        });

        function validateInvoice() {
            const type = currentInvoiceType();
            if (type === 'factura') {
                const ruc = (document.getElementById('invoice-ruc').value || '').replace(/\D/g, '');
                const businessName = (document.getElementById('invoice-business').value || '').trim();
                if (ruc.length !== 11) throw new Error('Ingresa un RUC válido de 11 dígitos para emitir Factura.');
                if (businessName.length < 3) throw new Error('Ingresa la Razón Social para tu Factura.');
                return { type: 'factura', docNumber: ruc, businessName };
            }
            const dni = (document.getElementById('invoice-dni').value || '').replace(/\D/g, '');
            if (dni && dni.length !== 8) throw new Error('El DNI para Boleta debe tener 8 dígitos (o déjalo en blanco).');
            return { type: 'boleta', docNumber: dni, businessName: shipping.name || '' };
        }

        function validateAndBuildPayment() {
            const method = currentMethod();
            const invoice = validateInvoice();
            const invTag = invoice.type === 'factura'
                ? `Factura RUC ${invoice.docNumber}`
                : `Boleta${invoice.docNumber ? ` DNI ${invoice.docNumber}` : ''}`;

            if (method === 'tarjeta') {
                const digits = (cardNumber.value || '').replace(/\D/g, '');
                const holder = (cardName.value || '').trim();
                const expiry = (cardExpiry.value || '').trim();
                const cvv = (cardCvv.value || '').replace(/\D/g, '');

                if (digits.length < 15 || !luhnValid(digits)) {
                    expandedMethod = 'tarjeta'; syncAccordionUI(false);
                    throw new Error('Ingresa un número de tarjeta válido (15 o 16 dígitos).');
                }
                if (holder.length < 3) {
                    expandedMethod = 'tarjeta'; syncAccordionUI(false);
                    throw new Error('Ingresa el nombre del titular tal como figura en la tarjeta.');
                }
                const expMatch = expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
                if (!expMatch) {
                    expandedMethod = 'tarjeta'; syncAccordionUI(false);
                    throw new Error('Ingresa una fecha de vencimiento válida en formato MM/AA.');
                }
                const expMonth = Number(expMatch[1]);
                const expYear = 2000 + Number(expMatch[2]);
                const now = new Date();
                if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
                    expandedMethod = 'tarjeta'; syncAccordionUI(false);
                    throw new Error('La tarjeta ingresada está vencida.');
                }
                if (cvv.length < 3 || cvv.length > 4) {
                    expandedMethod = 'tarjeta'; syncAccordionUI(false);
                    throw new Error('Ingresa un código CVV válido de 3 o 4 dígitos.');
                }

                const brand = detectCardBrand(digits);
                const last4 = digits.slice(-4);
                return {
                    method: 'tarjeta',
                    detail: `${brand.name} •••• ${last4} · ${invTag}`,
                    invoice,
                    meta: { brand: brand.name, last4, holder }
                };
            }

            if (method === 'yape') {
                const phone = (document.getElementById('yape-phone').value || '').replace(/\D/g, '');
                const code = (document.getElementById('yape-code').value || '').trim();
                if (phone.length !== 9 || !phone.startsWith('9')) {
                    expandedMethod = 'yape'; syncAccordionUI(false);
                    throw new Error('Ingresa el celular Yape de 9 dígitos desde el cual realizas el pago.');
                }
                if (code.length < 4) {
                    expandedMethod = 'yape'; syncAccordionUI(false);
                    throw new Error('Ingresa el código de aprobación o N° de operación Yape.');
                }
                return {
                    method: 'yape',
                    detail: `Yape ${phone} · Op. #${code} · ${invTag}`,
                    invoice,
                    meta: { phone, operationCode: code }
                };
            }

            if (method === 'plin') {
                const phone = (document.getElementById('plin-phone').value || '').replace(/\D/g, '');
                const code = (document.getElementById('plin-code').value || '').trim();
                if (phone.length !== 9 || !phone.startsWith('9')) {
                    expandedMethod = 'plin'; syncAccordionUI(false);
                    throw new Error('Ingresa el celular Plin de 9 dígitos desde el cual realizas el pago.');
                }
                if (code.length < 4) {
                    expandedMethod = 'plin'; syncAccordionUI(false);
                    throw new Error('Ingresa el N° de operación Plin para validar tu pago.');
                }
                return {
                    method: 'plin',
                    detail: `Plin ${phone} · Op. #${code} · ${invTag}`,
                    invoice,
                    meta: { phone, operationCode: code }
                };
            }

            const codMode = document.querySelector('input[name="codMode"]:checked');
            const modeText = codMode && codMode.value === 'pos' ? 'POS al recibir' : 'Efectivo al recibir';
            return {
                method: 'cash-on-delivery',
                detail: `Contraentrega (${modeText}) · ${invTag}`,
                invoice,
                meta: { codMode: codMode ? codMode.value : 'efectivo' }
            };
        }

        syncAccordionUI(true);

        finishBtn.addEventListener('click', () => {
            try {
                const paymentInfo = validateAndBuildPayment();
                errorBox.textContent = '';
                finishBtn.disabled = true;
                finishBtn.textContent = paymentInfo.method === 'tarjeta' ? 'Procesando pago seguro...' : 'Confirmando pedido...';

                setTimeout(async () => {
                    try {
                        const order = commerce.makeOrder(paymentInfo);
                        await commerce.syncOrderToServer(order, '../guardar_pedido.php');
                        location.href = 'gracias.html';
                    } catch (err) {
                        errorBox.textContent = err.message;
                        finishBtn.disabled = false;
                        syncAccordionUI(false);
                    }
                }, 420);
            } catch (error) {
                errorBox.textContent = error.message;
            }
        });
    }

    // === GENERADOR DE COMPROBANTE DESCARGABLE A4 ===
    function buildDownloadableReceiptHtml(order) {
        const inv = order.invoice || { type: 'boleta', docNumber: '', businessName: '' };
        const docTitle = inv.type === 'factura' ? 'CONSTANCIA DE PEDIDO · FACTURA' : 'CONSTANCIA DE PEDIDO · BOLETA';
        const invLine = inv.type === 'factura'
            ? `Factura — RUC: ${inv.docNumber} (${inv.businessName})`
            : `Boleta de Venta${inv.docNumber ? ` — DNI: ${inv.docNumber}` : ''}`;
        const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('es-PE');
        const itemsTotal = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
        const base = itemsTotal / 1.18;
        const igv = itemsTotal - base;
        const s = order.shipping || {};
        const addr = s.deliveryMethod === 'pickup' ? 'Recojo coordinado' : `${s.address || ''}, ${s.district || ''}`;

        const rows = (order.items || []).map(item => `
            <tr>
                <td>${commerce.escapeHtml(item.sku)}</td>
                <td>${commerce.escapeHtml(item.name)}</td>
                <td style="text-align:right">${item.quantity}</td>
                <td style="text-align:right">${commerce.formatMoney(item.price)}</td>
                <td style="text-align:right"><strong>${commerce.formatMoney(item.subtotal)}</strong></td>
            </tr>
        `).join('');

        return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Comprobante ${commerce.escapeHtml(order.id)} - Vigilix</title>
<style>body{font-family:Arial,sans-serif;background:#f4f6f9;color:#0f172a;margin:0;padding:28px}.sheet{max-width:780px;margin:auto;background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:32px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0f172a;padding-bottom:18px;margin-bottom:20px}.brand h1{margin:0 0 6px;font-size:22px;letter-spacing:1px}.brand p{margin:2px 0;color:#475569;font-size:13px}.doc{border:2px solid #0f172a;border-radius:8px;padding:12px 16px;text-align:center}.doc small{display:block;font-size:11px;font-weight:700;color:#0369a1;margin-bottom:4px}.doc strong{display:block;font-size:18px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;font-size:13px}.meta div{background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:6px}.meta span{display:block;font-size:11px;color:#64748b;font-weight:700;margin-bottom:3px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px}th,td{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#0f172a;color:#fff}.totals{margin-left:auto;max-width:300px;font-size:13px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.grand{border-top:2px solid #0f172a;margin-top:6px;padding-top:10px;font-size:17px;font-weight:800}.foot{margin-top:22px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:11px;color:#64748b;text-align:center}</style></head>
<body><div class="sheet"><div class="top"><div class="brand"><h1>◆ VIGILIX SECURITY DISTRIBUTION S.A.C.</h1><p>RUC: 20601234567 · Av. Javier Prado Este, Lima, Perú</p><p>proyectos@vigilix-security.com · +51 (01) 640-9800</p></div><div class="doc"><small>${docTitle}</small><strong>${commerce.escapeHtml(order.id)}</strong><span style="font-size:11px;color:#475569">${commerce.escapeHtml(dateStr)}</span></div></div>
<div class="meta"><div><span>CLIENTE Y ENTREGA</span>${commerce.escapeHtml(s.name || '')}<br>${commerce.escapeHtml(addr)}<br>${commerce.escapeHtml(s.phone || '')} · ${commerce.escapeHtml(s.email || '')}</div><div><span>COMPROBANTE Y PAGO</span>${commerce.escapeHtml(invLine)}<br>Método: ${commerce.escapeHtml(order.paymentLabel || '')}<br>${commerce.escapeHtml(order.paymentDetail || '')}</div></div>
<table><thead><tr><th>SKU</th><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">P. Unit.</th><th style="text-align:right">Importe</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>Op. Gravada (Base)</span><strong>${commerce.formatMoney(base)}</strong></div><div><span>IGV (18% incluido)</span><strong>${commerce.formatMoney(igv)}</strong></div>${order.discount > 0 ? `<div><span>Descuento (${commerce.escapeHtml(order.coupon || '')})</span><strong>− ${commerce.formatMoney(order.discount)}</strong></div>` : ''}<div><span>Envío</span><strong>${order.shippingCost ? commerce.formatMoney(order.shippingCost) : 'Gratis'}</strong></div><div class="grand"><span>TOTAL</span><span>${commerce.formatMoney(order.total)}</span></div></div>
<div class="foot">Constancia comercial generada por Vigilix. El comprobante electrónico SUNAT (Boleta o Factura) será enviado a tu correo al validar el pago y despacho.</div></div></body></html>`;
    }

    // === PASO 4: CONFIRMACIÓN / GRACIAS ===
    function initThanksPage() {
        const order = commerce.getLastOrder();
        const success = document.getElementById('success');
        const missing = document.getElementById('missing');

        if (!order) {
            missing.classList.remove('hidden');
            return;
        }

        success.classList.remove('hidden');
        document.getElementById('order-id').textContent = order.id;
        document.getElementById('order-total').textContent = commerce.formatMoney(order.total);

        const dateEl = document.getElementById('order-date');
        if (dateEl) dateEl.textContent = new Date(order.createdAt || Date.now()).toLocaleString('es-PE');

        const inv = order.invoice || { type: 'boleta', docNumber: '', businessName: '' };
        const docTitleEl = document.getElementById('order-doc-title');
        const invoiceInfoEl = document.getElementById('order-invoice-info');
        if (docTitleEl) {
            docTitleEl.textContent = inv.type === 'factura'
                ? 'CONSTANCIA DE PEDIDO · FACTURA'
                : 'CONSTANCIA DE PEDIDO · BOLETA';
        }
        if (invoiceInfoEl) {
            invoiceInfoEl.textContent = inv.type === 'factura'
                ? `Factura · RUC ${inv.docNumber} (${inv.businessName})`
                : `Boleta de Venta${inv.docNumber ? ` · DNI ${inv.docNumber}` : ''}`;
        }

        const methodEl = document.getElementById('order-payment-method');
        const detailEl = document.getElementById('order-payment-detail');
        const statusEl = document.getElementById('order-status');
        const itemsEl = document.getElementById('order-items-list');
        const shippingEl = document.getElementById('order-shipping-info');
        const nextStepEl = document.getElementById('order-next-step');

        const meta = commerce.PAYMENT_METHODS[order.paymentMethod] || commerce.PAYMENT_METHODS['cash-on-delivery'];
        if (methodEl) methodEl.textContent = order.paymentLabel || meta.label;
        if (detailEl) detailEl.textContent = order.paymentDetail || meta.description;
        if (statusEl) {
            statusEl.textContent = order.statusLabel || meta.statusLabel;
            statusEl.style.color = meta.statusColor;
        }

        if (itemsEl && Array.isArray(order.items)) {
            itemsEl.innerHTML = order.items.map(item => `
                <tr>
                    <td><code>${commerce.escapeHtml(item.sku)}</code></td>
                    <td>${commerce.escapeHtml(item.shortName || item.name)}</td>
                    <td class="num">${item.quantity}</td>
                    <td class="num">${commerce.formatMoney(item.price)}</td>
                    <td class="num"><strong>${commerce.formatMoney(item.subtotal)}</strong></td>
                </tr>
            `).join('');
        }

        const netItems = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
        const base = netItems / 1.18;
        const igv = netItems - base;
        const baseEl = document.getElementById('order-base');
        const igvEl = document.getElementById('order-igv');
        const discLine = document.getElementById('order-discount-line');
        const discEl = document.getElementById('order-discount');
        const shipCostEl = document.getElementById('order-shipping-cost');

        if (baseEl) baseEl.textContent = commerce.formatMoney(base);
        if (igvEl) igvEl.textContent = commerce.formatMoney(igv);
        if (discLine && discEl && order.discount > 0) {
            discLine.classList.remove('hidden');
            discEl.textContent = `− ${commerce.formatMoney(order.discount)}`;
        }
        if (shipCostEl) shipCostEl.textContent = order.shippingCost ? commerce.formatMoney(order.shippingCost) : 'Gratis';

        if (shippingEl && order.shipping) {
            const s = order.shipping;
            const addr = s.deliveryMethod === 'pickup'
                ? 'Recojo coordinado'
                : `${s.address}, ${s.district}${s.reference ? ` — Ref.: ${s.reference}` : ''}`;
            shippingEl.textContent = `${s.name} · ${addr} · ${s.phone}`;
        }

        if (nextStepEl) {
            if (order.paymentMethod === 'tarjeta') {
                nextStepEl.innerHTML = '<strong>Pago confirmado:</strong> tu pedido ya ingresó a despacho. Te enviaremos el comprobante electrónico oficial y seguimiento al correo registrado.';
            } else if (order.paymentMethod === 'yape' || order.paymentMethod === 'plin') {
                nextStepEl.innerHTML = `<strong>Validación rápida:</strong> verificaremos tu código de operación ${commerce.escapeHtml(order.paymentLabel)} en minutos. Puedes enviarnos tu captura por WhatsApp para acelerar el despacho.`;
            }
        }

        const downloadBtn = document.getElementById('download-receipt-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const html = buildDownloadableReceiptHtml(order);
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Comprobante-${order.id}.html`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                commerce.trackEvent('usar_herramienta', {
                    nombre_herramienta: 'comprobante_pedido',
                    accion_herramienta: 'descargar'
                });
            });
        }

        const printBtn = document.getElementById('print-receipt-btn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                commerce.trackEvent('usar_herramienta', {
                    nombre_herramienta: 'comprobante_pedido',
                    accion_herramienta: 'imprimir_pdf'
                });
                window.print();
            });
        }

        const waBtn = document.getElementById('order-whatsapp-btn');
        if (waBtn) {
            const lines = (order.items || []).map(i => `• ${i.quantity}x ${i.shortName || i.name} (${commerce.formatMoney(i.subtotal)})`).join('\n');
            const msg = [
                `Hola Vigilix, realicé el pedido ${order.id}:`,
                lines,
                `Total: ${commerce.formatMoney(order.total)}`,
                `Pago: ${order.paymentLabel} (${order.paymentDetail})`,
                order.shipping ? `Cliente: ${order.shipping.name} (${order.shipping.phone})` : ''
            ].filter(Boolean).join('\n');
            waBtn.href = commerce.whatsappUrl(msg);
            waBtn.addEventListener('click', () => {
                commerce.trackEvent('contacto_whatsapp', {
                    ubicacion: 'confirmacion_pedido',
                    sku: '',
                    numero_pedido: order.id
                });
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const page = document.body.dataset.checkoutPage;
        if (page === 'envio') initShippingPage();
        else if (page === 'pago') initPaymentPage();
        else if (page === 'gracias') initThanksPage();
    });
})();
