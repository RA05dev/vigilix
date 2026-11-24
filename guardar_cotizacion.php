<?php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);
mysqli_report(MYSQLI_REPORT_OFF);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(bool $success, string $message, int $status = 200, array $extra = [])
{
    http_response_code($status);
    echo json_encode(array_merge(['exito' => $success, 'mensaje' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(false, 'Método no permitido.', 405);

$configFile = __DIR__ . '/config.local.php';
if (!is_file($configFile)) respond(false, 'La conexión de cotizaciones aún no está configurada.', 503);

$config = require $configFile;
foreach (['host', 'user', 'pass', 'db'] as $requiredKey) {
    if (!isset($config[$requiredKey]) || !is_string($config[$requiredKey])) respond(false, 'La configuración del servidor está incompleta.', 503);
}

$fields = [
    'razon_social' => trim((string)($_POST['razon_social'] ?? '')),
    'ruc_dni' => trim((string)($_POST['ruc_dni'] ?? '')),
    'correo' => trim((string)($_POST['correo'] ?? '')),
    'telefono' => trim((string)($_POST['telefono'] ?? '')),
    'solucion_proyecto' => trim((string)($_POST['solucion_proyecto'] ?? '')),
    'descripcion' => trim((string)($_POST['descripcion'] ?? '')),
];

if ($fields['razon_social'] === '' || $fields['ruc_dni'] === '' || $fields['telefono'] === '' || $fields['descripcion'] === '') respond(false, 'Completa todos los campos obligatorios.', 422);
if (!filter_var($fields['correo'], FILTER_VALIDATE_EMAIL)) respond(false, 'Ingresa un correo válido.', 422);
foreach ($fields as $value) {
    if (mb_strlen($value) > 2000) respond(false, 'Uno de los campos supera el tamaño permitido.', 422);
}

$totalEstimado = filter_var($_POST['total_estimado'] ?? 0, FILTER_VALIDATE_FLOAT);
$totalEstimado = $totalEstimado === false ? 0.0 : max(0.0, (float)$totalEstimado);

$conn = @new mysqli($config['host'], $config['user'], $config['pass'], $config['db']);
if ($conn->connect_errno) {
    error_log('Vigilix MySQL connection error: ' . $conn->connect_error);
    respond(false, 'No se pudo registrar la cotización en este momento.', 503);
}
$conn->set_charset('utf8mb4');

$sql = 'INSERT INTO cotizar (razon_social, ruc_dni, correo, telefono, solucion_proyecto, descripcion, total_estimado) VALUES (?, ?, ?, ?, ?, ?, ?)';
$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log('Vigilix prepare error: ' . $conn->error);
    $conn->close();
    respond(false, 'No se pudo registrar la cotización en este momento.', 500);
}

$stmt->bind_param('ssssssd', $fields['razon_social'], $fields['ruc_dni'], $fields['correo'], $fields['telefono'], $fields['solucion_proyecto'], $fields['descripcion'], $totalEstimado);
if (!$stmt->execute()) {
    error_log('Vigilix insert error: ' . $stmt->error);
    $stmt->close();
    $conn->close();
    respond(false, 'No se pudo registrar la cotización en este momento.', 500);
}

$insertId = $stmt->insert_id;
$stmt->close();
$conn->close();
respond(true, 'Cotización guardada con éxito.', 201, ['id_generado' => $insertId]);
