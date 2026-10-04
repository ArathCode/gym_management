<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->string('public_code')->unique();
            $table->string('barcode_value')->unique()->nullable();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->date('birth_date')->nullable();
            $table->string('photo_path')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamp('registered_at')->nullable();
            $table->timestamps();
        });

        Schema::create('membership_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('duration_days');
            $table->decimal('price', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('membership_plan_id')->constrained('membership_plans')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['active', 'expired', 'suspended', 'cancelled'])->default('active');
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('pending_amount', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('membership_id')->nullable()->constrained('memberships')->cascadeOnDelete();
            $table->decimal('amount', 12, 2)->default(0);
            $table->enum('payment_method', ['cash', 'card', 'transfer', 'other'])->default('cash');
            $table->string('reference')->nullable();
            $table->enum('status', ['pending', 'partial', 'paid', 'cancelled'])->default('paid');
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('sku')->unique();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->enum('sale_type', ['piece', 'weight', 'scoop'])->default('piece');
            $table->enum('inventory_unit', ['unit', 'gram', 'ml'])->default('unit');
            $table->decimal('sale_price', 12, 2)->default(0);
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('stock', 12, 2)->default(0);
            $table->decimal('minimum_stock', 12, 2)->default(0);
            $table->decimal('portion_size', 12, 2)->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->nullable()->constrained('members')->nullOnDelete();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->enum('payment_method', ['cash', 'card', 'transfer', 'other'])->default('cash');
            $table->enum('status', ['completed', 'cancelled'])->default('completed');
            $table->timestamp('sold_at')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('quantity', 12, 2)->default(0);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('inventory_quantity', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->enum('type', ['IN', 'SALE', 'ADJUSTMENT', 'RETURN', 'WASTE', 'CANCELLATION'])->default('IN');
            $table->decimal('quantity', 12, 2)->default(0);
            $table->decimal('previous_stock', 12, 2)->default(0);
            $table->decimal('new_stock', 12, 2)->default(0);
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->cascadeOnDelete();
            $table->foreignId('membership_id')->nullable()->constrained('memberships')->nullOnDelete();
            $table->string('barcode_value')->nullable();
            $table->timestamp('checked_in_at')->nullable();
            $table->enum('access_status', ['granted', 'denied'])->default('granted');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('visits');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('products');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('memberships');
        Schema::dropIfExists('membership_plans');
        Schema::dropIfExists('members');
    }
};
