<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Pull every (admin product_variant, supplier_product_variant) pair that share an inventory row,
        // then overwrite the admin variant's barcode with the supplier's barcode whenever the admin
        // value is empty or starts with the legacy auto-generated 'VAR-' prefix.
        $rows = DB::table('inventory as i')
            ->join('product_variants as pv', 'pv.id', '=', 'i.product_variant_id')
            ->join('supplier_product_variants as spv', 'spv.id', '=', 'i.supplier_product_variant_id')
            ->whereNotNull('i.product_variant_id')
            ->whereNotNull('i.supplier_product_variant_id')
            ->select('pv.id as pv_id', 'pv.barcode as pv_barcode', 'spv.barcode as spv_barcode')
            ->get();

        foreach ($rows as $row) {
            $needsBackfill = is_null($row->pv_barcode)
                || $row->pv_barcode === ''
                || str_starts_with((string) $row->pv_barcode, 'VAR-');
            if (!$needsBackfill) {
                continue;
            }
            $newBarcode = ($row->spv_barcode !== null && $row->spv_barcode !== '') ? $row->spv_barcode : null;
            DB::table('product_variants')->where('id', $row->pv_id)->update(['barcode' => $newBarcode]);
        }
    }

    public function down(): void
    {
        // Non-reversible data backfill. No-op.
    }
};
