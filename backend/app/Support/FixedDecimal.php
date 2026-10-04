<?php

namespace App\Support;

final class FixedDecimal
{
    public static function toMinorUnits(string|int|float $value): int
    {
        $value = (string) $value;
        $negative = str_starts_with($value, '-');
        $value = ltrim($value, '+-');
        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
        $minorUnits = ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');

        return $negative ? -$minorUnits : $minorUnits;
    }

    public static function fromMinorUnits(int $value): string
    {
        $sign = $value < 0 ? '-' : '';
        $absoluteValue = abs($value);

        return $sign.sprintf('%d.%02d', intdiv($absoluteValue, 100), $absoluteValue % 100);
    }
}
