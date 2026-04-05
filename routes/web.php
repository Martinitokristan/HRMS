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
    return view('app');
})->where('any', '.*');
