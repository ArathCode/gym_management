<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Support\FixedDecimal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $search = trim($validated['search'] ?? '');
        $products = Product::query()
            ->when($search !== '', fn ($query) => $query
                ->where('name', 'like', '%'.$search.'%')
                ->orWhere('sku', 'like', '%'.$search.'%'))
            ->orderBy('name')
            ->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => $products->items(),
            'meta' => [
                'current_page' => $products->currentPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'last_page' => $products->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatedData($request);

        $product = DB::transaction(function () use ($validated): Product {
            $product = Product::query()->create([
                ...$validated,
                'stock' => $validated['stock'] ?? 0,
                'minimum_stock' => $validated['minimum_stock'] ?? 0,
                'portion_size' => $validated['portion_size'] ?? 1,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            if (FixedDecimal::toMinorUnits($product->stock) > 0) {
                InventoryMovement::query()->create([
                    'product_id' => $product->id,
                    'type' => 'IN',
                    'quantity' => $product->stock,
                    'previous_stock' => 0,
                    'new_stock' => $product->stock,
                    'notes' => 'Opening stock',
                ]);
            }

            return $product;
        });

        return response()->json([
            'data' => $product,
            'message' => 'Product created successfully',
        ], 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json(['data' => $product]);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $this->validatedData($request, $product);
        unset($validated['stock']);
        $product->update($validated);

        return response()->json([
            'data' => $product->refresh(),
            'message' => 'Product updated successfully',
        ]);
    }

    private function validatedData(Request $request, ?Product $product = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:255', Rule::unique('products', 'sku')->ignore($product?->id)],
            'category_id' => ['nullable', 'integer'],
            'sale_type' => ['required', 'in:piece,weight,scoop'],
            'inventory_unit' => ['required', 'in:unit,gram,ml'],
            'sale_price' => ['required', 'numeric', 'min:0', 'regex:/^\d+(\.\d{1,2})?$/'],
            'cost_price' => ['nullable', 'numeric', 'min:0', 'regex:/^\d+(\.\d{1,2})?$/'],
            'stock' => ['nullable', 'numeric', 'min:0'],
            'minimum_stock' => ['nullable', 'numeric', 'min:0'],
            'portion_size' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($validated['sale_type'] === 'scoop' && $validated['inventory_unit'] !== 'gram') {
            throw ValidationException::withMessages([
                'inventory_unit' => ['Scoop products must track inventory in grams.'],
            ]);
        }

        if ($validated['sale_type'] === 'piece' && $validated['inventory_unit'] !== 'unit') {
            throw ValidationException::withMessages([
                'inventory_unit' => ['Piece products must track inventory in units.'],
            ]);
        }

        if ($validated['sale_type'] === 'scoop' && FixedDecimal::toMinorUnits($validated['portion_size'] ?? 1) <= 0) {
            throw ValidationException::withMessages([
                'portion_size' => ['Scoop portion size must be greater than zero.'],
            ]);
        }

        return $validated;
    }
}
