<?php
function getEnvValue($key) {
    if (!file_exists('.env')) return null;
    $lines = file('.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($name, $value) = explode('=', $line, 2);
        if (trim($name) == $key) return trim($value, '"');
    }
    return null;
}

$host = getEnvValue('DB_HOST') ?: '127.0.0.1';
$db   = getEnvValue('DB_DATABASE');
$user = getEnvValue('DB_USERNAME');
$pass = getEnvValue('DB_PASSWORD');

$mysqli = new mysqli($host, $user, $pass, $db);
if ($mysqli->connect_error) die("Connection failed: " . $mysqli->connect_error . "\n");

// Comprehensive list of all delivery statuses used in the app
$statuses = "'waiting', 'pending', 'confirmed', 'assigned', 'in_progress', 'delivered', 'failed'";
$sql = "ALTER TABLE deliveries MODIFY COLUMN status ENUM($statuses) NOT NULL DEFAULT 'waiting'";

if ($mysqli->query($sql) === TRUE) {
    echo "SUCCESS: Updated deliveries table with all required statuses.\n";
} else {
    echo "ERROR: " . $mysqli->error . "\n";
}
$mysqli->close();
