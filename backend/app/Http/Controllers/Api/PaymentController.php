<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Membership;
use App\Models\Payment;
use App\Support\FixedDecimal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', 'in:pending,partial,paid,cancelled'],
            'payment_method' => ['nullable', 'in:cash,card,transfer,other'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $payments = Payment::query()
            ->with(['member:id,public_code,first_name,last_name', 'membership:id,total_amount,paid_amount,pending_amount'])
            ->when(isset($validated['search']), fn ($query) => $query->whereHas('member', function ($query) use ($validated): void {
                $query->where('first_name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('last_name', 'like', '%'.$validated['search'].'%')
                    ->orWhere('public_code', 'like', '%'.$validated['search'].'%');
            }))
            ->when(isset($validated['from']), fn ($query) => $query->whereDate('paid_at', '>=', $validated['from']))
            ->when(isset($validated['to']), fn ($query) => $query->whereDate('paid_at', '<=', $validated['to']))
            ->when(isset($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->when(isset($validated['payment_method']), fn ($query) => $query->where('payment_method', $validated['payment_method']))
            ->orderByDesc('paid_at')
            ->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => $payments->items(),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        ]);
    }

    public function indexForMembership(Request $request, Membership $membership): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $payments = $membership->payments()
            ->orderByDesc('paid_at')
            ->paginate((int) ($validated['per_page'] ?? 15));

        return response()->json([
            'data' => $payments->items(),
            'meta' => [
                'current_page' => $payments->currentPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'last_page' => $payments->lastPage(),
            ],
        ]);
    }

    public function store(Request $request, Membership $membership): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'regex:/^\d+(\.\d{1,2})?$/'],
            'payment_method' => ['required', 'in:cash,card,transfer,other'],
            'reference' => ['nullable', 'string', 'max:255'],
        ]);

        $payment = DB::transaction(function () use ($membership, $validated): Payment {
            $membership = Membership::query()->lockForUpdate()->findOrFail($membership->id);
            $amountCents = FixedDecimal::toMinorUnits($validated['amount']);
            $pendingCents = FixedDecimal::toMinorUnits($membership->pending_amount);

            if ($amountCents > $pendingCents) {
                throw ValidationException::withMessages([
                    'amount' => ['The payment cannot exceed the pending balance.'],
                ]);
            }

            $paidCents = FixedDecimal::toMinorUnits($membership->paid_amount) + $amountCents;
            $newPendingCents = $pendingCents - $amountCents;
            $status = $newPendingCents === 0 ? 'paid' : 'partial';

            $payment = Payment::query()->create([
                'member_id' => $membership->member_id,
                'membership_id' => $membership->id,
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'reference' => $validated['reference'] ?? null,
                'status' => $status,
                'paid_at' => now(),
            ]);

            $membership->update([
                'paid_amount' => FixedDecimal::fromMinorUnits($paidCents),
                'pending_amount' => FixedDecimal::fromMinorUnits($newPendingCents),
            ]);

            return $payment;
        });

        return response()->json([
            'data' => [
                'payment' => $payment,
                'membership' => $membership->fresh(),
            ],
            'message' => 'Payment recorded successfully',
        ], 201);
    }
}
