<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MembershipPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MembershipPlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => MembershipPlan::query()->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $plan = MembershipPlan::query()->create($this->validatedData($request));

        return response()->json([
            'data' => $plan,
            'message' => 'Membership plan created successfully',
        ], 201);
    }

    public function show(MembershipPlan $membershipPlan): JsonResponse
    {
        return response()->json(['data' => $membershipPlan]);
    }

    public function update(Request $request, MembershipPlan $membershipPlan): JsonResponse
    {
        $membershipPlan->update($this->validatedData($request));

        return response()->json([
            'data' => $membershipPlan->refresh(),
            'message' => 'Membership plan updated successfully',
        ]);
    }

    private function validatedData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'duration_days' => ['required', 'integer', 'min:1'],
            'price' => ['required', 'numeric', 'min:0', 'regex:/^\d+(\.\d{1,2})?$/'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }
}
