<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    public function sales(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request);
        $query = Sale::query()
            ->where('status', 'completed')
            ->when($from, fn ($query) => $query->whereDate('sold_at', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('sold_at', '<=', $to));

        return response()->json([
            'data' => [
                'summary' => [
                    'count' => (clone $query)->count(),
                    'total' => (clone $query)->sum('total'),
                ],
                'by_method' => (clone $query)
                    ->selectRaw('payment_method, COUNT(*) as count, SUM(total) as total')
                    ->groupBy('payment_method')
                    ->orderBy('payment_method')
                    ->get(),
                'by_day' => (clone $query)
                    ->selectRaw('DATE(sold_at) as date, COUNT(*) as count, SUM(total) as total')
                    ->groupBy('date')
                    ->orderBy('date')
                    ->get(),
            ],
        ]);
    }

    public function payments(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request);
        $query = Payment::query()
            ->where('status', '!=', 'cancelled')
            ->when($from, fn ($query) => $query->whereDate('paid_at', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('paid_at', '<=', $to));

        return response()->json([
            'data' => [
                'summary' => [
                    'count' => (clone $query)->count(),
                    'total' => (clone $query)->sum('amount'),
                ],
                'by_method' => (clone $query)
                    ->selectRaw('payment_method, COUNT(*) as count, SUM(amount) as total')
                    ->groupBy('payment_method')
                    ->orderBy('payment_method')
                    ->get(),
                'by_day' => (clone $query)
                    ->selectRaw('DATE(paid_at) as date, COUNT(*) as count, SUM(amount) as total')
                    ->groupBy('date')
                    ->orderBy('date')
                    ->get(),
            ],
        ]);
    }

    public function attendance(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request);
        $query = Visit::query()
            ->with('member:id,public_code,first_name,last_name')
            ->where('access_status', 'granted')
            ->when($from, fn ($query) => $query->whereDate('checked_in_at', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('checked_in_at', '<=', $to));

        return response()->json([
            'data' => [
                'summary' => ['count' => (clone $query)->count()],
                'by_day' => (clone $query)
                    ->selectRaw('DATE(checked_in_at) as date, COUNT(*) as count')
                    ->groupBy('date')
                    ->orderBy('date')
                    ->get(),
                'recent_visits' => (clone $query)->orderByDesc('checked_in_at')->limit(100)->get(),
            ],
        ]);
    }

    public function inventory(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request);
        $movements = InventoryMovement::query()
            ->when($from, fn ($query) => $query->whereDate('created_at', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('created_at', '<=', $to));

        return response()->json([
            'data' => [
                'summary' => [
                    'product_count' => Product::query()->count(),
                    'low_stock_count' => Product::query()->whereColumn('stock', '<=', 'minimum_stock')->count(),
                    'movement_count' => (clone $movements)->count(),
                ],
                'low_stock_products' => Product::query()
                    ->whereColumn('stock', '<=', 'minimum_stock')
                    ->orderBy('name')
                    ->get(['id', 'name', 'sku', 'stock', 'minimum_stock', 'inventory_unit']),
                'by_movement_type' => (clone $movements)
                    ->selectRaw('type, COUNT(*) as count, SUM(quantity) as quantity')
                    ->groupBy('type')
                    ->orderBy('type')
                    ->get(),
            ],
        ]);
    }

    private function dateRange(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return [$validated['from'] ?? null, $validated['to'] ?? null];
    }
}
