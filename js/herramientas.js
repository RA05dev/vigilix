(function () {
    'use strict';

    const commerce = window.VigilixCommerce;
    const ui = window.VigilixUI;
    const compareSkus = [];

    function ensureModalShell() {
        let overlay = document.getElementById('vx-tool-modal');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'vx-tool-modal';
        overlay.className = 'vx-modal-backdrop';
        overlay.innerHTML = `
            <div class="vx-modal" role="dialog" aria-modal="true" aria-labelledby="vx-modal-title">
                <div class="vx-modal-header">
                    <h3 id="vx-modal-title"></h3>
                    <button type="button" class="vx-modal-close" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="vx-modal-body" class="vx-modal-body"></div>
            </div>
        `;

        overlay.addEventListener('click', event => {
            if (event.target === overlay || event.target.closest('.vx-modal-close')) closeModal();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeModal();
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function openModal(titleHtml, bodyHtml) {
        const overlay = ensureModalShell();
        document.getElementById('vx-modal-title').innerHTML = titleHtml;
        document.getElementById('vx-modal-body').innerHTML = bodyHtml;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const overlay = document.getElementById('vx-tool-modal');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    // === 1. CALCULADORA INTERACTIVA DE STORAGE & ANCHO DE BANDA CCTV ===
    function openStorageCalc() {
        commerce.trackEvent('usar_herramienta', {
            nombre_herramienta: 'calculadora_storage',
            accion_herramienta: 'abrir'
        });
        openModal(
            '<i class="fa-solid fa-hard-drive"></i> Calculadora de Storage CCTV & Ancho de Banda',
            `
            <p class="tool-modal-lead">Dimensiona la capacidad de disco duro y ancho de banda para tu proyecto IP y agrega el hardware recomendado en un clic.</p>
            <div class="calc-grid">
                <div class="calc-field">
                    <label for="calc-cams">Cantidad de cámaras</label>
                    <input id="calc-cams" type="number" min="1" max="64" value="8">
                </div>
                <div class="calc-field">
                    <label for="calc-res">Resolución</label>
                    <select id="calc-res">
                        <option value="2">2 MP (1080p)</option>
                        <option value="4" selected>4 MP (2K Pro)</option>
                        <option value="8">8 MP (4K UHD)</option>
                    </select>
                </div>
                <div class="calc-field">
                    <label for="calc-codec">Compresión de video</label>
                    <select id="calc-codec">
                        <option value="h265plus" selected>H.265+ (Ahorro óptimo)</option>
                        <option value="h265">H.265 Estándar</option>
                        <option value="h264">H.264 Clásico</option>
                    </select>
                </div>
                <div class="calc-field">
                    <label for="calc-days">Días de retención</label>
                    <select id="calc-days">
                        <option value="7">7 días</option>
                        <option value="15">15 días</option>
                        <option value="30" selected>30 días (Estándar B2B)</option>
                        <option value="60">60 días</option>
                    </select>
                </div>
                <div class="calc-field">
                    <label for="calc-hours">Horas de grabación / día</label>
                    <select id="calc-hours">
                        <option value="24" selected>24 horas (Continuo)</option>
                        <option value="12">12 horas (Por movimiento)</option>
                    </select>
                </div>
            </div>

            <div class="calc-results" id="storage-calc-results"></div>
            `
        );

        const inputs = ['calc-cams', 'calc-res', 'calc-codec', 'calc-days', 'calc-hours'];
        function compute() {
            const cams = Math.max(1, Math.min(64, Number(document.getElementById('calc-cams').value) || 1));
            const res = Number(document.getElementById('calc-res').value);
            const codec = document.getElementById('calc-codec').value;
            const days = Number(document.getElementById('calc-days').value);
            const hours = Number(document.getElementById('calc-hours').value);

            // Bitrate referencial por cámara en Mbps (15-20 fps)
            const baseMbps = { 2: 2.0, 4: 3.5, 8: 6.5 }[res] || 3.5;
            const codecFactor = { h265plus: 0.48, h265: 0.7, h264: 1.0 }[codec] || 0.5;
            const mbpsPerCam = baseMbps * codecFactor;
            const totalMbps = mbpsPerCam * cams;

            // GB por día = Mbps * 3600 * hours / 8 / 1024
            const totalTb = (totalMbps * 3600 * hours * days) / 8 / 1024 / 1024;
            const disks8Tb = Math.max(1, Math.ceil(totalTb / 7.2)); // 7.2 TB útiles por disco de 8TB
            const nvrSku = cams <= 8 ? 'HKV-7608NXI-K2' : 'HKV-7732NI-K4';
            const nvr = commerce.PRODUCTS[nvrSku];
            const hdd = commerce.PRODUCTS['WDP-80PURZ'];

            document.getElementById('storage-calc-results').innerHTML = `
                <div class="calc-kpi-grid">
                    <div class="calc-kpi"><span>Almacenamiento requerido</span><strong>${totalTb.toFixed(2)} TB</strong></div>
                    <div class="calc-kpi"><span>Ancho de banda total</span><strong>${totalMbps.toFixed(1)} Mbps</strong></div>
                    <div class="calc-kpi"><span>Discos WD Purple 8TB</span><strong>${disks8Tb} ${disks8Tb === 1 ? 'unidad' : 'unidades'}</strong></div>
                </div>
                <div class="calc-reco-box">
                    <div>
                        <small>HARDWARE RECOMENDADO PARA ${cams} CÁMARAS</small>
                        <strong>${disks8Tb}× ${commerce.escapeHtml(hdd.shortName)} + 1× ${commerce.escapeHtml(nvr.shortName)}</strong>
                        <span>Total estimado: ${commerce.formatMoney(hdd.price * disks8Tb + nvr.price)}</span>
                    </div>
                    <button type="button" class="btn-primary calc-add-btn" id="btn-add-storage-reco">
                        <i class="fa-solid fa-cart-plus"></i> Agregar al carrito
                    </button>
                </div>
            `;

            document.getElementById('btn-add-storage-reco').addEventListener('click', () => {
                commerce.addItem('WDP-80PURZ', disks8Tb);
                commerce.addItem(nvrSku, 1);
                commerce.trackEvent('usar_herramienta', {
                    nombre_herramienta: 'calculadora_storage',
                    accion_herramienta: 'agregar_recomendacion'
                });
                ui.updateCartCounters(true);
                closeModal();
                ui.showToast('Hardware agregado', `Se añadieron ${disks8Tb}× WD Purple 8TB y ${nvr.shortName} a tu carrito.`, {
                    actionLabel: 'Ver carrito rápido',
                    onAction: () => ui.openCartDrawer()
                });
            });
        }

        inputs.forEach(id => document.getElementById(id).addEventListener('input', compute));
        compute();
    }

    // === 2. CALCULADORA DE BATERÍAS INCENDIO NFPA 72 ===
    function openNfpaCalc() {
        commerce.trackEvent('usar_herramienta', {
            nombre_herramienta: 'calculadora_nfpa',
            accion_herramienta: 'abrir'
        });
        openModal(
            '<i class="fa-solid fa-car-battery"></i> Calculadora de Baterías Incendio (NFPA 72)',
            `
            <p class="tool-modal-lead">Estima el banco de baterías de 24 VDC (2×12V en serie) cumpliendo el factor de seguridad del 20% según norma NFPA 72.</p>
            <div class="calc-grid">
                <div class="calc-field">
                    <label for="nfpa-devices">Detectores / Módulos en lazo</label>
                    <input id="nfpa-devices" type="number" min="5" max="250" value="35">
                </div>
                <div class="calc-field">
                    <label for="nfpa-strobes">Sirenas estroboscópicas</label>
                    <input id="nfpa-strobes" type="number" min="1" max="50" value="6">
                </div>
                <div class="calc-field">
                    <label for="nfpa-standby">Respaldo Standby (horas)</label>
                    <select id="nfpa-standby">
                        <option value="24" selected>24 horas (Estándar NFPA 72)</option>
                        <option value="60">60 horas (Alta criticidad)</option>
                    </select>
                </div>
                <div class="calc-field">
                    <label for="nfpa-alarm">Tiempo en alarma (min)</label>
                    <select id="nfpa-alarm">
                        <option value="5" selected>5 minutos (Estándar)</option>
                        <option value="15">15 minutos (Evacuación voz)</option>
                    </select>
                </div>
            </div>
            <div class="calc-results" id="nfpa-calc-results"></div>
            `
        );

        const ids = ['nfpa-devices', 'nfpa-strobes', 'nfpa-standby', 'nfpa-alarm'];
        function compute() {
            const devices = Math.max(1, Number(document.getElementById('nfpa-devices').value) || 1);
            const strobes = Math.max(1, Number(document.getElementById('nfpa-strobes').value) || 1);
            const standbyH = Number(document.getElementById('nfpa-standby').value);
            const alarmMin = Number(document.getElementById('nfpa-alarm').value);

            // Corrientes típicas en Amperios (panel base 0.14A + 0.0005A por dispositivo)
            const standbyAmps = 0.14 + devices * 0.0005;
            const alarmAmps = 0.25 + devices * 0.002 + strobes * 0.12;
            const ahRaw = (standbyAmps * standbyH) + (alarmAmps * (alarmMin / 60));
            const ahRequired = ahRaw * 1.2; // 20% margen NFPA 72
            const commercialSizes = [7, 12, 18, 26, 33, 40, 55];
            const suggestedAh = commercialSizes.find(size => size >= ahRequired) || Math.ceil(ahRequired);
            const panelSku = devices <= 50 ? 'HON-ES50X' : 'SMP-4007ES-HYB';
            const panel = commerce.PRODUCTS[panelSku];

            document.getElementById('nfpa-calc-results').innerHTML = `
                <div class="calc-kpi-grid">
                    <div class="calc-kpi"><span>Capacidad NFPA (+20%)</span><strong>${ahRequired.toFixed(2)} Ah</strong></div>
                    <div class="calc-kpi"><span>Batería comercial 24V</span><strong>2× 12V ${suggestedAh}Ah</strong></div>
                    <div class="calc-kpi"><span>Panel sugerido</span><strong>${devices <= 50 ? 'ES-50X' : 'Simplex 4007ES'}</strong></div>
                </div>
                <div class="calc-reco-box">
                    <div>
                        <small>PANEL COMPATIBLE PARA ${devices} DISPOSITIVOS</small>
                        <strong>${commerce.escapeHtml(panel.name)}</strong>
                        <span>Precio online: ${commerce.formatMoney(panel.price)}</span>
                    </div>
                    <button type="button" class="btn-primary calc-add-btn" id="btn-add-nfpa-panel">
                        <i class="fa-solid fa-cart-plus"></i> Agregar panel
                    </button>
                </div>
            `;

            document.getElementById('btn-add-nfpa-panel').addEventListener('click', () => {
                commerce.addItem(panelSku, 1);
                commerce.trackEvent('usar_herramienta', {
                    nombre_herramienta: 'calculadora_nfpa',
                    accion_herramienta: 'agregar_recomendacion'
                });
                ui.updateCartCounters(true);
                closeModal();
                ui.showToast('Panel agregado', `<strong>${panel.shortName}</strong> se agregó a tu carrito.`);
            });
        }

        ids.forEach(id => document.getElementById(id).addEventListener('input', compute));
        compute();
    }

    // === 3. ARMADOR DE KIT CCTV A MEDIDA ===
    function openKitBuilder() {
        commerce.trackEvent('usar_herramienta', {
            nombre_herramienta: 'armador_kit_cctv',
            accion_herramienta: 'abrir'
        });
        openModal(
            '<i class="fa-solid fa-screwdriver-wrench"></i> Arma tu Kit CCTV Profesional',
            `
            <p class="tool-modal-lead">Combina grabador NVR, cámaras IP, disco duro y accesorios. Si superas S/ 500 obtienes <strong>envío gratis en Lima</strong> y puedes aplicar <strong>VIGILIX10</strong>.</p>
            <div class="kit-builder-grid">
                <div class="calc-field">
                    <label for="kit-nvr">1. Grabador NVR PoE</label>
                    <select id="kit-nvr">
                        <option value="HKV-7608NXI-K2">NVR AcuSense 8 Canales / 8 PoE — S/ 420.00</option>
                        <option value="HKV-7732NI-K4">NVR Hikvision 32 Canales / 16 PoE — S/ 650.00</option>
                    </select>
                </div>
                <div class="calc-field">
                    <label for="kit-cam">2. Modelo de cámara IP</label>
                    <select id="kit-cam">
                        <option value="HKV-BULLET-4MP">Bullet IP 4MP IR AcuSense — S/ 290.00 c/u</option>
                        <option value="HKV-DOMO-COLORVU">Domo IP 4MP ColorVu 24/7 — S/ 310.00 c/u</option>
                        <option value="HKV-DS2DE7A432">Domo PTZ 4MP Zoom 32X — S/ 540.00 c/u</option>
                    </select>
                </div>
                <div class="calc-field">
                    <label for="kit-cam-qty">3. Cantidad de cámaras</label>
                    <input id="kit-cam-qty" type="number" min="1" max="16" value="4">
                </div>
                <div class="calc-field">
                    <label for="kit-hdd">4. Almacenamiento 24/7</label>
                    <select id="kit-hdd">
                        <option value="WDP-80PURZ" selected>Disco WD Purple 8TB — S/ 215.00</option>
                        <option value="">Sin disco duro</option>
                    </select>
                </div>
            </div>

            <div class="kit-extras">
                <label class="kit-check"><input type="checkbox" id="kit-cable" checked> Agregar Bobina Cable UTP Cat6 LSZH 305m (S/ 165.00)</label>
                <label class="kit-check"><input type="checkbox" id="kit-rack"> Agregar Gabinete Rack Mural 9U (S/ 340.00)</label>
                <label class="kit-check"><input type="checkbox" id="kit-ups"> Agregar UPS Online 3KVA Rack 2U (S/ 780.00)</label>
            </div>

            <div class="calc-results" id="kit-summary"></div>
            `
        );

        function buildList() {
            const items = [];
            items.push({ sku: document.getElementById('kit-nvr').value, qty: 1 });
            items.push({
                sku: document.getElementById('kit-cam').value,
                qty: Math.max(1, Math.min(16, Number(document.getElementById('kit-cam-qty').value) || 1))
            });
            const hddSku = document.getElementById('kit-hdd').value;
            if (hddSku) items.push({ sku: hddSku, qty: 1 });
            if (document.getElementById('kit-cable').checked) items.push({ sku: 'CAB-CAT6-LSZH', qty: 1 });
            if (document.getElementById('kit-rack').checked) items.push({ sku: 'RACK-WALL-9U', qty: 1 });
            if (document.getElementById('kit-ups').checked) items.push({ sku: 'PWR-UPS3KVA-RT', qty: 1 });
            return items;
        }

        function updateKit() {
            const list = buildList();
            const total = list.reduce((sum, entry) => sum + commerce.PRODUCTS[entry.sku].price * entry.qty, 0);
            const withCoupon = total * 0.9;
            const totalUnits = list.reduce((sum, entry) => sum + entry.qty, 0);

            document.getElementById('kit-summary').innerHTML = `
                <div class="calc-reco-box">
                    <div>
                        <small>TU KIT A MEDIDA (${totalUnits} EQUIPOS)</small>
                        <strong>Total: ${commerce.formatMoney(total)}</strong>
                        <span>Con cupón <strong>VIGILIX10</strong> en carrito: ${commerce.formatMoney(withCoupon)} + Envío GRATIS en Lima</span>
                    </div>
                    <button type="button" class="btn-primary calc-add-btn" id="btn-add-full-kit">
                        <i class="fa-solid fa-cart-plus"></i> Agregar Kit al carrito
                    </button>
                </div>
            `;

            document.getElementById('btn-add-full-kit').addEventListener('click', () => {
                list.forEach(entry => commerce.addItem(entry.sku, entry.qty));
                commerce.trackEvent('usar_herramienta', {
                    nombre_herramienta: 'armador_kit_cctv',
                    accion_herramienta: 'agregar_kit'
                });
                ui.updateCartCounters(true);
                closeModal();
                ui.showToast('Kit CCTV agregado', `Se añadieron ${totalUnits} equipos de tu kit personalizado al carrito.`, {
                    actionLabel: 'Ver carrito rápido',
                    onAction: () => ui.openCartDrawer()
                });
            });
        }

        ['kit-nvr', 'kit-cam', 'kit-cam-qty', 'kit-hdd', 'kit-cable', 'kit-rack', 'kit-ups'].forEach(id => {
            document.getElementById(id).addEventListener('change', updateKit);
            document.getElementById(id).addEventListener('input', updateKit);
        });
        updateKit();
    }

    // === 4. COMPARADOR DE EQUIPOS (HASTA 3 LADO A LADO) ===
    function ensureCompareBar() {
        let bar = document.getElementById('vx-compare-bar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'vx-compare-bar';
        bar.className = 'compare-bar hidden';
        document.body.appendChild(bar);
        return bar;
    }

    function syncCompareButtons() {
        document.querySelectorAll('[data-compare-sku]').forEach(btn => {
            const active = compareSkus.includes(btn.dataset.compareSku);
            btn.classList.toggle('active', active);
            btn.innerHTML = active
                ? '<i class="fa-solid fa-check"></i> En comparador'
                : '<i class="fa-solid fa-scale-balanced"></i> Comparar';
        });

        const bar = ensureCompareBar();
        if (!compareSkus.length) {
            bar.classList.add('hidden');
            return;
        }

        bar.classList.remove('hidden');
        const chips = compareSkus.map(sku => {
            const p = commerce.PRODUCTS[sku];
            return `<span class="compare-chip">${commerce.escapeHtml(p.shortName || p.name)} <button type="button" onclick="VigilixTools.toggleCompare('${commerce.escapeHtml(sku)}')" aria-label="Quitar">×</button></span>`;
        }).join('');

        bar.innerHTML = `
            <div class="compare-bar-items">
                <strong><i class="fa-solid fa-scale-balanced"></i> Comparando (${compareSkus.length}/3):</strong>
                ${chips}
            </div>
            <div class="compare-bar-actions">
                <button type="button" class="btn-outline compare-sm-btn" onclick="VigilixTools.clearCompare()">Limpiar</button>
                <button type="button" class="btn-primary compare-sm-btn" onclick="VigilixTools.openCompareModal()" ${compareSkus.length < 2 ? 'disabled' : ''}>
                    Ver tabla (${compareSkus.length})
                </button>
            </div>
        `;
    }

    function toggleCompare(sku) {
        const idx = compareSkus.indexOf(sku);
        if (idx >= 0) {
            compareSkus.splice(idx, 1);
        } else {
            if (compareSkus.length >= 3) {
                ui.showToast('Máximo 3 productos', 'Quita uno del comparador para agregar otro equipo.');
                return;
            }
            compareSkus.push(sku);
        }
        syncCompareButtons();
    }

    function clearCompare() {
        compareSkus.length = 0;
        syncCompareButtons();
    }

    function openCompareModal() {
        if (compareSkus.length < 2) {
            ui.showToast('Elige al menos 2 productos', 'Selecciona 2 o 3 equipos del catálogo para compararlos.');
            return;
        }
        commerce.trackEvent('usar_herramienta', {
            nombre_herramienta: 'comparador_equipos',
            accion_herramienta: 'comparar'
        });
        const products = compareSkus.map(sku => commerce.PRODUCTS[sku]).filter(Boolean);
        const specKeys = [...new Set(products.flatMap(p => Object.keys(p.specs || {})))];

        const headCols = products.map(p => `
            <th>
                <img src="${commerce.escapeHtml(p.image)}" alt="${commerce.escapeHtml(p.name)}" class="cmp-img" ${p.fallbackImage ? `data-fb="${commerce.escapeHtml(p.fallbackImage)}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}"` : ''}>
                <div class="cmp-name">${commerce.escapeHtml(p.shortName || p.name)}</div>
                <div class="cmp-price">${commerce.formatMoney(p.price)}</div>
            </th>
        `).join('');

        const specRows = specKeys.map(key => `
            <tr>
                <th>${commerce.escapeHtml(key)}</th>
                ${products.map(p => `<td>${commerce.escapeHtml((p.specs && p.specs[key]) || '—')}</td>`).join('')}
            </tr>
        `).join('');

        openModal(
            '<i class="fa-solid fa-scale-balanced"></i> Comparación de Especificaciones',
            `
            <div class="compare-table-wrap">
                <table class="compare-table">
                    <thead>
                        <tr><th>Equipo</th>${headCols}</tr>
                    </thead>
                    <tbody>
                        <tr><th>SKU</th>${products.map(p => `<td><code>${commerce.escapeHtml(p.sku)}</code></td>`).join('')}</tr>
                        <tr><th>Marca</th>${products.map(p => `<td>${commerce.escapeHtml(p.brand || 'Vigilix')}</td>`).join('')}</tr>
                        <tr><th>Categoría</th>${products.map(p => `<td>${commerce.escapeHtml(p.category)}</td>`).join('')}</tr>
                        <tr><th>Disponibilidad</th>${products.map(p => `<td style="color:var(--accent-green)">${commerce.escapeHtml(p.stockLabel || 'Disponible')}</td>`).join('')}</tr>
                        ${specRows}
                        <tr>
                            <th>Acción</th>
                            ${products.map(p => `<td><button type="button" class="btn-add" style="width:100%" onclick="addProductToCart('${commerce.escapeHtml(p.sku)}')"><i class="fa-solid fa-cart-plus"></i> Agregar</button></td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>
            `
        );
    }

    window.VigilixTools = {
        openStorageCalc,
        openNfpaCalc,
        openKitBuilder,
        toggleCompare,
        clearCompare,
        openCompareModal,
        syncCompareButtons,
        closeModal
    };
})();
