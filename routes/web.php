<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
| SPA catch-all — React Router handles all frontend routing
*/

Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
