<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = \App\Models\User::where('email', 'admin@hrms.com')->first();
echo "User loaded.\n";

$json = json_encode($user);
if ($json === false) {
    echo "json_encode failed: " . json_last_error_msg() . "\n";
} else {
    echo "json_encode success! Length: " . strlen($json) . "\n";
}

$user->update(['last_login_at' => now()]);
echo "User updated.\n";
