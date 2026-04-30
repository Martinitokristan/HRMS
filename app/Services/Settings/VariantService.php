<?php

namespace App\Services\Settings;

use App\Models\Variant;
use App\Models\VariantValue;
use App\Models\CategoryVariantType;
use App\Events\DataMutated;
use DB;

class VariantService
{
    /**
     * Get all variant values.
     */
    public function getVariantValues()
    {
        return [
            'data' => Variant::with('values')->get(),
            'status_code' => 200,
        ];
    }

    /**
     * Save variant value (create or update).
     */
    public function saveVariantValue($data)
    {
        $value = VariantValue::updateOrCreate(
            ['id' => $data['id'] ?? null],
            [
                'variant_id' => $data['variant_id'],
                'label' => $data['label'],
                'hex_code' => $data['hex_code'] ?? null,
                'description' => $data['description'] ?? null,
                'category' => $data['category'] ?? null,
            ]
        );

        return [
            'data' => $value,
            'status_code' => 200,
        ];
    }

    /**
     * Store new variant value.
     */
    public function storeVariantValue($data)
    {
        $value = VariantValue::create([
            'variant_id' => $data['variant_id'],
            'label' => $data['label'],
            'hex_code' => $data['hex_code'] ?? null,
            'description' => $data['description'] ?? null,
            'category' => $data['category'] ?? null,
        ]);

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_value.created'));

        return [
            'data' => $value,
            'status_code' => 201,
        ];
    }

    /**
     * Update variant value with duplicate label check.
     */
    public function updateVariantValue($id, $data)
    {
        $value = VariantValue::findOrFail($id);

        if (isset($data['label'])) {
            $exists = VariantValue::where('variant_id', $value->variant_id)
                ->where('id', '!=', $value->id)
                ->whereRaw('LOWER(label) = ?', [strtolower($data['label'])])
                ->exists();

            if ($exists) {
                return [
                    'error' => 'Another value with this label already exists for this attribute.',
                    'status_code' => 422,
                ];
            }
        }

        $value->update($data);
        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_value.updated'));

        return [
            'data' => $value,
            'status_code' => 200,
        ];
    }

    /**
     * Delete variant value.
     */
    public function deleteVariantValue($id)
    {
        VariantValue::destroy($id);
        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_value.deleted'));

        return [
            'status_code' => 200,
        ];
    }

    /**
     * List variant types.
     */
    public function listVariantTypes()
    {
        return [
            'data' => Variant::orderBy('id')->get(),
            'status_code' => 200,
        ];
    }

    /**
     * Store new variant type.
     */
    public function storeVariantType($data)
    {
        $variant = Variant::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'icon' => $data['icon'] ?? null,
            'status' => 'active',
        ]);

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_type.created'));

        return [
            'data' => $variant,
            'status_code' => 201,
        ];
    }

    /**
     * Update variant type.
     */
    public function updateVariantType($id, $data)
    {
        $variant = Variant::findOrFail($id);
        $variant->update($data);

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_type.updated'));

        return [
            'data' => $variant,
            'status_code' => 200,
        ];
    }

    /**
     * Delete variant type with validation.
     */
    public function deleteVariantType($id)
    {
        $inUse = DB::table('product_variant_attributes')->where('variant_id', $id)->exists()
            || DB::table('supplier_product_variant_attributes')->where('variant_id', $id)->exists();

        if ($inUse) {
            return [
                'error' => 'Cannot delete — this attribute type is used by existing variants. Remove or reassign those variants first.',
                'status_code' => 422,
            ];
        }

        DB::table('category_variant_types')->where('variant_id', $id)->delete();
        DB::table('variant_values')->where('variant_id', $id)->delete();
        Variant::where('id', $id)->delete();

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_type.deleted'));

        return [
            'status_code' => 200,
        ];
    }

    /**
     * Save variant type (create or update).
     */
    public function saveVariantType($data)
    {
        $type = Variant::updateOrCreate(
            ['id' => $data['id'] ?? null],
            [
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? 'active',
                'icon' => $data['icon'] ?? null,
            ]
        );

        return [
            'data' => $type,
            'status_code' => 200,
        ];
    }

    /**
     * List category variant type mappings.
     */
    public function listCategoryVariantTypes($categoryId = null)
    {
        $q = CategoryVariantType::with('variant')->orderBy('sort_order');

        if ($categoryId) {
            $q->where('category_id', $categoryId);
        }

        return [
            'data' => $q->get(),
            'status_code' => 200,
        ];
    }

    /**
     * Store category variant type mapping.
     */
    public function storeCategoryVariantType($data)
    {
        $row = CategoryVariantType::firstOrCreate(
            [
                'category_id' => $data['category_id'],
                'variant_id' => $data['variant_id'],
            ],
            [
                'is_required' => $data['is_required'] ?? false,
                'sort_order' => $data['sort_order'] ?? 0,
            ]
        );

        return [
            'data' => $row->load('variant'),
            'status_code' => 200,
        ];
    }

    /**
     * Delete category variant type mapping.
     */
    public function deleteCategoryVariantType($id)
    {
        CategoryVariantType::where('id', $id)->delete();

        return [
            'status_code' => 200,
        ];
    }
}
