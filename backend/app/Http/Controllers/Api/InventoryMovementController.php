<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Support\FixedDecimal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'type' => ['nullable', 'in:IN,SALE,ADJUSTMENT,RETURN,WASTE,CANCELLATION'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $movements = InventoryMovement::query()
            ->with('product:id,name,sku,inventory_unit')
            ->when(isset($validated['product_id']), fn ($query) => $query->where('product_id', $validated['product_id']))
            ->when(isset($validated['type']), fn ($query) => $query->where('type', $validated['type']))
            ->when(isset($validated['from']), fn ($query) => $query->whereDate('created_at', '>=', $validated['from']))
            ->when(isset($validated['to']), fn ($query) => $query->whereDate('created_at', '<=', $validated['to']))
            ->orderByDesc('created_at')
            ->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => $movements->items(),
            'meta' => [
                'current_page' => $movements->currentPage(),
                'per_page' => $movements->perPage(),
                'total' => $movements->total(),
                'last_page' => $movements->lastPage(),
            ],
        ]);
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'in:IN,ADJUSTMENT'],
            'quantity' => ['required_if:type,IN', 'numeric', 'gt:0', 'regex:/^\d+(\.\d{1,2})?$/'],
            'stock_count' => ['required_if:type,ADJUSTMENT', 'numeric', 'min:0', 'regex:/^\d+(\.\d{1,2})?$/'],
            'notes' => ['nullable', 'string'],
        ]);

        [$movement, $product] = DB::transaction(function () use ($product, $validated): array {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);
            $previousStock = FixedDecimal::toMinorUnits($product->stock);
            $newStock = $validated['type'] === 'IN'
                ? $previousStock + FixedDecimal::toMinorUnits($validated['quantity'])
                : FixedDecimal::toMinorUnits($validated['stock_count']);
            $quantity = $newStock - $previousStock;

            $product->update(['stock' => FixedDecimal::fromMinorUnits($newStock)]);
            $movement = InventoryMovement::query()->create([
                'product_id' => $product->id,
                'type' => $validated['type'],
                'quantity' => FixedDecimal::fromMinorUnits($quantity),
                'previous_stock' => FixedDecimal::fromMinorUnits($previousStock),
                'new_stock' => FixedDecimal::fromMinorUnits($newStock),
                'notes' => $validated['notes'] ?? null,
            ]);

            return [$movement, $product->fresh()];
        });

        return response()->json([
            'data' => ['movement' => $movement, 'product' => $product],
            'message' => 'Inventory updated successfully',
        ], 201);
    }
}
