<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\Membership;
use App\Models\MembershipPlan;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GymManagementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_access_is_granted_for_active_membership(): void
    {
        $member = Member::query()->create([
            'public_code' => 'M-1001',
            'barcode_value' => 'MBR-ACCESS-1',
            'first_name' => 'Alice',
            'last_name' => 'Member',
            'status' => 'active',
        ]);

        $plan = MembershipPlan::query()->create([
            'name' => 'Monthly',
            'duration_days' => 30,
            'price' => 99.00,
            'is_active' => true,
        ]);

        Membership::query()->create([
            'member_id' => $member->id,
            'membership_plan_id' => $plan->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addDays(10)->toDateString(),
            'status' => 'active',
            'total_amount' => 99.00,
            'paid_amount' => 99.00,
            'pending_amount' => 0,
        ]);

        $response = $this->postJson('/api/access/check-in', ['barcode' => 'MBR-ACCESS-1']);

        $response->assertOk();
        $response->assertJsonPath('data.access', 'granted');
        $this->assertDatabaseHas('visits', ['member_id' => $member->id, 'access_status' => 'granted']);
    }

    public function test_duplicate_scan_is_rejected_within_ten_seconds(): void
    {
        $member = Member::query()->create([
            'public_code' => 'M-2002',
            'barcode_value' => 'MBR-DUPLICATE-1',
            'first_name' => 'Bob',
            'last_name' => 'Member',
            'status' => 'active',
        ]);

        $plan = MembershipPlan::query()->create([
            'name' => 'Monthly',
            'duration_days' => 30,
            'price' => 99.00,
            'is_active' => true,
        ]);

        Membership::query()->create([
            'member_id' => $member->id,
            'membership_plan_id' => $plan->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addDays(10)->toDateString(),
            'status' => 'active',
            'total_amount' => 99.00,
            'paid_amount' => 99.00,
            'pending_amount' => 0,
        ]);

        $this->postJson('/api/access/check-in', ['barcode' => 'MBR-DUPLICATE-1']);
        $response = $this->postJson('/api/access/check-in', ['barcode' => 'MBR-DUPLICATE-1']);

        $response->assertStatus(409);
        $response->assertJsonPath('data.access', 'duplicate_scan');
    }

    public function test_sale_reduces_product_inventory(): void
    {
        $user = User::factory()->create();
        $product = Product::query()->create([
            'name' => 'Whey Protein',
            'sku' => 'SUP-001',
            'sale_type' => 'scoop',
            'inventory_unit' => 'gram',
            'sale_price' => 35.00,
            'cost_price' => 20.00,
            'stock' => 2000,
            'minimum_stock' => 50,
            'portion_size' => 30,
            'is_active' => true,
        ]);

        $response = $this->withToken($user->createToken('test')->plainTextToken)->postJson('/api/sales', [
            'payment_method' => 'cash',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 3,
                    'unit_price' => 35,
                ],
            ],
        ]);

        $response->assertStatus(201);
        $this->assertSame(1910.0, (float) $product->fresh()->stock);
        $this->assertDatabaseHas('inventory_movements', ['product_id' => $product->id, 'type' => 'SALE']);
    }
}
