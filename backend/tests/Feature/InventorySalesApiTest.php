<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventorySalesApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withToken(User::factory()->create()->createToken('test')->plainTextToken);
    }

    public function test_inventory_entry_increases_stock_and_records_movement(): void
    {
        $product = $this->createProduct(stock: 10);

        $this->postJson('/api/products/'.$product->id.'/inventory-movements', [
            'type' => 'IN',
            'quantity' => '5',
            'notes' => 'Supplier delivery',
        ])->assertCreated();

        $this->assertSame('15.00', $product->fresh()->stock);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'IN',
            'quantity' => '5.00',
            'previous_stock' => '10.00',
            'new_stock' => '15.00',
        ]);
    }

    public function test_inventory_adjustment_sets_counted_stock_and_records_difference(): void
    {
        $product = $this->createProduct(stock: 10);

        $this->postJson('/api/products/'.$product->id.'/inventory-movements', [
            'type' => 'ADJUSTMENT',
            'stock_count' => '8.5',
        ])->assertCreated();

        $this->assertSame('8.50', $product->fresh()->stock);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'ADJUSTMENT',
            'quantity' => '-1.50',
            'previous_stock' => '10.00',
            'new_stock' => '8.50',
        ]);
    }

    public function test_piece_sale_uses_server_price_and_deducts_stock(): void
    {
        $product = $this->createProduct(stock: 5, saleType: 'piece', price: 12.5);

        $response = $this->postJson('/api/sales', [
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
                'unit_price' => 0.01,
            ]],
        ])->assertCreated();

        $this->assertSame('3.00', $product->fresh()->stock);
        $response->assertJsonPath('data.total', '25.00')
            ->assertJsonPath('data.items.0.unit_price', '12.50');
    }

    public function test_scoop_sale_deducts_grams_from_inventory(): void
    {
        $product = $this->createProduct(stock: 2000, saleType: 'scoop', unit: 'gram', portionSize: 30, price: 35);

        $this->createSale($product, 3)->assertCreated();

        $this->assertSame('1910.00', $product->fresh()->stock);
        $this->assertDatabaseHas('sale_items', [
            'product_id' => $product->id,
            'quantity' => '3.00',
            'inventory_quantity' => '90.00',
        ]);
    }

    public function test_bulk_sale_deducts_fractional_inventory_quantity(): void
    {
        $product = $this->createProduct(stock: 1000, saleType: 'weight', unit: 'gram', price: 2);

        $this->createSale($product, 250.5)->assertCreated();

        $this->assertSame('749.50', $product->fresh()->stock);
    }

    public function test_insufficient_stock_rejects_sale_without_creating_sale_or_movement(): void
    {
        $product = $this->createProduct(stock: 2);

        $this->createSale($product, 3)->assertUnprocessable();

        $this->assertDatabaseCount('sales', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertSame('2.00', $product->fresh()->stock);
    }

    public function test_piece_sale_rejects_fractional_piece_quantity(): void
    {
        $product = $this->createProduct(stock: 5);

        $this->createSale($product, 1.5)->assertUnprocessable();

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('5.00', $product->fresh()->stock);
    }

    public function test_repeated_product_lines_cannot_oversell_combined_stock(): void
    {
        $product = $this->createProduct(stock: 3);

        $this->postJson('/api/sales', [
            'payment_method' => 'cash',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
                ['product_id' => $product->id, 'quantity' => 2],
            ],
        ])->assertUnprocessable();

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('3.00', $product->fresh()->stock);
    }

    public function test_cancelling_sale_restores_inventory_and_is_not_repeatable(): void
    {
        $product = $this->createProduct(stock: 10);
        $saleId = $this->createSale($product, 3)->assertCreated()->json('data.id');

        $this->postJson('/api/sales/'.$saleId.'/cancel')
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertSame('10.00', $product->fresh()->stock);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'CANCELLATION',
            'quantity' => '3.00',
        ]);

        $this->postJson('/api/sales/'.$saleId.'/cancel')->assertStatus(409);
        $this->assertSame('10.00', $product->fresh()->stock);
    }

    private function createSale(Product $product, int|float $quantity)
    {
        return $this->postJson('/api/sales', [
            'payment_method' => 'cash',
            'items' => [[
                'product_id' => $product->id,
                'quantity' => $quantity,
            ]],
        ]);
    }

    private function createProduct(
        int|float $stock,
        string $saleType = 'piece',
        string $unit = 'unit',
        int|float $portionSize = 1,
        int|float $price = 10,
    ): Product {
        static $sku = 0;

        return Product::query()->create([
            'name' => 'Test product',
            'sku' => 'TEST-'.++$sku,
            'sale_type' => $saleType,
            'inventory_unit' => $unit,
            'sale_price' => $price,
            'cost_price' => 1,
            'stock' => $stock,
            'minimum_stock' => 0,
            'portion_size' => $portionSize,
            'is_active' => true,
        ]);
    }
}
