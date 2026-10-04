<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Member;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MemberController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $search = trim($validated['search'] ?? '');
        $perPage = (int) ($validated['per_page'] ?? 15);

        $members = Member::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query->where('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%')
                        ->orWhere('public_code', 'like', '%'.$search.'%')
                        ->orWhere('barcode_value', 'like', '%'.$search.'%')
                        ->orWhere('phone', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%');
                });
            })
            ->when(isset($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => $members->items(),
            'meta' => [
                'current_page' => $members->currentPage(),
                'per_page' => $members->perPage(),
                'total' => $members->total(),
                'last_page' => $members->lastPage(),
            ],
        ]);
    }

    public function show(Member $member): JsonResponse
    {
        return response()->json(['data' => $member]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'birth_date' => ['nullable', 'date'],
            'status' => ['nullable', 'in:active,inactive'],
            'barcode_value' => ['nullable', 'string', 'max:255', 'unique:members,barcode_value'],
            'public_code' => ['nullable', 'string', 'max:255', 'unique:members,public_code'],
        ]);

        $validated['public_code'] = $validated['public_code'] ?? 'M-'.strtoupper(Str::random(6));
        $validated['barcode_value'] = $validated['barcode_value'] ?? 'MBR-'.strtoupper(Str::random(10));
        $validated['status'] = $validated['status'] ?? 'active';
        $validated['registered_at'] = $validated['registered_at'] ?? Carbon::now();

        $member = Member::query()->create($validated);

        return response()->json([
            'data' => $member,
            'message' => 'Member created successfully',
        ], 201);
    }

    public function regenerateBarcode(Member $member): JsonResponse
    {
        $member->barcode_value = 'MBR-'.strtoupper(Str::random(10));
        $member->save();

        return response()->json([
            'data' => $member,
            'message' => 'Barcode regenerated successfully',
        ]);
    }

    public function update(Request $request, Member $member): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:255'],
            'last_name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'birth_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
            'barcode_value' => ['sometimes', 'nullable', 'string', 'max:255', Rule::unique('members', 'barcode_value')->ignore($member->id)],
            'public_code' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('members', 'public_code')->ignore($member->id)],
        ]);

        $member->update($validated);

        return response()->json([
            'data' => $member->refresh(),
            'message' => 'Member updated successfully',
        ]);
    }
}
