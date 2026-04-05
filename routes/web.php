<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\BroadcastAuthController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Custom broadcasting auth — no pusher PHP SDK required
Route::post('/broadcasting/auth', [BroadcastAuthController::class, 'authenticate'])
    ->middleware('web');

/*
|--------------------------------------------------------------------------
| SPA catch-all — React Router handles all frontend routing
*/

Route::get('/{any}', function () {
    return response(view('app'))
        ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
})->where('any', '.*');
