(function () {
    'use strict';

    const CART_KEY = 'vigilix_cart_v1';
    const SHIPPING_KEY = 'vigilix_shipping_v1';
    const ORDER_KEY = 'vigilix_last_order_v1';

    const PRODUCTS = {
        'VGX-A9-TUYA': {
            sku: 'VGX-A9-TUYA',
            name: 'Mini Cámara de Seguridad Wi‑Fi Magnética A9',
            price: 59.90,
            currency: 'PEN',
            category: 'Videovigilancia residencial',
            image: 'assets/a9-camera.svg',
            description: 'Cámara compacta para supervisar hogares, oficinas pequeñas y negocios desde una aplicación móvil compatible.',
            features: ['Visualización remota desde el celular', 'Conectividad mediante red Wi‑Fi', 'Base magnética de instalación flexible', 'Formato compacto para interiores'],
            specs: { 'Conectividad': 'Wi‑Fi', 'Montaje': 'Base magnética', 'Uso recomendado': 'Interiores', 'Control': 'Aplicación móvil compatible' }
        },
        'HKV-7732NI-K4': {
            sku: 'HKV-7732NI-K4', name: 'NVR Hikvision DS-7732NI-K4/16P', price: 650, currency: 'PEN', category: 'Videovigilancia IP',
            image: 'https://assets.hikvision.com/prd/normal/all/image/m000000603/MB-202Y-P-HIKVISION.png',
            description: 'Grabador de red profesional para proyectos de videovigilancia IP con alimentación PoE integrada.',
            features: ['32 canales de cámaras IP', '16 puertos PoE integrados', 'Grabación hasta 12 MP', '4 bahías SATA y salida HDMI dual'],
            specs: { 'Canales IP': '32', 'Puertos PoE': '16', 'Bahías SATA': '4', 'Resolución máxima': '12 MP' }
        },
        'HKV-BULLET-4MP': {
            sku: 'HKV-BULLET-4MP', name: 'Cámara Bullet IP 4MP IR AcuSense', price: 290, currency: 'PEN', category: 'Videovigilancia IP',
            image: 'assets/camera-bullet.svg',
            description: 'Cámara IP tipo bullet para vigilancia exterior con iluminación infrarroja y analítica de personas y vehículos.',
            features: ['Resolución de 4 MP', 'Analítica de personas y vehículos', 'Iluminación infrarroja', 'Diseño para instalación exterior'],
            specs: { 'Resolución': '4 MP', 'Formato': 'Bullet IP', 'Analítica': 'AcuSense', 'Uso recomendado': 'Exteriores' }
        },
        'SMP-4007ES-HYB': {
            sku: 'SMP-4007ES-HYB', name: 'Panel de Detección Contra Incendio Simplex 4007ES', price: 1240, currency: 'PEN', category: 'Detección de incendios',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_UsgTMuZECKRhTvej78eWqLyGc1swAM_NRDuuwPqqQqcWkK6XRrrnFOA&s=10',
            description: 'Panel direccionable para supervisión y control de sistemas de detección de incendios en instalaciones comerciales.',
            features: ['Capacidad expandible hasta 250 puntos', 'Pantalla táctil a color de 4.3 pulgadas', 'Circuitos NAC Clase A/B', 'Arquitectura híbrida direccionable'],
            specs: { 'Familia': 'Simplex 4007ES', 'Capacidad': 'Hasta 250 puntos', 'Pantalla': 'Táctil 4.3 pulgadas', 'Aplicación': 'Detección de incendios' }
        },
        'HON-ES50X': {
            sku: 'HON-ES50X', name: 'Panel Contra Incendios Honeywell Fire-Lite ES-50X', price: 890, currency: 'PEN', category: 'Detección de incendios',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTvbtFUKK5K2234jHR8rZ2BtLofrzcdCIwUUvlPnyzM0DjzGlREkfSF9KI&s=10',
            description: 'Panel direccionable compacto para proyectos de detección y alarma con programación y comunicaciones integradas.',
            features: ['Hasta 50 dispositivos direccionables SLC', 'Comunicador IP y línea telefónica', 'Programación mediante USB', 'Operación desde teclado frontal'],
            specs: { 'Marca': 'Honeywell Fire-Lite', 'Dispositivos SLC': 'Hasta 50', 'Programación': 'USB y teclado', 'Aplicación': 'Detección de incendios' }
        },
        'HKV-DS2DE7A432': {
            sku: 'HKV-DS2DE7A432', name: 'Domo PTZ IP 4MP Zoom 32X AcuSense', price: 540, currency: 'PEN', category: 'Videovigilancia IP',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT8hW-IW3ceJwrx6XHav7Jojji8SwswsZbFc7oAiCx2p1b7No6F2QsMjafk&s=10',
            description: 'Cámara PTZ profesional para supervisión de áreas amplias con zoom óptico y seguimiento inteligente.',
            features: ['Resolución de 4 MP', 'Zoom óptico 32X', 'Iluminación IR de largo alcance', 'Analítica AcuSense'],
            specs: { 'Resolución': '4 MP', 'Zoom óptico': '32X', 'Protección': 'IP67 / IK10', 'Tecnología': 'DarkFighter y AcuSense' }
        },
        'HKV-K1T671M': {
            sku: 'HKV-K1T671M', name: 'Terminal Facial y Huella Hikvision DS-K1T671M', price: 345, currency: 'PEN', category: 'Control de acceso',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSEcwZbg44_rZ1yMgXa4TovryMFl-VK512ih0I3dj1omKfKEvcgT95wOKw6&s=10',
            description: 'Terminal biométrico para control de accesos y asistencia mediante reconocimiento facial y huella.',
            features: ['Pantalla táctil de 7 pulgadas', 'Capacidad para 6,000 rostros', 'Capacidad para 5,000 huellas', 'Detección de rostro vivo'],
            specs: { 'Pantalla': '7 pulgadas', 'Rostros': '6,000', 'Huellas': '5,000', 'Aplicación': 'Acceso y asistencia' }
        },
        'PWR-UPS3KVA-RT': {
            sku: 'PWR-UPS3KVA-RT', name: 'UPS Online 3KVA / 2700W Rack 2U', price: 780, currency: 'PEN', category: 'Redes y energía',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtoRVa4BMDHcnwf_cBG8bXoEk4pm85XBcp6YDwLnqkxw&s=10',
            description: 'Sistema de energía ininterrumpida para proteger grabadores, switches y servidores de seguridad.',
            features: ['Doble conversión online', 'Potencia de 3 KVA / 2700 W', 'Formato rack 2U', 'Gestión SNMP opcional'],
            specs: { 'Potencia': '3 KVA / 2700 W', 'Formato': 'Rack 2U', 'Topología': 'Doble conversión', 'Factor de potencia': '0.9' }
        },
        'WDP-80PURZ': {
            sku: 'WDP-80PURZ', name: 'Disco Duro WD Purple 8TB Surveillance', price: 215, currency: 'PEN', category: 'Almacenamiento',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQbSqwg3I9pJJ19LiUa7haxFWg6zFOUGgd4O7YikvMnwHnABfiZZosVnxaB&s=10',
            description: 'Unidad de almacenamiento diseñada para grabación continua en sistemas de videovigilancia.',
            features: ['Capacidad de 8 TB', 'Operación continua 24/7', 'Optimizado para videovigilancia', 'Compatible con grabadores NVR/DVR'],
            specs: { 'Capacidad': '8 TB', 'Uso': 'Videovigilancia 24/7', 'Familia': 'WD Purple', 'Tipo': 'Disco duro interno' }
        },
        'SW-POE24-380W': {
            sku: 'SW-POE24-380W', name: 'Switch Gigabit PoE+ 24 Puertos 380W L2+', price: 320, currency: 'PEN', category: 'Redes y energía',
            image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80',
            description: 'Switch administrable para alimentar y conectar cámaras IP, puntos de acceso y dispositivos PoE.',
            features: ['24 puertos Gigabit PoE+', 'Presupuesto PoE de 380 W', 'Administración de capa 2+', 'Aplicación en redes de seguridad'],
            specs: { 'Puertos': '24 Gigabit', 'PoE': 'PoE+', 'Presupuesto': '380 W', 'Gestión': 'Capa 2+' }
        },
        'SYS-2W-B': {
            sku: 'SYS-2W-B', name: 'Pack 10 Detectores de Humo Fotoeléctricos', price: 280, currency: 'PEN', category: 'Detección de incendios',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLZA6hnVYnK9w33n8QGciSGM9geQVnO1vAK6FQqS-TFzuMLsEhJqmBu3VR&s=10',
            description: 'Pack de detectores fotoeléctricos con base para sistemas convencionales de alarma contra incendios.',
            features: ['10 detectores con base', 'Tecnología fotoeléctrica', 'Instalación en techo', 'Integración con panel compatible'],
            specs: { 'Cantidad': '10 unidades', 'Tecnología': 'Fotoeléctrica', 'Incluye': 'Bases', 'Aplicación': 'Detección de humo' }
        },
        'CAB-CAT6-LSZH': {
            sku: 'CAB-CAT6-LSZH', name: 'Cable UTP Cat6 LSZH 305m', price: 165, currency: 'PEN', category: 'Redes y energía',
            image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQM2fabKoDBZIRn9qlIFI4ODfKBgQkTh0BcjzJpLq5bjDkca0tu2Rwtmos&s=10',
            description: 'Bobina de cable de red categoría 6 para instalaciones de datos y videovigilancia IP.',
            features: ['Longitud de 305 metros', 'Conductor 100% cobre', 'Cubierta libre de halógeno', 'Aplicación en redes Gigabit'],
            specs: { 'Categoría': 'Cat6', 'Longitud': '305 m', 'Conductor': 'Cobre', 'Cubierta': 'LSZH' }
        },
        'LIC-HC-VSS-64': {
            sku: 'LIC-HC-VSS-64', name: 'HikCentral Professional Base + 64 Canales', price: 1450, currency: 'PEN', category: 'Licencias VMS', image: 'assets/software-vms.svg',
            description: 'Plataforma centralizada para administrar video, alarmas, mapas y operadores desde una sola interfaz.',
            features: ['Base con 64 canales de video', 'Clientes web, escritorio y móvil', 'Mapas interactivos', 'Soporte para alta disponibilidad'],
            specs: { 'Tipo': 'Licencia perpetua', 'Canales': '64', 'Plataforma': 'HikCentral Professional', 'Entrega': 'Activación electrónica' }
        },
        'LIC-HC-ANPR-1CH': {
            sku: 'LIC-HC-ANPR-1CH', name: 'Licencia LPR para Acceso Vehicular', price: 240, currency: 'PEN', category: 'Licencias VMS', image: 'assets/software-vms.svg',
            description: 'Módulo de analítica para lectura de placas, listas de acceso y control de barreras vehiculares.',
            features: ['Licencia de expansión por canal', 'Listas blancas y negras', 'Reportes de permanencia', 'Integración con barreras'],
            specs: { 'Tipo': 'Módulo LPR', 'Canales': '1', 'Aplicación': 'Acceso vehicular', 'Entrega': 'Activación electrónica' }
        },
        'LIC-HC-ACS-16D': {
            sku: 'LIC-HC-ACS-16D', name: 'Licencia Acceso y Asistencia para 16 Puertas', price: 490, currency: 'PEN', category: 'Licencias VMS', image: 'assets/software-vms.svg',
            description: 'Módulo para gestionar accesos, horarios, asistencia y eventos de hasta 16 puertas.',
            features: ['Gestión de 16 puertas', 'Horarios y turnos', 'Integración con ERP', 'Monitoreo de eventos'],
            specs: { 'Tipo': 'Acceso y asistencia', 'Puertas': '16', 'Integración': 'SQL / API', 'Entrega': 'Activación electrónica' }
        },
        'LIC-BMS-FIRE-GW': {
            sku: 'LIC-BMS-FIRE-GW', name: 'Gateway BMS y Estación Gráfica de Incendio', price: 980, currency: 'PEN', category: 'Licencias VMS', image: 'assets/software-vms.svg',
            description: 'Interfaz para visualizar eventos de incendio sobre planos y comunicar paneles con plataformas BMS.',
            features: ['Visualización sobre planos', 'Protocolos BACnet IP y Modbus TCP', 'Historial de eventos', 'Integración con paneles compatibles'],
            specs: { 'Tipo': 'Gateway BMS', 'Protocolos': 'BACnet IP / Modbus TCP', 'Aplicación': 'Monitoreo de incendios', 'Entrega': 'Activación electrónica' }
        }
    };

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
        const cart = getCart();
        const existing = cart.find(item => item.sku === sku);
        if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
        else cart.push({ sku, quantity: Math.max(1, quantity) });
        saveCart(cart);
        track('add_to_cart', { items: [gaItem(PRODUCTS[sku], quantity)], value: PRODUCTS[sku].price * quantity });
        return cart;
    }

    function updateQuantity(sku, quantity) {
        const next = Math.max(0, Math.min(99, Number(quantity) || 0));
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
        if (product && current) track('remove_from_cart', { items: [gaItem(product, current.quantity)], value: product.price * current.quantity });
        return cart;
    }

    function clearCart() {
        saveCart([]);
    }

    function getDetailedCart() {
        return getCart().map(item => ({ ...PRODUCTS[item.sku], quantity: item.quantity, subtotal: PRODUCTS[item.sku].price * item.quantity }));
    }

    function subtotal() {
        return getDetailedCart().reduce((sum, item) => sum + item.subtotal, 0);
    }

    function count() {
        return getCart().reduce((sum, item) => sum + item.quantity, 0);
    }

    function formatMoney(value) {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
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

    function trackCartEvent(eventName, extra = {}) {
        const items = getDetailedCart();
        track(eventName, {
            items: items.map(item => gaItem(item, item.quantity)),
            value: subtotal(),
            ...extra
        });
    }

    function saveShipping(data) {
        writeJson(SHIPPING_KEY, data);
    }

    function getShipping() {
        return readJson(SHIPPING_KEY, null);
    }

    function shippingCost(method) {
        return method === 'delivery-lima' ? 10 : 0;
    }

    function makeOrder() {
        const items = getDetailedCart();
        const shipping = getShipping();
        if (!items.length || !shipping) throw new Error('El pedido está incompleto');
        const deliveryCost = shippingCost(shipping.deliveryMethod);
        const now = new Date();
        const order = {
            id: `VGX-${now.getFullYear()}-${String(Date.now()).slice(-6)}`,
            createdAt: now.toISOString(),
            items,
            shipping,
            subtotal: subtotal(),
            shippingCost: deliveryCost,
            total: subtotal() + deliveryCost,
            paymentMethod: 'cash-on-delivery',
            status: 'pending-confirmation'
        };
        writeJson(ORDER_KEY, order);
        track('purchase', {
            transaction_id: order.id,
            value: order.total,
            shipping: order.shippingCost,
            items: items.map(item => gaItem(item, item.quantity))
        });
        clearCart();
        return order;
    }

    function getLastOrder() {
        return readJson(ORDER_KEY, null);
    }

    window.VigilixCommerce = {
        PRODUCTS,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        getCart,
        getDetailedCart,
        subtotal,
        count,
        formatMoney,
        track,
        trackCartEvent,
        saveShipping,
        getShipping,
        shippingCost,
        makeOrder,
        getLastOrder
    };
})();
