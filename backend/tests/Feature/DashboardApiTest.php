<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_requires_authentication(): void
    {
        $this->getJson('/api/dashboard')->assertUnauthorized();
    }

    public function test_empty_dashboard_returns_zero_balances_and_no_percentage_base(): void
    {
        $this->withToken(User::factory()->create()->createToken('test')->plainTextToken)
            ->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.active_members', 0)
            ->assertJsonPath('data.active_plans', 0)
            ->assertJsonPath('data.income_today.total', '0.00')
            ->assertJsonPath('data.income_change_percent', null)
            ->assertJsonPath('data.visits_today', 0)
            ->assertJsonPath('data.recent_visits', [])
            ->assertJsonPath('data.low_stock_products', []);
    }

    public function test_today_uses_mexico_city_day_boundaries_with_utc_storage(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 7)->setTime(12, 0));
        foreach ([['2026-10-07 05:59:59', '50.00'], ['2026-10-07 06:00:00', '100.00'], ['2026-10-08 06:00:00', '999.00']] as [$date, $total]) {
            Sale::query()->create(['subtotal' => $total, 'total' => $total, 'status' => 'completed', 'sold_at' => $date]);
        }

        $this->withToken(User::factory()->create()->createToken('test')->plainTextToken)
            ->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.timezone', 'America/Mexico_City')
            ->assertJsonPath('data.income_today.total', '100.00')
            ->assertJsonPath('data.income_yesterday.total', '50.00');
    }

    public function test_dashboard_uses_recorded_income_active_catalogs_and_recent_granted_visits(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 7)->setTime(12, 0));
        $member = Member::query()->create([
            'public_code' => 'M-DASH', 'barcode_value' => 'BC-DASH',
            'first_name' => 'Ana', 'last_name' => 'Example', 'status' => 'active', 'registered_at' => now(),
        ]);
        Member::query()->create(['public_code' => 'M-INACTIVE', 'first_name' => 'Inactive', 'last_name' => 'Example', 'status' => 'inactive']);
        MembershipPlan::query()->create(['name' => 'Monthly', 'duration_days' => 30, 'price' => '500.00', 'is_active' => true]);
        MembershipPlan::query()->create(['name' => 'Old', 'duration_days' => 30, 'price' => '500.00', 'is_active' => false]);
        foreach ([['paid', '100.10', now()], ['partial', '25.15', now()], ['cancelled', '900.00', now()], ['pending', '800.00', now()], ['paid', '50.00', now()->subDay()], ['paid', '700.00', now()->startOfDay()->subSecond()]] as [$status, $amount, $date]) {
            Payment::query()->create(['member_id' => $member->id, 'amount' => $amount, 'status' => $status, 'paid_at' => $date]);
        }
        foreach ([['completed', '24.75', now()], ['cancelled', '600.00', now()], ['completed', '250.00', now()->subDay()], ['completed', '999.00', now()->addDay()]] as [$status, $total, $date]) {
            Sale::query()->create(['subtotal' => $total, 'total' => $total, 'status' => $status, 'sold_at' => $date]);
        }
        for ($index = 0; $index < 12; $index++) {
            Visit::query()->create(['member_id' => $member->id, 'checked_in_at' => now()->subMinutes($index), 'access_status' => 'granted']);
        }
        Visit::query()->create(['member_id' => $member->id, 'checked_in_at' => now()->subDay(), 'access_status' => 'granted']);
        Visit::query()->create(['member_id' => $member->id, 'checked_in_at' => now(), 'access_status' => 'denied']);
        for ($index = 0; $index < 7; $index++) {
            Product::query()->create(['name' => 'Whey '.$index, 'sku' => 'WHEY-'.$index, 'sale_type' => 'scoop', 'inventory_unit' => 'gram', 'stock' => '30.00', 'minimum_stock' => '30.00', 'portion_size' => '30.00', 'is_active' => true]);
        }
        Product::query()->create(['name' => 'Inactive', 'sku' => 'INACTIVE', 'stock' => '0.00', 'is_active' => false]);
        Product::query()->create(['name' => 'Enough', 'sku' => 'ENOUGH', 'stock' => '100.00', 'minimum_stock' => '10.00']);

        $response = $this->withToken(User::factory()->create()->createToken('test')->plainTextToken)
            ->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.active_members', 1)
            ->assertJsonPath('data.new_active_members_this_week', 1)
            ->assertJsonPath('data.active_plans', 1)
            ->assertJsonPath('data.new_active_plans_this_week', 1)
            ->assertJsonPath('data.income_today.memberships', '125.25')
            ->assertJsonPath('data.income_today.pos', '24.75')
            ->assertJsonPath('data.income_today.total', '150.00')
            ->assertJsonPath('data.income_yesterday.total', '1000.00')
            ->assertJsonPath('data.income_change_percent', '-85.00')
            ->assertJsonPath('data.visits_today', 12)
            ->assertJsonPath('data.visits_change', 11)
            ->assertJsonCount(10, 'data.recent_visits')
            ->assertJsonPath('data.recent_visits.0.member.first_name', 'Ana')
            ->assertJsonPath('data.low_stock_count', 7)
            ->assertJsonCount(5, 'data.low_stock_products')
            ->assertJsonPath('data.low_stock_products.0.inventory_unit', 'gram');
        $this->assertArrayNotHasKey('barcode_value', $response->json('data.recent_visits.0.member'));
    }
}
