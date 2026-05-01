<?php

namespace App\Http\Controllers;

use App\Services\Settings\SettingsService;
use App\Services\Settings\VariantService;
use App\Services\Settings\UnitConversionService;
use App\Services\Settings\CategoryService;
use App\Services\Settings\NotificationService;
use Illuminate\Http\Request;

class SettingsController extends Controller
{

    /**
     * Get all settings.
     */
    public function index(Request $request, SettingsService $settingsService)
    {
        $includeMasterlist = $request->get('include_masterlist', false);
        $includeVariants = $request->get('include_variants', false);

        $result = $settingsService->getAll(
            $request->user(),
            $includeMasterlist,
            $includeVariants
        );

        return response()->json([
            'data' => $result['data'],
            'status' => 'success',
        ], $result['status_code']);
    }

    /**
     * Update settings.
     */
    public function update(Request $request, SettingsService $settingsService)
    {
        if ($request->has('settings')) {
            $request->validate([
                'group' => 'required|string',
                'settings' => 'required|array',
            ]);

            $result = $settingsService->update($request->group, $request->settings);

            return response()->json([
                'message' => 'Settings saved successfully',
                'status' => 'success',
            ], $result['status_code']);
        }

        return response()->json([
            'message' => 'Settings saved successfully',
            'status' => 'success',
        ]);
    }

    /**
     * Save variant value (create or update).
     */
    public function saveVariantValue(Request $request, VariantService $variantService)
    {
        $request->validate([
            'variant_id' => 'required|exists:variants,id',
            'label' => 'required|string',
        ]);

        $result = $variantService->saveVariantValue($request->all());

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Save variant type (create or update).
     */
    public function saveVariantType(Request $request, VariantService $variantService)
    {
        $request->validate(['name' => 'required|string']);

        $result = $variantService->saveVariantType($request->all());

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Delete variant value.
     */
    public function deleteVariantValue($id, VariantService $variantService)
    {
        $result = $variantService->deleteVariantValue($id);

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Save unit conversion (create or update).
     */
    public function saveUnitConversion(Request $request, UnitConversionService $unitService)
    {
        $request->validate([
            'purchase_unit' => 'required|string',
            'sell_unit' => 'required|string',
            'conversion_factor' => 'required|numeric',
        ]);

        $result = $unitService->saveUnitConversion($request->all());

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Delete unit conversion.
     */
    public function deleteUnitConversion($id, UnitConversionService $unitService)
    {
        $result = $unitService->deleteUnitConversion($id);

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Save unit type (create or update).
     */
    public function saveUnitType(Request $request, UnitConversionService $unitService)
    {
        $request->validate([
            'purchase_unit' => 'required|string',
            'sell_unit' => 'required|string',
            'multiplier' => 'required|numeric|min:0.01',
        ]);

        $result = $unitService->saveUnitType($request->all());

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Delete unit type.
     */
    public function deleteUnitType($id, UnitConversionService $unitService)
    {
        $result = $unitService->deleteUnitType($id);

        return response()->json(['status' => 'success'], $result['status_code']);
    }

    /**
     * Save category (create or update).
     */
    public function saveCategory(Request $request, CategoryService $categoryService)
    {
        $request->validate(['name' => 'required|string|max:255']);

        $result = $categoryService->saveCategory($request->all());

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Delete category.
     */
    public function deleteCategory($id, CategoryService $categoryService)
    {
        $result = $categoryService->deleteCategory($id);

        return response()->json(['status' => 'success', 'message' => 'Category deleted successfully'], $result['status_code']);
    }

    /**
     * Get notifications.
     */
    public function getNotifications(Request $request, NotificationService $notificationService)
    {
        $result = $notificationService->getNotifications($request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json($result);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllNotificationsRead(Request $request, NotificationService $notificationService)
    {
        $result = $notificationService->markAllAsRead($request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json($result);
    }

    /**
     * Delete single notification.
     */
    public function deleteNotification(Request $request, $id, NotificationService $notificationService)
    {
        $result = $notificationService->deleteNotification($request->user(), $id);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json($result);
    }

    /**
     * Delete batch of notifications.
     */
    public function deleteBatchNotifications(Request $request, NotificationService $notificationService)
    {
        $request->validate(['ids' => 'required|array']);

        $result = $notificationService->deleteBatch($request->user(), $request->ids);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json($result);
    }

    /**
     * Delete all notifications.
     */
    public function deleteAllNotifications(Request $request, NotificationService $notificationService)
    {
        $result = $notificationService->deleteAll($request->user());

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status_code']);
        }

        return response()->json($result);
    }

    /**
     * Get all variant values.
     */
    public function getVariantValues(VariantService $variantService)
    {
        $result = $variantService->getVariantValues();

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Store new variant value.
     */
    public function storeVariantValue(Request $request, VariantService $variantService)
    {
        $request->validate([
            'variant_id' => 'required|exists:variants,id',
            'label' => 'required|string',
        ]);

        $result = $variantService->storeVariantValue($request->all());

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Update variant value.
     */
    public function updateVariantValue(Request $request, $id, VariantService $variantService)
    {
        $data = $request->validate([
            'label' => 'sometimes|required|string|max:100',
            'hex_code' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:255',
            'category' => 'nullable',
        ]);

        $result = $variantService->updateVariantValue($id, $data);

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'], 'status' => 'error'], $result['status_code']);
        }

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Get all unit types.
     */
    public function getUnitTypes(UnitConversionService $unitService)
    {
        $result = $unitService->getUnitTypes();

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * Store new unit type.
     */
    public function storeUnitType(Request $request, UnitConversionService $unitService)
    {
        $request->validate([
            'purchase_unit' => 'required|string',
            'sell_unit' => 'required|string',
            'multiplier' => 'required|numeric|min:0.01',
        ]);

        $result = $unitService->storeUnitType($request->all());

        return response()->json(['data' => $result['data'], 'status' => 'success'], $result['status_code']);
    }

    /**
     * List variant types.
     */
    public function listVariantTypes(VariantService $variantService)
    {
        $result = $variantService->listVariantTypes();

        return response()->json([
            'data' => $result['data'],
        ], $result['status_code']);
    }

    /**
     * Store new variant type.
     */
    public function storeVariantType(Request $request, VariantService $variantService)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:variants,name',
            'description' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50',
        ]);

        $result = $variantService->storeVariantType($data);

        return response()->json([
            'data' => $result['data'],
        ], 201);
    }

    /**
     * Update variant type.
     */
    public function updateVariantType(Request $request, $id, VariantService $variantService)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:100|unique:variants,name,' . $id,
            'description' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:50',
            'status' => 'sometimes|in:active,draft',
        ]);

        $result = $variantService->updateVariantType($id, $data);

        return response()->json([
            'data' => $result['data'],
        ], $result['status_code']);
    }

    /**
     * Delete variant type.
     */
    public function deleteVariantType($id, VariantService $variantService)
    {
        $result = $variantService->deleteVariantType($id);

        if (isset($result['error'])) {
            return response()->json([
                'message' => $result['error'],
            ], $result['status_code']);
        }

        return response()->json([
            'message' => 'deleted',
        ], $result['status_code']);
    }

    /**
     * List category variant type mappings.
     */
    public function listCategoryVariantTypes(Request $request, VariantService $variantService)
    {
        $result = $variantService->listCategoryVariantTypes($request->category_id);

        return response()->json([
            'data' => $result['data'],
        ], $result['status_code']);
    }

    /**
     * Store category variant type mapping.
     */
    public function storeCategoryVariantType(Request $request, VariantService $variantService)
    {
        $data = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'variant_id' => 'required|exists:variants,id',
            'is_required' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        $result = $variantService->storeCategoryVariantType($data);

        return response()->json([
            'data' => $result['data'],
        ], $result['status_code']);
    }

    /**
     * Delete category variant type mapping.
     */
    public function deleteCategoryVariantType($id, VariantService $variantService)
    {
        $result = $variantService->deleteCategoryVariantType($id);

        return response()->json(['message' => 'deleted'], $result['status_code']);
    }
}
