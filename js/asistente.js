(function () {
    'use strict';

    const commerce = window.VigilixCommerce;
    const allProducts = Object.values(commerce.PRODUCTS);
    const chatHistory = [];
    let aiAvailable = true;

    function toggleChatbot(forceOpen = false) {
        const chatbotWindow = document.getElementById('chatbot-window');
        const icon = document.getElementById('chatbot-icon');
        if (!chatbotWindow) return;
        const wasOpen = chatbotWindow.classList.contains('active');
        if (forceOpen) chatbotWindow.classList.add('active');
        else chatbotWindow.classList.toggle('active');
        const isOpen = chatbotWindow.classList.contains('active');
        if (!wasOpen && isOpen) {
            commerce.trackEvent('usar_chatbot', { accion_chatbot: 'abrir', modo_chatbot: aiAvailable ? 'ia' : 'local' });
        }
        if (icon) icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-robot';
    }

    function appendMessage(htmlContent, sender) {
        const chatBody = document.getElementById('chat-body');
        if (!chatBody) return null;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}`;
        if (sender === 'user') msgDiv.textContent = htmlContent;
        else msgDiv.innerHTML = htmlContent;
        chatBody.appendChild(msgDiv);
        chatBody.scrollTop = chatBody.scrollHeight;
        return msgDiv;
    }

    function renderProductCards(products, intro) {
        const list = products.slice(0, 4);
        const cards = list.map(product => `
            <div class="chat-product-item">
                <div>
                    <strong>${commerce.escapeHtml(product.shortName || product.name)}</strong>
                    <span>${commerce.formatMoney(product.price)}</span>
                </div>
                <div>
                    <a href="producto.html?sku=${encodeURIComponent(product.sku)}">Detalles</a>
                    <button type="button" onclick="addProductToCart('${commerce.escapeHtml(product.sku)}')">+ Carrito</button>
                </div>
            </div>
        `).join('');
        return `${intro}<div class="chat-product-list">${cards}</div><div class="chat-quick-btns"><button type="button" class="chat-chip" onclick="sendQuickChat('Menú principal')">← Categorías</button><a class="chat-chip" href="carrito.html">Ver carrito</a></div>`;
    }

    function formatAiReply(rawText) {
        const escaped = commerce.escapeHtml(rawText)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        // Extraer SKUs mencionados por la IA entre corchetes o texto directo
        const mentioned = allProducts.filter(p => rawText.toUpperCase().includes(p.sku.toUpperCase())).slice(0, 3);
        if (!mentioned.length) return escaped;
        return renderProductCards(mentioned, escaped);
    }

    function localSmartReply(input) {
        const q = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // 1. Consulta sobre el carrito actual
        if (q.includes('carrito') || q.includes('llevo') || q.includes('mi pedido')) {
            const items = commerce.getDetailedCart();
            if (!items.length) {
                return `Tu carrito está vacío ahora. Puedes explorar los <strong>${allProducts.length} equipos</strong> o usar el <button type="button" class="chat-inline-link" onclick="VigilixTools.openKitBuilder()">Armador de Kit CCTV</button>.`;
            }
            const lines = items.map(i => `• ${i.quantity}× ${commerce.escapeHtml(i.shortName || i.name)} (${commerce.formatMoney(i.subtotal)})`).join('<br>');
            const sub = commerce.subtotal();
            const faltante = Math.max(0, commerce.FREE_SHIPPING_THRESHOLD - sub);
            const shipNote = faltante > 0
                ? `Te faltan <strong>${commerce.formatMoney(faltante)}</strong> para envío gratis en Lima.`
                : `¡Ya calificas para <strong>envío GRATIS</strong> en Lima!`;
            return `Llevas <strong>${commerce.count()} unidad(es)</strong> por <strong>${commerce.formatMoney(sub)}</strong>:<br>${lines}<br>${shipNote}<div class="chat-quick-btns"><a class="chat-chip" href="carrito.html">Ir al carrito</a><a class="chat-chip" href="checkout/envio.html">Pagar ahora</a></div>`;
        }

        // 2. Consulta sobre calculadora de discos / almacenamiento / NFPA
        if (q.includes('calcula') || q.includes('cuantos tb') || q.includes('cuanto disco') || q.includes('almacenamiento') || q.includes('ancho de banda')) {
            return `Puedes calcular exactamente cuántos TB y discos WD Purple necesitas en nuestra herramienta interactiva:<div class="chat-quick-btns"><button type="button" class="chat-chip" onclick="VigilixTools.openStorageCalc()">Abrir Calculadora Storage</button><button type="button" class="chat-chip" onclick="VigilixTools.openNfpaCalc()">Calculadora Baterías NFPA</button></div>`;
        }

        // 3. Armar kit CCTV
        if (q.includes('armar') || q.includes('combo') || (q.includes('kit') && q.includes('medida'))) {
            return `¡Arma tu propio sistema CCTV paso a paso con NVR, cámaras, disco duro y accesorios!<div class="chat-quick-btns"><button type="button" class="chat-chip" onclick="VigilixTools.openKitBuilder()">Abrir Armador de Kit CCTV</button></div>`;
        }

        // 4. Filtro inteligente por presupuesto (ej: "menos de 300", "hasta 500", "barato")
        const budgetMatch = q.match(/(?:menos de|hasta|maximo|bajo|presupuesto de|de)\s*(?:s\/\.?\s*)?(\d{2,5})/);
        if (budgetMatch || q.includes('barato') || q.includes('economico')) {
            const maxPrice = budgetMatch ? Number(budgetMatch[1]) : 250;
            const affordable = allProducts
                .filter(p => p.price <= maxPrice && p.filterGroup !== 'licencias')
                .sort((a, b) => a.price - b.price);
            if (affordable.length) {
                return renderProductCards(affordable, `Equipos disponibles hasta <strong>${commerce.formatMoney(maxPrice)}</strong>:`);
            }
            return `Nuestros equipos inician desde <strong>${commerce.formatMoney(59.90)}</strong> (Mini Cámara Wi‑Fi A9). ¿Qué categoría buscas?`;
        }

        // 5. Pagos, cupones y envíos
        if (q.includes('pago') || q.includes('yape') || q.includes('plin') || q.includes('tarjeta') || q.includes('visa') || q.includes('cupon') || q.includes('descuento') || q.includes('contraentrega')) {
            return `Aceptamos <strong>Tarjeta (Visa, Mastercard, Amex)</strong>, <strong>Yape</strong>, <strong>Plin</strong> y <strong>Contraentrega</strong>.<br>Usa el cupón <strong>VIGILIX10</strong> (10% dcto. desde S/ 100) o <strong>PROYECTO5</strong> (5% dcto.) en tu carrito.`;
        }

        if (q.includes('envio') || q.includes('delivery') || q.includes('provincia') || q.includes('shalom') || q.includes('olva')) {
            return `<strong>Lima Metropolitana:</strong> S/ 10.00 (<strong>GRATIS</strong> desde S/ 500).<br><strong>Provincias (Shalom / Olva):</strong> S/ 25.00.<br><strong>Recojo coordinado:</strong> Gratis.`;
        }

        if (q.includes('menu') || q.includes('categoria') || q.includes('hola') || q.includes('ayuda')) {
            return `Puedo buscar entre los <strong>${allProducts.length} productos</strong> por SKU, marca o presupuesto, revisar tu carrito o abrir nuestras herramientas:<div class="chat-quick-btns"><button type="button" class="chat-chip" onclick="sendQuickChat('Videovigilancia')">Videovigilancia</button><button type="button" class="chat-chip" onclick="sendQuickChat('Incendios')">Incendios</button><button type="button" class="chat-chip" onclick="sendQuickChat('Acceso')">Acceso</button><button type="button" class="chat-chip" onclick="VigilixTools.openStorageCalc()">Calc. Storage</button><button type="button" class="chat-chip" onclick="VigilixTools.openKitBuilder()">Armar Kit</button></div>`;
        }

        if (q.includes('cotiza') || q.includes('volumen') || q.includes('licitacion') || q.includes('factura') || q.includes('whatsapp')) {
            return `Para compras por volumen o licitaciones puedes completar el <a href="#cotizar" style="color:var(--accent-amber);font-weight:bold;text-decoration:underline;">Formulario B2B</a> o escribirnos directo por <a href="${commerce.whatsappUrl('Hola Vigilix, deseo una cotización B2B.')}" target="_blank" rel="noopener" style="color:#25d366;font-weight:bold;text-decoration:underline;">WhatsApp Comercial</a>.`;
        }

        // 6. Búsqueda dinámica inteligente sobre TODOS los 30 productos (SKU, marca, nombre, categoría, specs)
        const tokens = q.split(/\s+/).filter(t => t.length >= 2 && !['para', 'con', 'una', 'uno', 'que', 'quiero', 'tienen', 'busco', 'precio', 'cuesta', 'cuanto', 'vale', 'los', 'las', 'del', 'por'].includes(t));
        if (tokens.length) {
            const scored = allProducts.map(product => {
                const specsText = Object.entries(product.specs || {}).map(([k, v]) => `${k} ${v}`).join(' ');
                const blob = `${product.sku} ${product.name} ${product.brand} ${product.category} ${product.filterGroup} ${product.description} ${specsText}`
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
                let score = 0;
                tokens.forEach(token => {
                    if (product.sku.toLowerCase() === token) score += 10;
                    else if (blob.includes(token)) score += 2;
                });
                return { product, score };
            })
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(entry => entry.product);

            if (scored.length) {
                return renderProductCards(scored, `Encontré <strong>${scored.length}</strong> coincidencia(s) en nuestro catálogo:`);
            }
        }

        return `No encontré un modelo exacto con eso, pero puedes preguntarme por <strong>presupuesto</strong> (ej. *"menos de 300"*), <strong>marca</strong> (*Hikvision, ZKTeco, Simplex, Notifier*), <strong>pagos con Yape/Plin/Tarjeta</strong> o abrir nuestras herramientas:<div class="chat-quick-btns"><button type="button" class="chat-chip" onclick="VigilixTools.openKitBuilder()">Armar Kit CCTV</button><button type="button" class="chat-chip" onclick="VigilixTools.openStorageCalc()">Calc. Storage</button><a class="chat-chip" href="#cotizar">Cotizar B2B</a></div>`;
    }

    async function askHybridAssistant(userText) {
        const typingNode = appendMessage('<span class="chat-typing">Analizando consulta…</span>', 'bot');

        if (aiAvailable) {
            try {
                const cartItems = commerce.getDetailedCart();
                const cartSummary = cartItems.length
                    ? `${commerce.count()} ítems, subtotal ${commerce.formatMoney(commerce.subtotal())}: ${cartItems.map(i => `${i.quantity}x ${i.sku}`).join(', ')}`
                    : 'Carrito vacío';

                const response = await fetch('asistente_ia.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userText,
                        history: chatHistory.slice(-6),
                        cartSummary,
                        catalog: allProducts.map(p => ({ sku: p.sku, name: p.shortName || p.name, category: p.category, price: p.price }))
                    })
                });

                const data = await response.json();
                if (data && data.ok && data.reply) {
                    chatHistory.push({ role: 'user', text: userText });
                    chatHistory.push({ role: 'model', text: data.reply });
                    commerce.trackEvent('usar_chatbot', { accion_chatbot: 'consulta', modo_chatbot: 'ia' });
                    if (typingNode) typingNode.innerHTML = formatAiReply(data.reply);
                    return;
                }
                if (data && data.fallback) aiAvailable = false;
            } catch (error) {
                aiAvailable = false;
            }
        }

        const localReply = localSmartReply(userText);
        commerce.trackEvent('usar_chatbot', { accion_chatbot: 'consulta', modo_chatbot: 'local' });
        if (typingNode) typingNode.innerHTML = localReply;
        const chatBody = document.getElementById('chat-body');
        if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
    }

    function sendQuickChat(text) {
        appendMessage(text, 'user');
        askHybridAssistant(text);
    }

    function handleChatSubmit(event) {
        event.preventDefault();
        const chatInput = document.getElementById('chat-input');
        const text = (chatInput.value || '').trim();
        if (!text) return;
        appendMessage(text, 'user');
        chatInput.value = '';
        askHybridAssistant(text);
    }

    window.toggleChatbot = toggleChatbot;
    window.sendQuickChat = sendQuickChat;
    window.handleChatSubmit = handleChatSubmit;
})();
