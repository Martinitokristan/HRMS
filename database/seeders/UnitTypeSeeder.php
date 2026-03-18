<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class UnitTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $unitTypes = [
            ['purchase_unit' => 'Units', 'sell_unit' => 'Units', 'multiplier' => 1],
            ['purchase_unit' => 'Box', 'sell_unit' => 'Pieces', 'multiplier' => 12],
            ['purchase_unit' => 'Dozen', 'sell_unit' => 'Pieces', 'multiplier' => 12],
            ['purchase_unit' => 'Kilogram', 'sell_unit' => 'Grams', 'multiplier' => 1000],
            ['purchase_unit' => 'Liter', 'sell_unit' => 'Milliliter', 'multiplier' => 1000],
            ['purchase_unit' => 'Case', 'sell_unit' => 'Units', 'multiplier' => 24],
            ['purchase_unit' => 'Pack', 'sell_unit' => 'Units', 'multiplier' => 6],
        ];

        foreach ($unitTypes as $unitType) {
            \App\Models\UnitType::firstOrCreate(
                ['purchase_unit' => $unitType['purchase_unit'], 'sell_unit' => $unitType['sell_unit']],
                $unitType
            );
        }
    }
}
