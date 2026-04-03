<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CategoryController extends Controller
{
    public function index()
    {
        $data = Cache::tags(['categories'])->remember('categories:all', 86400, fn() => Category::all());

        return response()->json(['data' => $data, 'status' => 'success']);
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string|max:80|unique:categories,name']);
        $cat = Category::create(['name' => $request->name]);
        Cache::tags(['categories'])->flush();

        return response()->json(['data' => $cat, 'status' => 'success'], 201);
    }

    public function destroy($id)
    {
        $cat = Category::findOrFail($id);
        $cat->delete();
        Cache::tags(['categories'])->flush();
        return response()->json(['status' => 'success', 'message' => 'Category deleted']);
    }
}
