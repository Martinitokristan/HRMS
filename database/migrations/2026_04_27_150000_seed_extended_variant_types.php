<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = [
            ['name' => 'Wattage',          'description' => 'Electrical wattage (e.g. 5W, 9W, 60W) for bulbs, fans, motors'],
            ['name' => 'Voltage',          'description' => 'Voltage rating (e.g. 12V DC, 220V AC) for wiring, breakers, power tools'],
            ['name' => 'Fitting Type',     'description' => 'Connection / fitting type (e.g. E27, GU10, threaded, push-fit)'],
            ['name' => 'Material',         'description' => 'Construction material (e.g. PVC, GI, copper, stainless steel, plywood)'],
            ['name' => 'Finish / Gloss',   'description' => 'Surface finish (e.g. matte, satin, semi-gloss, gloss, flat)'],
            ['name' => 'Volume / Capacity','description' => 'Liquid volume (e.g. 250ml, 1L, 4L, 16L)'],
            ['name' => 'Pressure / Grade', 'description' => 'Pressure rating or grade (e.g. Schedule 40, PN16, Grade 40, A36)'],
        ];
        foreach ($rows as $r) {
            $exists = DB::table('variants')->where('name', $r['name'])->exists();
            if (!$exists) {
                DB::table('variants')->insert([
                    'name'        => $r['name'],
                    'status'      => 'active',
                    'description' => $r['description'],
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('variants')->whereIn('name', [
            'Wattage', 'Voltage', 'Fitting Type', 'Material',
            'Finish / Gloss', 'Volume / Capacity', 'Pressure / Grade',
        ])->delete();
    }
};
