<?php

namespace App\Services\Settings;

use App\Models\UnitConversion;
use App\Models\UnitType;
use App\Events\DataMutated;

class UnitConversionService
{
    /**
     * Get all unit types.
     */
    public function getUnitTypes()
    {
        return [
            'data' => UnitType::all(),
            'status_code' => 200,
        ];
    }

    /**
     * Save unit conversion (create or update).
     */
    public function saveUnitConversion($data)
    {
        $conv = UnitConversion::updateOrCreate(
            ['id' => $data['id'] ?? null],
            [
                'category_id' => $data['category_id'] ?? null,
                'purchase_unit' => $data['purchase_unit'],
                'sell_unit' => $data['sell_unit'],
                'conversion_factor' => $data['conversion_factor'],
            ]
        );

        return [
            'data' => $conv,
            'status_code' => 200,
        ];
    }

    /**
     * Delete unit conversion.
     */
    public function deleteUnitConversion($id)
    {
        UnitConversion::destroy($id);

        return [
            'status_code' => 200,
        ];
    }

    /**
     * Save unit type (create or update).
     */
    public function saveUnitType($data)
    {
        $unit = UnitType::updateOrCreate(
            ['id' => $data['id'] ?? null],
            [
                'purchase_unit' => $data['purchase_unit'],
                'sell_unit' => $data['sell_unit'],
                'multiplier' => $data['multiplier'],
            ]
        );

        return [
            'data' => $unit,
            'status_code' => 200,
        ];
    }

    /**
     * Delete unit type.
     */
    public function deleteUnitType($id)
    {
        UnitType::destroy($id);
        broadcast(new DataMutated('private-admin', ['admin_settings'], 'unit_type.deleted'));

        return [
            'status_code' => 200,
        ];
    }

    /**
     * Store new unit type.
     */
    public function storeUnitType($data)
    {
        $unit = UnitType::create([
            'purchase_unit' => $data['purchase_unit'],
            'sell_unit' => $data['sell_unit'],
            'multiplier' => $data['multiplier'],
        ]);

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'unit_type.created'));

        return [
            'data' => $unit,
            'status_code' => 201,
        ];
    }
}
