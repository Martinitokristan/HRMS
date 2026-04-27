<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Variant;
use App\Models\VariantValue;
use App\Models\Setting;
use App\Models\UnitConversion;
use App\Events\DataMutated;
use App\Models\UnitType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SettingsController extends Controller
{
    public function index(Request $request)
    {
        // Optimized: Cache static data and only return what's requested
        $cacheKey = 'settings:all';
        $isTaggable = Cache::getStore() instanceof \Illuminate\Cache\TaggableStore;

        $allSettings = $isTaggable
            ? Cache::tags(['settings'])->remember($cacheKey, 86400, fn() => Setting::all())
            : Cache::remember($cacheKey, 86400, fn() => Setting::all());

        $user = $request->user();
        $isAdmin = $user instanceof \App\Models\User && $user->role === 'admin';

        if (!$isAdmin) {
            $allSettings = $allSettings->whereNotIn('group', ['security', 'notifications']);
        }

        $settings = $allSettings->groupBy('group')->map(function ($group) {
            return $group->pluck('value', 'key');
        });

        // Only load masterlist data if needed (check for cache headers or specific params)
        $includeMasterlist = $request->get('include_masterlist', false);

        $response = [
            'data' => [
                'settings' => $settings,
            ],
            'status' => 'success',
        ];

        if ($includeMasterlist) {
            // Optimized: Load only essential masterlist data
            $response['data']['categories'] = Category::all(['id', 'name']);
            $response['data']['unitTypes'] = UnitType::all(['id', 'purchase_unit', 'sell_unit']);

            // Only load variants if specifically requested
            if ($request->get('include_variants', false)) {
                $response['data']['variants'] = Variant::with('values')->get();
            }
        }

        return response()->json($response);
    }

    public function update(Request $request)
    {
        if ($request->has('settings')) {
            $request->validate([
                'group' => 'required|string',
                'settings' => 'required|array',
            ]);

            foreach ($request->settings as $key => $value) {
                Setting::set($key, $value, $request->group);
            }
        }

        if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore) {
            Cache::tags(['settings'])->flush();
        } else {
            Cache::forget('settings:all');
        }

        // Broadcast payment settings changes for real-time checkout updates
        if ($request->group === 'payments') {
            broadcast(new DataMutated('shop', ['customer_shop'], 'payment_settings.updated'));
        }

        return response()->json([
            'message' => 'Settings saved successfully',
            'status' => 'success',
        ]);
    }

    // Variant Value CRUD
    public function saveVariantValue(Request $request)
    {
        $request->validate([
            'variant_id' => 'required|exists:variants,id',
            'label' => 'required|string',
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

    public function deleteVariantValue($id)
    {
        VariantValue::destroy($id);

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_value.deleted'));

        return response()->json(['status' => 'success']);
    }

    // Unit Conversion CRUD
    public function saveUnitConversion(Request $request)
    {
        $request->validate([
            'purchase_unit' => 'required|string',
            'sell_unit' => 'required|string',
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
            'sell_unit' => 'required|string',
            'multiplier' => 'required|numeric|min:0.01',
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

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'unit_type.deleted'));

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

        if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore) {
            Cache::tags(['categories'])->flush();
        } else {
            Cache::forget('categories:all');
        }

        return response()->json(['data' => $category, 'status' => 'success']);
    }

    public function deleteCategory($id)
    {
        Category::destroy($id);

        if (Cache::getStore() instanceof \Illuminate\Cache\TaggableStore) {
            Cache::tags(['categories'])->flush();
        } else {
            Cache::forget('categories:all');
        }

        return response()->json(['status' => 'success', 'message' => 'Category deleted successfully']);
    }

    private function resolveNotifiable(Request $request)
    {
        $user = $request->user();

        if ($user === null) {
            abort(401, 'Authentication required.');
        }

        if ($user instanceof \App\Models\User && $user->role === 'supplier') {
            return \App\Models\Supplier::where('email', $user->email)->first() ?? $user;
        }

        return $user;
    }

    public function getNotifications(Request $request)
    {
        $notifiable = $this->resolveNotifiable($request);
        $notifications = $notifiable->notifications()->orderBy('created_at', 'desc')->take(30)->get();
        return response()->json(['data' => $notifications]);
    }

    public function markAllNotificationsRead(Request $request)
    {
        $this->resolveNotifiable($request)->unreadNotifications->markAsRead();
        return response()->json(['status' => 'success']);
    }

    public function deleteNotification(Request $request, $id)
    {
        $this->resolveNotifiable($request)->notifications()->where('id', $id)->delete();
        return response()->json(['status' => 'success']);
    }

    public function deleteBatchNotifications(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        $this->resolveNotifiable($request)->notifications()->whereIn('id', $request->ids)->delete();
        return response()->json(['status' => 'success']);
    }

    public function deleteAllNotifications(Request $request)
    {
        $this->resolveNotifiable($request)->notifications()->delete();
        return response()->json(['status' => 'success']);
    }

    // Supplier-specific methods
    public function getVariantValues()
    {
        $variants = Variant::with('values')->get();
        return response()->json([
            'data' => $variants,
            'status' => 'success',
        ]);
    }

    public function storeVariantValue(Request $request)
    {
        $request->validate([
            'variant_id' => 'required|exists:variants,id',
            'label' => 'required|string',
        ]);

        $value = VariantValue::create($request->only(['variant_id', 'label', 'hex_code', 'description', 'category']));

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'variant_value.created'));

        return response()->json(['data' => $value, 'status' => 'success']);
    }

    public function getUnitTypes()
    {
        $unitTypes = UnitType::all();
        return response()->json([
            'data' => $unitTypes,
            'status' => 'success',
        ]);
    }

    public function storeUnitType(Request $request)
    {
        $request->validate([
            'purchase_unit' => 'required|string',
            'sell_unit' => 'required|string',
            'multiplier' => 'required|numeric|min:0.01',
        ]);

        $unit = UnitType::create($request->only(['purchase_unit', 'sell_unit', 'multiplier']));

        broadcast(new DataMutated('private-admin', ['admin_settings'], 'unit_type.created'));

        return response()->json(['data' => $unit, 'status' => 'success']);
    }

    // === Variant Attribute Types (Commit 2) ===
    public function listVariantTypes()
    {
        return response()->json([
            'data' => \App\Models\Variant::orderBy('id')->get(),
        ]);
    }

    public function storeVariantType(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100|unique:variants,name',
            'description' => 'nullable|string|max:255',
            'icon'        => 'nullable|string|max:50',
        ]);
        return response()->json([
            'data' => \App\Models\Variant::create(array_merge($data, ['status' => 'active'])),
        ], 201);
    }

    public function updateVariantType(Request $request, $id)
    {
        $variant = \App\Models\Variant::findOrFail($id);
        $data = $request->validate([
            'name'        => 'sometimes|required|string|max:100|unique:variants,name,' . $id,
            'description' => 'nullable|string|max:255',
            'icon'        => 'nullable|string|max:50',
            'status'      => 'sometimes|in:active,draft',
        ]);
        $variant->update($data);
        return response()->json(['data' => $variant]);
    }

    public function deleteVariantType($id)
    {
        // Block delete if any variant currently uses this attribute type.
        $inUse = \DB::table('product_variant_attributes')->where('variant_id', $id)->exists()
              || \DB::table('supplier_product_variant_attributes')->where('variant_id', $id)->exists();
        if ($inUse) {
            return response()->json([
                'message' => 'Cannot delete — this attribute type is used by existing variants. Remove or reassign those variants first.',
            ], 422);
        }
        \DB::table('category_variant_types')->where('variant_id', $id)->delete();
        \DB::table('variant_values')->where('variant_id', $id)->delete();
        \App\Models\Variant::where('id', $id)->delete();
        return response()->json(['message' => 'deleted']);
    }

    public function listCategoryVariantTypes(Request $request)
    {
        $q = \App\Models\CategoryVariantType::with('variant')->orderBy('sort_order');
        if ($request->category_id) {
            $q->where('category_id', $request->category_id);
        }
        return response()->json(['data' => $q->get()]);
    }

    public function storeCategoryVariantType(Request $request)
    {
        $data = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'variant_id'  => 'required|exists:variants,id',
            'is_required' => 'sometimes|boolean',
            'sort_order'  => 'sometimes|integer',
        ]);
        $row = \App\Models\CategoryVariantType::firstOrCreate(
            ['category_id' => $data['category_id'], 'variant_id' => $data['variant_id']],
            ['is_required' => $data['is_required'] ?? false, 'sort_order' => $data['sort_order'] ?? 0]
        );
        return response()->json(['data' => $row->load('variant')]);
    }

    public function deleteCategoryVariantType($id)
    {
        \App\Models\CategoryVariantType::where('id', $id)->delete();
        return response()->json(['message' => 'deleted']);
    }
}
