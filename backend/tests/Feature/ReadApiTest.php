<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Member;
use App\Models\Membership;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReadApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withToken(User::factory()->create()->createToken('test')->plainTextToken);
    }

    public function test_member_and_product_lists_are_searchable_and_paginated(): void
    {
        Member::query()->create([
            'public_code' => 'M-READ-1',
            'barcode_value' => 'BC-READ-1',
            'first_name' => 'Ana',
            'last_name' => 'Lopez',
            'status' => 'active',
        ]);
        $product = $this->createProduct('DRINK-1', 'Water');

        $this->getJson('/api/members?search=Ana&status=active&page=1&per_page=1')
            ->assertOk()
            ->assertJsonPath('data.0.first_name', 'Ana')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/products?search=Water&page=1&per_page=1')
            ->assertOk()
            ->assertJsonPath('data.0.id', $product->id)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_member_product_and_plan_detail_and_updates_are_available(): void
    {
        $member = Member::query()->create([
            'public_code' => 'M-DETAIL-1',
            'barcode_value' => 'BC-DETAIL-1',
            'first_name' => 'Ana',
            'last_name' => 'Lopez',
        ]);
        $product = $this->createProduct('DRINK-2', 'Water');
        $plan = MembershipPlan::query()->create([
            'name' => 'Monthly',
            'duration_days' => 30,
            'price' => 99,
            'is_active' => true,
        ]);

        $this->getJson('/api/members/'.$member->id)->assertOk()->assertJsonPath('data.id', $member->id);
        $this->getJson('/api/products/'.$product->id)->assertOk()->assertJsonPath('data.id', $product->id);
        $this->putJson('/api/products/'.$product->id, [
            'name' => 'Updated Water',
            'sku' => $product->sku,
            'sale_type' => 'piece',
            'inventory_unit' => 'unit',
            'sale_price' => 3,
            'cost_price' => 1,
            'stock' => 999,
            'minimum_stock' => 2,
            'portion_size' => 1,
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.name', 'Updated Water')
            ->assertJsonPath('data.stock', '10.00');

        $this->getJson('/api/membership-plans/'.$plan->id)->assertOk()->assertJsonPath('data.id', $plan->id);
        $this->putJson('/api/membership-plans/'.$plan->id, [
            'name' => 'Quarterly',
            'duration_days' => 90,
            'price' => '250.00',
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.duration_days', 90);
    }

    public function test_product_opening_stock_is_audited_and_scoops_require_grams(): void
    {
        $response = $this->postJson('/api/products', [
            'name' => 'Whey',
            'sku' => 'WHEY-OPENING',
            'sale_type' => 'scoop',
            'inventory_unit' => 'gram',
            'sale_price' => '35.00',
            'cost_price' => '20.00',
            'stock' => '2000',
            'minimum_stock' => '100',
            'portion_size' => '30',
            'is_active' => true,
        ])->assertCreated();

        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $response->json('data.id'),
            'type' => 'IN',
            'quantity' => '2000.00',
            'previous_stock' => '0.00',
            'new_stock' => '2000.00',
        ]);

        $this->postJson('/api/products', [
            'name' => 'Invalid scoop',
            'sku' => 'WHEY-INVALID-UNIT',
            'sale_type' => 'scoop',
            'inventory_unit' => 'unit',
            'sale_price' => '35.00',
        ])->assertUnprocessable()->assertJsonValidationErrors('inventory_unit');
    }

    public function test_payments_inventory_movements_and_sales_have_read_endpoints(): void
    {
        $member = Member::query()->create([
            'public_code' => 'M-HISTORY-1',
            'barcode_value' => 'BC-HISTORY-1',
            'first_name' => 'Test',
            'last_name' => 'Member',
        ]);
        $plan = MembershipPlan::query()->create([
            'name' => 'Monthly',
            'duration_days' => 30,
            'price' => 20,
        ]);
        $membership = Membership::query()->create([
            'member_id' => $member->id,
            'membership_plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(30)->toDateString(),
            'status' => 'active',
            'total_amount' => 20,
            'paid_amount' => 20,
            'pending_amount' => 0,
        ]);
        $payment = Payment::query()->create([
            'member_id' => $member->id,
            'membership_id' => $membership->id,
            'amount' => 20,
            'payment_method' => 'cash',
            'status' => 'paid',
            'paid_at' => now(),
        ]);
        $product = $this->createProduct('DRINK-3', 'Water');
        $movement = InventoryMovement::query()->create([
            'product_id' => $product->id,
            'type' => 'IN',
            'quantity' => 2,
            'previous_stock' => 10,
            'new_stock' => 12,
        ]);
        $sale = Sale::query()->create([
            'member_id' => $member->id,
            'subtotal' => 3,
            'discount' => 0,
            'total' => 3,
            'payment_method' => 'cash',
            'status' => 'completed',
            'sold_at' => now(),
        ]);
        SaleItem::query()->create([
            'sale_id' => $sale->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 3,
            'subtotal' => 3,
            'inventory_quantity' => 1,
        ]);

        $this->getJson('/api/payments?from='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.0.id', $payment->id)
            ->assertJsonPath('meta.total', 1);
        $this->getJson('/api/memberships/'.$membership->id.'/payments')
            ->assertOk()
            ->assertJsonPath('data.0.id', $payment->id);
        $this->getJson('/api/inventory/movements?product_id='.$product->id)
            ->assertOk()
            ->assertJsonPath('data.0.id', $movement->id);
        $this->getJson('/api/sales?status=completed')
            ->assertOk()
            ->assertJsonPath('data.0.id', $sale->id);
        $this->getJson('/api/sales/'.$sale->id)
            ->assertOk()
            ->assertJsonPath('data.items.0.product.id', $product->id);
    }

    public function test_reports_use_date_filtered_persisted_records(): void
    {
        $member = Member::query()->create([
            'public_code' => 'M-REPORT-1',
            'barcode_value' => 'BC-REPORT-1',
            'first_name' => 'Test',
            'last_name' => 'Member',
        ]);
        $plan = MembershipPlan::query()->create([
            'name' => 'Monthly',
            'duration_days' => 30,
            'price' => 20,
        ]);
        $membership = Membership::query()->create([
            'member_id' => $member->id,
            'membership_plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(30)->toDateString(),
            'status' => 'active',
            'total_amount' => 20,
            'paid_amount' => 20,
            'pending_amount' => 0,
        ]);
        $payment = Payment::query()->create([
            'member_id' => $member->id,
            'membership_id' => $membership->id,
            'amount' => 20,
            'payment_method' => 'cash',
            'status' => 'paid',
            'paid_at' => now(),
        ]);
        $product = $this->createProduct('DRINK-4', 'Water');
        $sale = Sale::query()->create([
            'subtotal' => 3,
            'discount' => 0,
            'total' => 3,
            'payment_method' => 'cash',
            'status' => 'completed',
            'sold_at' => now(),
        ]);
        Visit::query()->create([
            'member_id' => $member->id,
            'membership_id' => $membership->id,
            'barcode_value' => $member->barcode_value,
            'checked_in_at' => now(),
            'access_status' => 'granted',
        ]);

        $range = '?from='.now()->toDateString().'&to='.now()->toDateString();
        $this->getJson('/api/reports/sales'.$range)
            ->assertOk()
            ->assertJsonPath('data.summary.count', 1)
            ->assertJsonPath('data.summary.total', 3);
        $this->getJson('/api/reports/payments'.$range)
            ->assertOk()
            ->assertJsonPath('data.summary.count', 1)
            ->assertJsonPath('data.summary.total', 20);
        $this->getJson('/api/reports/attendance'.$range)
            ->assertOk()
            ->assertJsonPath('data.summary.count', 1);
        $this->getJson('/api/reports/inventory'.$range)
            ->assertOk()
            ->assertJsonPath('data.summary.product_count', 1);

        $this->assertDatabaseHas('payments', ['id' => $payment->id]);
        $this->assertDatabaseHas('sales', ['id' => $sale->id]);
        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    private function createProduct(string $sku, string $name): Product
    {
        return Product::query()->create([
            'name' => $name,
            'sku' => $sku,
            'sale_type' => 'piece',
            'inventory_unit' => 'unit',
            'sale_price' => 2.5,
            'cost_price' => 1,
            'stock' => 10,
            'minimum_stock' => 0,
            'portion_size' => 1,
            'is_active' => true,
        ]);
    }
}
