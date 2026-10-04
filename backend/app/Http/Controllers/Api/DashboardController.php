<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardSummary;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(DashboardSummary $summary): JsonResponse
    {
        return response()->json(['data' => $summary->get()]);
    }
}
