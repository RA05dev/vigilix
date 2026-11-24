<?php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);
mysqli_report(MYSQLI_REPORT_OFF);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function orderRespond(bool $success, string $message, int $status = 200, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(array_merge(['exito' => $success, 'mensaje' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    orderRespond(false, 'Método no permitido.', 405);
}

$configFile = __DIR__ . '/config.local.php';
if (!is_file($configFile)) {
    orderRespond(false, 'Conexión de pedidos aún no configurada.', 503);
}

$config = require $configFile;
foreach (['host', 'user', 'pass', 'db'] as $requiredKey) {
    if (!isset($config[$requiredKey]) || !is_string($config[$requiredKey])) {
        orderRespond(false, 'Configuración de servidor incompleta.', 503);
    }
}

$raw = file_get_contents('php://input');
$order = json_decode($raw ?: '{}', true);
if (!is_array($order)) {
    orderRespond(false, 'Formato de pedido inválido.', 400);
}

$orderCode = trim((string)($order['id'] ?? ''));
$shipping = is_array($order['shipping'] ?? null) ? $order['shipping'] : [];
$items = is_array($order['items'] ?? null) ? $order['items'] : [];

$clienteNombre = trim((string)($shipping['name'] ?? ''));
$clienteCelular = trim((string)($shipping['phone'] ?? ''));
$clienteCorreo = trim((string)($shipping['email'] ?? ''));
$metodoEntrega = trim((string)($shipping['deliveryMethod'] ?? 'delivery-lima'));
$direccion = trim((string)($shipping['address'] ?? ''));
$distrito = trim((string)($shipping['district'] ?? ''));
$referencia = trim((string)($shipping['reference'] ?? ''));

$metodoPago = trim((string)($order['paymentMethod'] ?? 'cash-on-delivery'));
$detallePago = trim((string)($order['paymentDetail'] ?? ''));
$estado = trim((string)($order['status'] ?? 'pending-confirmation'));
$cupon = trim((string)($order['coupon'] ?? ''));

$subtotal = max(0.0, (float)($order['subtotal'] ?? 0));
$descuento = max(0.0, (float)($order['discount'] ?? 0));
$costoEnvio = max(0.0, (float)($order['shippingCost'] ?? 0));
$total = max(0.0, (float)($order['total'] ?? 0));

if ($orderCode === '' || $clienteNombre === '' || $clienteCelular === '' || !filter_var($clienteCorreo, FILTER_VALIDATE_EMAIL) || empty($items)) {
    orderRespond(false, 'Faltan datos obligatorios del pedido.', 422);
}

// Sanitizar resumen de ítems (nunca guardar datos sensibles de tarjeta)
$safeItems = [];
foreach (array_slice($items, 0, 50) as $it) {
    if (!is_array($it)) continue;
    $safeItems[] = [
        'sku' => substr((string)($it['sku'] ?? ''), 0, 40),
        'name' => substr((string)($it['name'] ?? ''), 0, 140),
        'qty' => max(1, (int)($it['quantity'] ?? 1)),
        'price' => max(0.0, (float)($it['price'] ?? 0)),
        'subtotal' => max(0.0, (float)($it['subtotal'] ?? 0)),
    ];
}
$itemsJson = json_encode($safeItems, JSON_UNESCAPED_UNICODE);

$conn = @new mysqli($config['host'], $config['user'], $config['pass'], $config['db']);
if ($conn->connect_errno) {
    error_log('Vigilix pedidos MySQL error: ' . $conn->connect_error);
    orderRespond(false, 'No se pudo conectar con la base de datos.', 503);
}
$conn->set_charset('utf8mb4');

$createTableSql = <<<SQL
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_pedido VARCHAR(40) NOT NULL UNIQUE,
    cliente_nombre VARCHAR(150) NOT NULL,
    cliente_celular VARCHAR(30) NOT NULL,
    cliente_correo VARCHAR(150) NOT NULL,
    metodo_entrega VARCHAR(40) NOT NULL,
    direccion VARCHAR(255) DEFAULT '',
    distrito VARCHAR(120) DEFAULT '',
    referencia VARCHAR(255) DEFAULT '',
    metodo_pago VARCHAR(40) NOT NULL,
    detalle_pago VARCHAR(255) DEFAULT '',
    cupon VARCHAR(40) DEFAULT '',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    costo_envio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(40) NOT NULL DEFAULT 'pending-confirmation',
    items_json TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;

$conn->query($createTableSql);

$sql = 'INSERT INTO pedidos (codigo_pedido, cliente_nombre, cliente_celular, cliente_correo, metodo_entrega, direccion, distrito, referencia, metodo_pago, detalle_pago, cupon, subtotal, descuento, costo_envio, total, estado, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log('Vigilix pedidos prepare error: ' . $conn->error);
    $conn->close();
    orderRespond(false, 'No se pudo preparar el registro del pedido.', 500);
}

$stmt->bind_param(
    'sssssssssssddddss',
    $orderCode,
    $clienteNombre,
    $clienteCelular,
    $clienteCorreo,
    $metodoEntrega,
    $direccion,
    $distrito,
    $referencia,
    $metodoPago,
    $detallePago,
    $cupon,
    $subtotal,
    $descuento,
    $costoEnvio,
    $total,
    $estado,
    $itemsJson
);

if (!$stmt->execute()) {
    error_log('Vigilix pedidos insert error: ' . $stmt->error);
    $stmt->close();
    $conn->close();
    orderRespond(false, 'No se pudo guardar el pedido en el servidor.', 500);
}

$insertId = $stmt->insert_id;
$stmt->close();
$conn->close();

orderRespond(true, 'Pedido registrado correctamente.', 201, ['id_registro' => $insertId, 'codigo_pedido' => $orderCode]);
