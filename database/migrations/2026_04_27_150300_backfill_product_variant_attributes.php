<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Pull existing legacy FK pairs from product_variants and write each non-NULL one into the pivot.
        $rows = DB::table('product_variants')
            ->select('id', 'size_value_id', 'color_value_id', 'weight_value_id')
            ->get();

        foreach ($rows as $row) {
            $pairs = [
                ['variant_id' => 1, 'variant_value_id' => $row->size_value_id],
                ['variant_id' => 2, 'variant_value_id' => $row->color_value_id],
                ['variant_id' => 3, 'variant_value_id' => $row->weight_value_id],
            ];
            foreach ($pairs as $p) {
                if (empty($p['variant_value_id'])) continue;
                $exists = DB::table('product_variant_attributes')
                    ->where('product_variant_id', $row->id)
                    ->where('variant_id', $p['variant_id'])
                    ->exists();
                if ($exists) continue;
                DB::table('product_variant_attributes')->insert([
                    'product_variant_id' => $row->id,
                    'variant_id'         => $p['variant_id'],
                    'variant_value_id'   => $p['variant_value_id'],
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
            }
        }

        // Supplier side: legacy columns are free-text (size/color/weight string), not FKs.
        // Best-effort match against variant_values.label, scoped to the right variant_id.
        $sRows = DB::table('supplier_product_variants')
            ->select('id', 'size', 'color', 'weight')
            ->get();
        foreach ($sRows as $row) {
            $pairs = [
                ['variant_id' => 1, 'text' => $row->size],
                ['variant_id' => 2, 'text' => $row->color],
                ['variant_id' => 3, 'text' => $row->weight],
            ];
            foreach ($pairs as $p) {
                $text = is_string($p['text']) ? trim($p['text']) : '';
                if ($text === '') continue;
                $vv = DB::table('variant_values')
                    ->where('variant_id', $p['variant_id'])
                    ->whereRaw('LOWER(label) = ?', [strtolower($text)])
                    ->value('id');
                if (!$vv) continue;
                $exists = DB::table('supplier_product_variant_attributes')
                    ->where('supplier_product_variant_id', $row->id)
                    ->where('variant_id', $p['variant_id'])
                    ->exists();
                if ($exists) continue;
                DB::table('supplier_product_variant_attributes')->insert([
                    'supplier_product_variant_id' => $row->id,
                    'variant_id'                  => $p['variant_id'],
                    'variant_value_id'            => $vv,
                    'created_at'                  => now(),
                    'updated_at'                  => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Non-reversible data backfill. No-op.
    }
};
