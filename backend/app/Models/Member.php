<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Member extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_code',
        'barcode_value',
        'first_name',
        'last_name',
        'phone',
        'email',
        'birth_date',
        'photo_path',
        'status',
        'registered_at',
    ];

    protected $casts = [
        'registered_at' => 'datetime',
        'birth_date' => 'date',
    ];

    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
