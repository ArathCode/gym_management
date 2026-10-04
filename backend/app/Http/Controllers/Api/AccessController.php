<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use App\Models\Membership;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccessController extends Controller
{
    public function checkIn(Request $request): JsonResponse
    {
        $barcode = trim((string) $request->input('barcode', ''));

        if ($barcode === '') {
            return response()->json([
                'data' => ['access' => 'invalid_barcode'],
                'message' => 'Barcode is required',
            ], 422);
        }

        $member = Member::query()->where('barcode_value', $barcode)->first();

        if (! $member) {
            return response()->json([
                'data' => ['access' => 'member_not_found'],
                'message' => 'Member not found',
            ], 404);
        }

        if ($member->status !== 'active') {
            return response()->json([
                'data' => ['access' => 'member_inactive', 'member' => $member],
                'message' => 'Member is inactive',
            ], 403);
        }

        $latestMembership = Membership::query()
            ->where('member_id', $member->id)
            ->orderByDesc('start_date')
            ->first();

        if (! $latestMembership) {
            return response()->json([
                'data' => ['access' => 'membership_expired', 'member' => $member],
                'message' => 'No active membership found',
            ], 403);
        }

        if ($latestMembership->status === 'suspended') {
            return response()->json([
                'data' => ['access' => 'membership_suspended', 'member' => $member, 'membership' => $latestMembership],
                'message' => 'Membership is suspended',
            ], 403);
        }

        if ($latestMembership->status !== 'active' || Carbon::parse($latestMembership->end_date)->isPast()) {
            return response()->json([
                'data' => ['access' => 'membership_expired', 'member' => $member, 'membership' => $latestMembership],
                'message' => 'Membership has expired',
            ], 403);
        }

        if ((float) $latestMembership->pending_amount > 0) {
            return response()->json([
                'data' => ['access' => 'payment_required', 'member' => $member, 'membership' => $latestMembership],
                'message' => 'Payment required',
            ], 403);
        }

        $duplicate = Visit::query()
            ->where('member_id', $member->id)
            ->where('access_status', 'granted')
            ->where('checked_in_at', '>=', Carbon::now()->subSeconds(10))
            ->exists();

        if ($duplicate) {
            return response()->json([
                'data' => ['access' => 'duplicate_scan', 'member' => $member],
                'message' => 'Duplicate scan detected',
            ], 409);
        }

        $visit = Visit::query()->create([
            'member_id' => $member->id,
            'membership_id' => $latestMembership->id,
            'barcode_value' => $barcode,
            'checked_in_at' => Carbon::now(),
            'access_status' => 'granted',
            'notes' => 'Access granted by barcode scan',
        ]);

        return response()->json([
            'data' => [
                'access' => 'granted',
                'member' => $member,
                'membership' => [
                    'status' => $latestMembership->status,
                    'ends_at' => $latestMembership->end_date,
                ],
                'visit_id' => $visit->id,
            ],
            'message' => 'Access granted',
        ]);
    }
}
