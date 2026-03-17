<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index()
    {
        return response()->json([
            'data'   => Category::all(),
            'status' => 'success',
        ]);
    }

    public function store(Request $request)
    {
        $request->validate(['name' => 'required|string|max:80|unique:categories,name']);
        $cat = Category::create(['name' => $request->name]);

        return response()->json(['data' => $cat, 'status' => 'success'], 201);
    }
}
