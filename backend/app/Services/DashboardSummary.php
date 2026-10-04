<?php

namespace App\Services;

use App\Models\Member;
use App\Models\MembershipPlan;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Visit;
use App\Support\FixedDecimal;
use Carbon\CarbonInterface;

class DashboardSummary
{
    public function get(): array
    {
        $now = now();
        $timezone = 'America/Mexico_City';
        $localToday = $now->copy()->setTimezone($timezone)->startOfDay();
        $storageTimezone = config('app.timezone');
        $today = $localToday->copy()->setTimezone($storageTimezone);
        $tomorrow = $localToday->copy()->addDay()->setTimezone($storageTimezone);
        $yesterday = $localToday->copy()->subDay()->setTimezone($storageTimezone);
        $week = $localToday->copy()->startOfWeek()->setTimezone($storageTimezone);
        $income = $this->income($today, $tomorrow);
        $previousIncome = $this->income($yesterday, $today);
        $visits = Visit::query()->where('access_status', 'granted');
        $todayVisits = (clone $visits)->where('checked_in_at', '>=', $today)->where('checked_in_at', '<', $tomorrow)->count();
        $yesterdayVisits = (clone $visits)->where('checked_in_at', '>=', $yesterday)->where('checked_in_at', '<', $today)->count();
        $members = Member::query()->where('status', 'active');
        $plans = MembershipPlan::query()->where('is_active', true);
        $lowStock = Product::query()->where('is_active', true)->whereColumn('stock', '<=', 'minimum_stock');

        return [
            'timezone' => $timezone,
            'active_members' => (clone $members)->count(),
            'new_active_members_this_week' => (clone $members)->where('registered_at', '>=', $week)->where('registered_at', '<=', $now)->count(),
            'active_plans' => (clone $plans)->count(),
            'new_active_plans_this_week' => (clone $plans)->where('created_at', '>=', $week)->where('created_at', '<=', $now)->count(),
            'income_today' => $income,
            'income_yesterday' => $previousIncome,
            'income_change_percent' => $previousIncome['total'] === '0.00' ? null : FixedDecimal::fromMinorUnits(
                intdiv((FixedDecimal::toMinorUnits($income['total']) - FixedDecimal::toMinorUnits($previousIncome['total'])) * 10000, FixedDecimal::toMinorUnits($previousIncome['total']))
            ),
            'visits_today' => $todayVisits,
            'visits_change' => $todayVisits - $yesterdayVisits,
            'recent_visits' => (clone $visits)->with('member:id,public_code,first_name,last_name')->orderByDesc('checked_in_at')->orderByDesc('id')->limit(10)->get(['id', 'member_id', 'checked_in_at', 'access_status']),
            'low_stock_count' => (clone $lowStock)->count(),
            'low_stock_products' => (clone $lowStock)->orderBy('stock')->orderBy('id')->limit(5)->get(['id', 'name', 'sku', 'stock', 'minimum_stock', 'inventory_unit']),
        ];
    }

    private function income(CarbonInterface $from, CarbonInterface $to): array
    {
        $payments = FixedDecimal::toMinorUnits((string) Payment::query()->whereIn('status', ['paid', 'partial'])->where('paid_at', '>=', $from)->where('paid_at', '<', $to)->sum('amount'));
        $sales = FixedDecimal::toMinorUnits((string) Sale::query()->where('status', 'completed')->where('sold_at', '>=', $from)->where('sold_at', '<', $to)->sum('total'));

        return [
            'memberships' => FixedDecimal::fromMinorUnits($payments),
            'pos' => FixedDecimal::fromMinorUnits($sales),
            'total' => FixedDecimal::fromMinorUnits($payments + $sales),
        ];
    }
}
