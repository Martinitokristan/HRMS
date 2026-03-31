<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

try {
    DB::statement("ALTER TABLE sales ADD payment_phone_number VARCHAR(255) NULL, ADD payment_reference VARCHAR(255) NULL, ADD payment_proof_path VARCHAR(255) NULL");
    DB::statement("ALTER TABLE sales MODIFY status ENUM('pending_payment', 'verifying_payment', 'pending', 'confirmed', 'out_for_delivery', 'delivered', 'returned', 'cancelled') DEFAULT 'pending'");
    echo "SUCCESS\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
