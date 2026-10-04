<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\Membership;
use App\Models\MembershipPlan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberMembershipApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withToken(User::factory()->create()->createToken('test')->plainTextToken);
    }

    public function test_member_can_be_created_and_generated_codes_are_unique(): void
    {
        $first = $this->postJson('/api/members', [
            'first_name' => 'Ana',
            'last_name' => 'Lopez',
        ])->assertCreated()->json('data');
        $second = $this->postJson('/api/members', [
            'first_name' => 'Luis',
            'last_name' => 'Perez',
        ])->assertCreated()->json('data');

        $this->assertNotSame($first['public_code'], $second['public_code']);
        $this->assertNotSame($first['barcode_value'], $second['barcode_value']);
    }

    public function test_barcode_and_public_code_must_be_unique(): void
    {
        Member::query()->create([
            'public_code' => 'M-UNIQUE-1',
            'barcode_value' => 'BC-UNIQUE-1',
            'first_name' => 'Ana',
            'last_name' => 'Lopez',
        ]);

        $this->postJson('/api/members', [
            'first_name' => 'Luis',
            'last_name' => 'Perez',
            'public_code' => 'M-UNIQUE-1',
            'barcode_value' => 'BC-UNIQUE-2',
        ])->assertUnprocessable()->assertJsonValidationErrors('public_code');

        $this->postJson('/api/members', [
            'first_name' => 'Luis',
            'last_name' => 'Perez',
            'public_code' => 'M-UNIQUE-2',
            'barcode_value' => 'BC-UNIQUE-1',
        ])->assertUnprocessable()->assertJsonValidationErrors('barcode_value');
    }

    public function test_member_can_be_updated_and_found_by_search(): void
    {
        $member = Member::query()->create([
            'public_code' => 'M-SEARCH-1',
            'barcode_value' => 'BC-SEARCH-1',
            'first_name' => 'Ana',
            'last_name' => 'Lopez',
        ]);

        $this->putJson('/api/members/'.$member->id, [
            'first_name' => 'Andrea',
            'public_code' => 'M-SEARCH-1',
        ])->assertOk()->assertJsonPath('data.first_name', 'Andrea');

        $this->getJson('/api/members?search=Andrea')
            ->assertOk()
            ->assertJsonPath('data.0.id', $member->id);
    }

    public function test_membership_creation_calculates_expiry_and_renewal_preserves_history(): void
    {
        $member = $this->createMember();
        $plan = $this->createPlan(30);

        $first = $this->postJson('/api/members/'.$member->id.'/memberships', [
            'membership_plan_id' => $plan->id,
            'start_date' => '2026-10-01',
            'total_amount' => 300,
        ])->assertCreated()->json('data');
        $this->assertStringStartsWith('2026-10-31', $first['end_date']);

        $this->postJson('/api/members/'.$member->id.'/memberships', [
            'membership_plan_id' => $plan->id,
            'start_date' => '2026-10-31',
            'total_amount' => 300,
        ])->assertCreated();

        $this->assertDatabaseCount('memberships', 2);
        $this->assertDatabaseHas('memberships', [
            'id' => $first['id'],
            'start_date' => '2026-10-01 00:00:00',
        ]);
    }

    public function test_expired_membership_denies_access(): void
    {
        $member = $this->createMember('BC-EXPIRED');
        $this->createMembership($member, 'active', now()->subDay()->toDateString());

        $this->postJson('/api/access/check-in', ['barcode' => $member->barcode_value])
            ->assertForbidden()
            ->assertJsonPath('data.access', 'membership_expired');
    }

    public function test_suspended_membership_denies_access(): void
    {
        $member = $this->createMember('BC-SUSPENDED');
        $this->createMembership($member, 'suspended', now()->addDays(10)->toDateString());

        $this->postJson('/api/access/check-in', ['barcode' => $member->barcode_value])
            ->assertForbidden()
            ->assertJsonPath('data.access', 'membership_suspended');
    }

    private function createMember(string $barcode = 'BC-MEMBER'): Member
    {
        return Member::query()->create([
            'public_code' => 'M-'.str_replace('-', '', $barcode),
            'barcode_value' => $barcode,
            'first_name' => 'Test',
            'last_name' => 'Member',
            'status' => 'active',
        ]);
    }

    private function createPlan(int $durationDays = 30): MembershipPlan
    {
        return MembershipPlan::query()->create([
            'name' => 'Monthly',
            'duration_days' => $durationDays,
            'price' => 300,
            'is_active' => true,
        ]);
    }

    private function createMembership(Member $member, string $status, string $endDate): Membership
    {
        $plan = $this->createPlan();

        return Membership::query()->create([
            'member_id' => $member->id,
            'membership_plan_id' => $plan->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => $endDate,
            'status' => $status,
            'total_amount' => 300,
            'paid_amount' => 300,
            'pending_amount' => 0,
        ]);
    }
}
