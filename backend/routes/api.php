<?php

use App\Http\Controllers\Api\AccessController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InventoryMovementController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\MembershipController;
use App\Http\Controllers\Api\MembershipPlanController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\SaleController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['ok' => true]));
Route::post('/login', [AuthController::class, 'login']);
Route::post('/access/check-in', [AccessController::class, 'checkIn']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::get('/members', [MemberController::class, 'index']);
    Route::post('/members', [MemberController::class, 'store']);
    Route::get('/members/{member}', [MemberController::class, 'show']);
    Route::put('/members/{member}', [MemberController::class, 'update']);
    Route::post('/members/{member}/regenerate-barcode', [MemberController::class, 'regenerateBarcode']);

    Route::get('/membership-plans', [MembershipPlanController::class, 'index']);
    Route::post('/membership-plans', [MembershipPlanController::class, 'store']);
    Route::get('/membership-plans/{membershipPlan}', [MembershipPlanController::class, 'show']);
    Route::put('/membership-plans/{membershipPlan}', [MembershipPlanController::class, 'update']);

    Route::get('/members/{member}/memberships', [MembershipController::class, 'index']);
    Route::post('/members/{member}/memberships', [MembershipController::class, 'store']);
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::get('/memberships/{membership}/payments', [PaymentController::class, 'indexForMembership']);
    Route::post('/memberships/{membership}/payments', [PaymentController::class, 'store']);

    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
    Route::put('/products/{product}', [ProductController::class, 'update']);
    Route::get('/inventory/movements', [InventoryMovementController::class, 'index']);
    Route::post('/products/{product}/inventory-movements', [InventoryMovementController::class, 'store']);

    Route::get('/sales', [SaleController::class, 'index']);
    Route::post('/sales', [SaleController::class, 'store']);
    Route::get('/sales/{sale}', [SaleController::class, 'show']);
    Route::post('/sales/{sale}/cancel', [SaleController::class, 'cancel']);

    Route::get('/reports/sales', [ReportsController::class, 'sales']);
    Route::get('/reports/payments', [ReportsController::class, 'payments']);
    Route::get('/reports/attendance', [ReportsController::class, 'attendance']);
    Route::get('/reports/inventory', [ReportsController::class, 'inventory']);
});
