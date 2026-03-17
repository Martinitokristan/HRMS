<?php

namespace App\Http\Controllers;

use App\Models\UnitType;
use Illuminate\Http\Request;

class UnitTypeController extends Controller
{
    public function index()
    {
        return response()->json([
            'data'   => UnitType::all(),
            'status' => 'success',
        ]);
    }
}
