<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\FixedDecimal;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class SaleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', 'in:completed,cancelled'],
            'payment_method' => ['nullable', 'in:cash,card,transfer,other'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $sales = Sale::query()
            ->with('member:id,public_code,first_name,last_name')
            ->when(isset($validated['search']), function ($query) use ($validated): void {
                $search = $validated['search'];
                $query->where(function ($query) use ($search): void {
                    if (ctype_digit($search)) {
                        $query->where('id', (int) $search);
                    }
                    $query->orWhereHas('member', function ($query) use ($search): void {
                        $query->where('first_name', 'like', '%'.$search.'%')
                            ->orWhere('last_name', 'like', '%'.$search.'%')
                            ->orWhere('public_code', 'like', '%'.$search.'%');
                    });
                });
            })
            ->when(isset($validated['from']), fn ($query) => $query->whereDate('sold_at', '>=', $validated['from']))
            ->when(isset($validated['to']), fn ($query) => $query->whereDate('sold_at', '<=', $validated['to']))
            ->when(isset($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->when(isset($validated['payment_method']), fn ($query) => $query->where('payment_method', $validated['payment_method']))
            ->orderByDesc('sold_at')
            ->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => $sales->items(),
            'meta' => [
                'current_page' => $sales->currentPage(),
                'per_page' => $sales->perPage(),
                'total' => $sales->total(),
                'last_page' => $sales->lastPage(),
            ],
        ]);
    }

    public function show(Sale $sale): JsonResponse
    {
        return response()->json(['data' => $sale->load(['member', 'items.product'])]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'member_id' => ['nullable', 'exists:members,id'],
            'payment_method' => ['required', 'string', 'in:cash,card,transfer,other'],
            'items' => ['required', 'array'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01', 'regex:/^\d+(\.\d{1,2})?$/'],
        ]);

        return DB::transaction(function () use ($validated) {
            $subtotalCents = 0;
            $saleItems = [];
            $products = [];
            $reservedStock = [];

            foreach ($validated['items'] as $item) {
                $productId = (int) $item['product_id'];
                $product = $products[$productId] ??= Product::query()->lockForUpdate()->findOrFail($productId);
                $quantity = FixedDecimal::toMinorUnits($item['quantity']);
                $unitPriceCents = FixedDecimal::toMinorUnits($product->sale_price);
                $portionSize = FixedDecimal::toMinorUnits($product->portion_size);

                if (in_array($product->sale_type, ['piece', 'scoop'], true) && $quantity % 100 !== 0) {
                    throw ValidationException::withMessages([
                        'items' => [$product->name.' must be sold in whole '.($product->sale_type === 'scoop' ? 'scoops' : 'pieces').'.'],
                    ]);
                }

                $inventoryQuantity = $product->sale_type === 'scoop'
                    ? intdiv(($quantity * $portionSize) + 50, 100)
                    : $quantity;

                $reservedStock[$productId] = ($reservedStock[$productId] ?? 0) + $inventoryQuantity;
                if (FixedDecimal::toMinorUnits($product->stock) < $reservedStock[$productId]) {
                    throw ValidationException::withMessages([
                        'items' => 'Insufficient stock for product '.$product->name,
                    ]);
                }

                $lineSubtotalCents = intdiv(($quantity * $unitPriceCents) + 50, 100);
                $subtotalCents += $lineSubtotalCents;

                $saleItems[] = [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_price' => $unitPriceCents,
                    'subtotal' => $lineSubtotalCents,
                    'inventory_quantity' => $inventoryQuantity,
                ];
            }

            $sale = Sale::query()->create([
                'member_id' => $validated['member_id'] ?? null,
                'subtotal' => FixedDecimal::fromMinorUnits($subtotalCents),
                'discount' => '0.00',
                'total' => FixedDecimal::fromMinorUnits($subtotalCents),
                'payment_method' => $validated['payment_method'],
                'status' => 'completed',
                'sold_at' => Carbon::now(),
            ]);

            foreach ($saleItems as $item) {
                $stockProduct = $products[$item['product_id']];
                $previousStock = FixedDecimal::toMinorUnits($stockProduct->stock);
                $newStock = $previousStock - $item['inventory_quantity'];

                $stockProduct->stock = FixedDecimal::fromMinorUnits($newStock);
                $stockProduct->save();

                $saleItem = SaleItem::query()->create([
                    'sale_id' => $sale->id,
                    'product_id' => $item['product_id'],
                    'quantity' => FixedDecimal::fromMinorUnits($item['quantity']),
                    'unit_price' => FixedDecimal::fromMinorUnits($item['unit_price']),
                    'subtotal' => FixedDecimal::fromMinorUnits($item['subtotal']),
                    'inventory_quantity' => FixedDecimal::fromMinorUnits($item['inventory_quantity']),
                ]);

                InventoryMovement::query()->create([
                    'product_id' => $item['product_id'],
                    'type' => 'SALE',
                    'quantity' => FixedDecimal::fromMinorUnits($item['inventory_quantity']),
                    'previous_stock' => FixedDecimal::fromMinorUnits($previousStock),
                    'new_stock' => FixedDecimal::fromMinorUnits($newStock),
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                    'notes' => 'Sale item '.$saleItem->id,
                ]);
            }

            return response()->json([
                'data' => $sale->load('items.product'),
                'message' => 'Sale created successfully',
            ], 201);
        });
    }

    public function cancel(Sale $sale): JsonResponse
    {
        DB::transaction(function () use ($sale): void {
            $sale = Sale::query()->lockForUpdate()->with('items')->findOrFail($sale->id);

            if ($sale->status === 'cancelled') {
                throw new ConflictHttpException('This sale has already been cancelled.');
            }

            foreach ($sale->items as $item) {
                $product = Product::query()->lockForUpdate()->findOrFail($item->product_id);
                $previousStock = FixedDecimal::toMinorUnits($product->stock);
                $inventoryQuantity = FixedDecimal::toMinorUnits($item->inventory_quantity);
                $newStock = $previousStock + $inventoryQuantity;

                $product->update(['stock' => FixedDecimal::fromMinorUnits($newStock)]);

                InventoryMovement::query()->create([
                    'product_id' => $product->id,
                    'type' => 'CANCELLATION',
                    'quantity' => FixedDecimal::fromMinorUnits($inventoryQuantity),
                    'previous_stock' => FixedDecimal::fromMinorUnits($previousStock),
                    'new_stock' => FixedDecimal::fromMinorUnits($newStock),
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                    'notes' => 'Sale cancelled; item '.$item->id.' returned to inventory',
                ]);
            }

            $sale->update(['status' => 'cancelled']);
        });

        return response()->json([
            'data' => $sale->fresh('items.product'),
            'message' => 'Sale cancelled and inventory restored',
        ]);
    }
}
