<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use App\Models\Membership;
use App\Models\MembershipPlan;
use App\Support\FixedDecimal;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class MembershipController extends Controller
{
    public function index(Member $member): JsonResponse
    {
        return response()->json([
            'data' => $member->memberships()->with('plan')->orderByDesc('start_date')->get(),
        ]);
    }

    public function store(Request $request, Member $member): JsonResponse
    {
        $validated = $request->validate([
            'membership_plan_id' => ['required', 'exists:membership_plans,id'],
            'start_date' => ['required', 'date'],
            'status' => ['nullable', 'in:active,expired,suspended,cancelled'],
            'total_amount' => ['nullable', 'numeric', 'min:0', 'regex:/^\d+(\.\d{1,2})?$/'],
            'paid_amount' => ['nullable', 'numeric', 'min:0', 'regex:/^\d+(\.\d{1,2})?$/'],
        ]);

        $plan = MembershipPlan::query()->findOrFail($validated['membership_plan_id']);
        $startDate = Carbon::parse($validated['start_date']);
        $endDate = $startDate->copy()->addDays((int) $plan->duration_days);
        $totalAmount = (string) ($validated['total_amount'] ?? $plan->price);
        $paidAmount = (string) ($validated['paid_amount'] ?? '0.00');
        $totalCents = FixedDecimal::toMinorUnits($totalAmount);
        $paidCents = FixedDecimal::toMinorUnits($paidAmount);

        if ($paidCents > $totalCents) {
            throw ValidationException::withMessages([
                'paid_amount' => ['The paid amount cannot exceed the total amount.'],
            ]);
        }

        $membership = Membership::query()->create([
            'member_id' => $member->id,
            'membership_plan_id' => $validated['membership_plan_id'],
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'status' => $validated['status'] ?? 'active',
            'total_amount' => FixedDecimal::fromMinorUnits($totalCents),
            'paid_amount' => FixedDecimal::fromMinorUnits($paidCents),
            'pending_amount' => FixedDecimal::fromMinorUnits($totalCents - $paidCents),
        ]);

        return response()->json([
            'data' => $membership,
            'message' => 'Membership created successfully',
        ], 201);
    }
}
