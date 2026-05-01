<?php

namespace App\Http\Controllers;

use App\Events\DataMutated;
use App\Models\Category;
use Illuminate\Cache\TaggableStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CategoryController extends Controller
{
    public function index()
    {
        $taggable = Cache::getStore() instanceof TaggableStore;
        $data = $taggable
            ? Cache::tags(['categories'])->remember('categories:all', 86400, fn() => Category::all()->toArray())
            : Cache::remember('categories:all', 86400, fn() => Category::all()->toArray());

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string|max:80|unique:categories,name']);
        $cat = Category::create(['name' => $request->name]);

        if (Cache::getStore() instanceof TaggableStore) {
            Cache::tags(['categories'])->flush();
        } else {
            Cache::forget('categories:all');
        }

        broadcast(new DataMutated('private-admin', ['admin_products', 'admin_settings'], 'category.created'));
        broadcast(new DataMutated('shop', ['customer_shop'], 'category.created'));

        return response()->json(['data' => $cat, 'status' => 'success'], 201);
    }

    public function destroy($id)
    {
        $cat = Category::findOrFail($id);
        $cat->delete();

        if (Cache::getStore() instanceof TaggableStore) {
            Cache::tags(['categories'])->flush();
        } else {
            Cache::forget('categories:all');
        }

        broadcast(new DataMutated('private-admin', ['admin_products', 'admin_settings'], 'category.deleted'));
        broadcast(new DataMutated('shop', ['customer_shop'], 'category.deleted'));

        return response()->json(['status' => 'success', 'message' => 'Category deleted']);
    }
}
