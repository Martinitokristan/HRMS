<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Variant;
use App\Models\VariantValue;
use App\Models\Setting;
use App\Models\UnitConversion;
use App\Models\UnitType;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index()
    {
        $settings = Setting::all()->groupBy('group')->map(function ($group) {
            return $group->pluck('value', 'key');
        });

        // Add masterlist data
        $variants = Variant::with('values')->get();
        $conversions = UnitConversion::with('category')->get();
        $unitTypes = UnitType::all();
        $categories = Category::all();

        return response()->json([
            'data' => [
                'settings'    => $settings,
                'variants'    => $variants,
                'conversions' => $conversions,
                'unitTypes'   => $unitTypes,
                'categories'  => $categories,
            ],
            'status' => 'success',
        ]);
    }

    public function update(Request $request)
    {
        if ($request->has('settings')) {
            $request->validate([
                'group'    => 'required|string',
                'settings' => 'required|array',
            ]);

            foreach ($request->settings as $key => $value) {
                Setting::set($key, $value, $request->group);
            }
        }

        return response()->json([
            'message' => 'Settings saved successfully',
            'status'  => 'success',
        ]);
    }

    // Variant Value CRUD
    public function saveVariantValue(Request $request)
    {
        $request->validate([
            'variant_id' => 'required|exists:variants,id',
            'label'      => 'required|string',
        ]);

        $value = VariantValue::updateOrCreate(
            ['id' => $request->id],
            $request->only(['variant_id', 'label', 'hex_code', 'description', 'category'])
        );

        return response()->json(['data' => $value, 'status' => 'success']);
    }

    public function saveVariantType(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
        ]);

        $type = Variant::updateOrCreate(
            ['id' => $request->id],
            $request->only(['name', 'description', 'status', 'icon'])
        );

        return response()->json(['data' => $type, 'status' => 'success']);
    }

    public function deleteVariantType($id)
    {
        Variant::destroy($id);
        return response()->json(['status' => 'success']);
    }

    public function deleteVariantValue($id)
    {
        VariantValue::destroy($id);
        return response()->json(['status' => 'success']);
    }

    // Unit Conversion CRUD
    public function saveUnitConversion(Request $request)
    {
        $request->validate([
            'purchase_unit'     => 'required|string',
            'sell_unit'         => 'required|string',
            'conversion_factor' => 'required|numeric',
        ]);

        $conv = UnitConversion::updateOrCreate(
            ['id' => $request->id],
            $request->only(['category_id', 'purchase_unit', 'sell_unit', 'conversion_factor'])
        );

        return response()->json(['data' => $conv, 'status' => 'success']);
    }

    public function deleteUnitConversion($id)
    {
        UnitConversion::destroy($id);
        return response()->json(['status' => 'success']);
    }

    public function saveUnitType(Request $request)
    {
        $request->validate([
            'purchase_unit' => 'required|string',
            'sell_unit'     => 'required|string',
            'multiplier'    => 'required|numeric|min:0.01',
        ]);

        $unit = UnitType::updateOrCreate(
            ['id' => $request->id],
            $request->only(['purchase_unit', 'sell_unit', 'multiplier'])
        );

        return response()->json(['data' => $unit, 'status' => 'success']);
    }

    public function deleteUnitType($id)
    {
        UnitType::destroy($id);
        return response()->json(['status' => 'success']);
    }

    // Category CRUD for Settings
    public function saveCategory(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $category = Category::updateOrCreate(
            ['id' => $request->id],
            $request->only(['name', 'description'])
        );

        return response()->json(['data' => $category, 'status' => 'success']);
    }

    public function deleteCategory($id)
    {
        Category::destroy($id);
        return response()->json(['status' => 'success']);
    }

    public function getNotifications(Request $request)
    {
        $user = $request->user();
        $notifications = $user->notifications()->orderBy('created_at', 'desc')->take(30)->get();
        return response()->json(['data' => $notifications]);
    }

    public function markAllNotificationsRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();
        return response()->json(['status' => 'success']);
    }
}
