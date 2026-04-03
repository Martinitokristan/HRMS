<?php

namespace App\Http\Controllers;

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
            ? Cache::tags(['categories'])->remember('categories:all', 86400, fn() => Category::all())
            : Cache::remember('categories:all', 86400, fn() => Category::all());

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
        return response()->json(['status' => 'success', 'message' => 'Category deleted']);
    }
}
