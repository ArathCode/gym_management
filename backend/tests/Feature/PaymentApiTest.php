<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\Membership;
use App\Models\MembershipPlan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withToken(User::factory()->create()->createToken('test')->plainTextToken);
    }

    public function test_full_payment_completes_balance(): void
    {
        $membership = $this->createMembership();

        $this->postJson('/api/memberships/'.$membership->id.'/payments', [
            'amount' => '100.00',
            'payment_method' => 'cash',
        ])->assertCreated()
            ->assertJsonPath('data.membership.paid_amount', '100.00')
            ->assertJsonPath('data.membership.pending_amount', '0.00')
            ->assertJsonPath('data.payment.status', 'paid');
    }

    public function test_partial_payment_recalculates_pending_balance(): void
    {
        $membership = $this->createMembership();

        $this->postJson('/api/memberships/'.$membership->id.'/payments', [
            'amount' => '35.50',
            'payment_method' => 'transfer',
        ])->assertCreated()
            ->assertJsonPath('data.membership.paid_amount', '35.50')
            ->assertJsonPath('data.membership.pending_amount', '64.50')
            ->assertJsonPath('data.payment.status', 'partial');
    }

    public function test_overpayment_is_rejected_without_changing_balance(): void
    {
        $membership = $this->createMembership();

        $this->postJson('/api/memberships/'.$membership->id.'/payments', [
            'amount' => '100.01',
            'payment_method' => 'cash',
        ])->assertUnprocessable()->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('0.00', $membership->fresh()->paid_amount);
        $this->assertSame('100.00', $membership->fresh()->pending_amount);
    }

    private function createMembership(): Membership
    {
        $member = Member::query()->create([
            'public_code' => 'M-PAY-1',
            'barcode_value' => 'BC-PAY-1',
            'first_name' => 'Test',
            'last_name' => 'Member',
        ]);
        $plan = MembershipPlan::query()->create([
            'name' => 'Monthly',
            'duration_days' => 30,
            'price' => 100,
        ]);

        return Membership::query()->create([
            'member_id' => $member->id,
            'membership_plan_id' => $plan->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(30)->toDateString(),
            'status' => 'active',
            'total_amount' => '100.00',
            'paid_amount' => '0.00',
            'pending_amount' => '100.00',
        ]);
    }
}
