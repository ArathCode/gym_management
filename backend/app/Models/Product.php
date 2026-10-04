<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'sku',
        'category_id',
        'sale_type',
        'inventory_unit',
        'sale_price',
        'cost_price',
        'stock',
        'minimum_stock',
        'portion_size',
        'is_active',
    ];

    protected $casts = [
        'sale_price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'stock' => 'decimal:2',
        'minimum_stock' => 'decimal:2',
        'portion_size' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }
}
