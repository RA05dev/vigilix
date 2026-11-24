<?php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function chatRespond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    chatRespond(['ok' => false, 'fallback' => true, 'error' => 'Método no permitido'], 405);
}

$configFile = __DIR__ . '/config.local.php';
if (!is_file($configFile)) {
    chatRespond(['ok' => false, 'fallback' => true, 'error' => 'Configuración no disponible']);
}

$config = require $configFile;
$apiKey = trim((string)($config['gemini_api_key'] ?? ''));
if ($apiKey === '' || !function_exists('curl_init')) {
    chatRespond(['ok' => false, 'fallback' => true, 'error' => 'IA no configurada']);
}

// Límite simple por sesión para evitar abuso
session_start();
$now = time();
$window = $_SESSION['vx_chat_ts'] ?? [];
$window = array_values(array_filter($window, static fn($ts) => ($now - (int)$ts) < 60));
if (count($window) >= 12) {
    chatRespond(['ok' => false, 'fallback' => false, 'reply' => 'Has enviado varias consultas seguidas. Espera unos segundos e intenta de nuevo.'], 429);
}
$window[] = $now;
$_SESSION['vx_chat_ts'] = $window;

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '{}', true);
if (!is_array($data)) {
    chatRespond(['ok' => false, 'fallback' => true, 'error' => 'Payload inválido'], 400);
}

$message = trim((string)($data['message'] ?? ''));
if ($message === '' || mb_strlen($message) > 600) {
    chatRespond(['ok' => false, 'fallback' => true, 'error' => 'Mensaje inválido'], 422);
}

$catalog = is_array($data['catalog'] ?? null) ? array_slice($data['catalog'], 0, 35) : [];
$cartSummary = trim((string)($data['cartSummary'] ?? 'Carrito vacío'));
$history = is_array($data['history'] ?? null) ? array_slice($data['history'], -6) : [];

$catalogLines = [];
foreach ($catalog as $item) {
    if (!is_array($item)) continue;
    $sku = (string)($item['sku'] ?? '');
    $name = (string)($item['name'] ?? '');
    $price = (string)($item['price'] ?? '');
    $cat = (string)($item['category'] ?? '');
    if ($sku && $name) {
        $catalogLines[] = "- [{$sku}] {$name} | {$cat} | S/ {$price}";
    }
}

$systemInstruction = implode("\n", [
    "Eres el asistente comercial y de ingeniería de Vigilix Security Distribution (Perú).",
    "Responde en español claro, profesional, conciso (máx. 95 palabras) y orientado a ayudar a elegir equipos o cerrar compra/cotización.",
    "No inventes productos ni precios fuera del catálogo proporcionado.",
    "Medios de pago aceptados: Tarjeta de Crédito/Débito (Visa, Mastercard, Amex), Yape, Plin y Pago contraentrega.",
    "Envíos: Lima Metropolitana S/ 10 (GRATIS desde S/ 500), Provincias vía Shalom/Olva S/ 25, Recojo coordinado Gratis.",
    "Cupones vigentes: VIGILIX10 (10% dcto desde S/ 100), PROYECTO5 (5% dcto), BIENVENIDO (S/ 20 desde S/ 150).",
    "Si recomiendas productos específicos, menciona su SKU exacto entre corchetes para que la interfaz muestre sus tarjetas.",
    "Estado actual del carrito del cliente: {$cartSummary}",
    "Catálogo disponible:",
    implode("\n", $catalogLines),
]);

$contents = [];
foreach ($history as $turn) {
    if (!is_array($turn)) continue;
    $role = ($turn['role'] ?? '') === 'model' ? 'model' : 'user';
    $text = trim((string)($turn['text'] ?? ''));
    if ($text !== '') {
        $contents[] = ['role' => $role, 'parts' => [['text' => mb_substr($text, 0, 400)]]];
    }
}
$contents[] = ['role' => 'user', 'parts' => [['text' => $message]]];

$model = preg_replace('/[^a-zA-Z0-9._-]/', '', (string)($config['gemini_model'] ?? 'gemini-2.5-flash')) ?: 'gemini-2.5-flash';
$url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . rawurlencode($apiKey);

$body = json_encode([
    'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
    'contents' => $contents,
    'generationConfig' => [
        'temperature' => 0.4,
        'maxOutputTokens' => 280,
    ],
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_CONNECTTIMEOUT => 6,
]);

$response = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode < 200 || $httpCode >= 300) {
    error_log("Vigilix Gemini API fallback: HTTP {$httpCode} {$curlErr}");
    chatRespond(['ok' => false, 'fallback' => true, 'error' => 'Fallback local activado']);
}

$decoded = json_decode($response, true);
$replyText = trim((string)($decoded['candidates'][0]['content']['parts'][0]['text'] ?? ''));
if ($replyText === '') {
    chatRespond(['ok' => false, 'fallback' => true, 'error' => 'Respuesta vacía']);
}

chatRespond(['ok' => true, 'ai' => true, 'reply' => $replyText]);
