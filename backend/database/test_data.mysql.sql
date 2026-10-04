-- Fixture data for a disposable MySQL/MariaDB development database.
-- Run after `php artisan migrate`. This script inserts records; run it once.

START TRANSACTION;

INSERT INTO membership_plans
    (name, description, duration_days, price, is_active, created_at, updated_at)
VALUES
    ('QA - Pase diario', 'Plan de prueba de un dia', 1, 80.00, 1, NOW(), NOW()),
    ('QA - Mensual', 'Plan mensual de prueba', 30, 450.00, 1, NOW(), NOW()),
    ('QA - Anual', 'Plan anual de prueba', 365, 4200.00, 1, NOW(), NOW());

SET @plan_daily := (SELECT id FROM membership_plans WHERE name = 'QA - Pase diario' ORDER BY id DESC LIMIT 1);
SET @plan_monthly := (SELECT id FROM membership_plans WHERE name = 'QA - Mensual' ORDER BY id DESC LIMIT 1);
SET @plan_annual := (SELECT id FROM membership_plans WHERE name = 'QA - Anual' ORDER BY id DESC LIMIT 1);

INSERT INTO members
    (public_code, barcode_value, first_name, last_name, phone, email, birth_date, photo_path, status, registered_at, created_at, updated_at)
VALUES
    ('QA-M-001', 'QA-BAR-001', 'Ana', 'Prueba', '5550101001', 'ana.qa@example.test', '1995-04-12', NULL, 'active', NOW(), NOW(), NOW()),
    ('QA-M-002', 'QA-BAR-002', 'Bruno', 'Prueba', '5550101002', 'bruno.qa@example.test', '1992-08-23', NULL, 'active', NOW(), NOW(), NOW()),
    ('QA-M-003', 'QA-BAR-003', 'Carla', 'Prueba', '5550101003', 'carla.qa@example.test', '1998-01-05', NULL, 'active', NOW(), NOW(), NOW()),
    ('QA-M-004', 'QA-BAR-004', 'Diego', 'Prueba', '5550101004', 'diego.qa@example.test', '1990-11-17', NULL, 'inactive', NOW(), NOW(), NOW());

SET @member_paid := (SELECT id FROM members WHERE public_code = 'QA-M-001' LIMIT 1);
SET @member_partial := (SELECT id FROM members WHERE public_code = 'QA-M-002' LIMIT 1);
SET @member_expired := (SELECT id FROM members WHERE public_code = 'QA-M-003' LIMIT 1);
SET @member_inactive := (SELECT id FROM members WHERE public_code = 'QA-M-004' LIMIT 1);

INSERT INTO memberships
    (member_id, membership_plan_id, start_date, end_date, status, total_amount, paid_amount, pending_amount, created_at, updated_at)
VALUES
    (@member_paid, @plan_monthly, DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 20 DAY), 'active', 450.00, 450.00, 0.00, NOW(), NOW()),
    (@member_partial, @plan_monthly, DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 25 DAY), 'active', 450.00, 200.00, 250.00, NOW(), NOW()),
    (@member_expired, @plan_monthly, DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY), DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY), 'expired', 450.00, 450.00, 0.00, NOW(), NOW()),
    (@member_inactive, @plan_annual, DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 355 DAY), 'suspended', 4200.00, 4200.00, 0.00, NOW(), NOW());

SET @membership_paid := (SELECT id FROM memberships WHERE member_id = @member_paid AND membership_plan_id = @plan_monthly AND start_date = DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) ORDER BY id DESC LIMIT 1);
SET @membership_partial := (SELECT id FROM memberships WHERE member_id = @member_partial AND membership_plan_id = @plan_monthly AND start_date = DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY) ORDER BY id DESC LIMIT 1);
SET @membership_expired := (SELECT id FROM memberships WHERE member_id = @member_expired AND membership_plan_id = @plan_monthly AND start_date = DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY) ORDER BY id DESC LIMIT 1);
SET @membership_suspended := (SELECT id FROM memberships WHERE member_id = @member_inactive AND membership_plan_id = @plan_annual AND start_date = DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) ORDER BY id DESC LIMIT 1);

INSERT INTO payments
    (member_id, membership_id, amount, payment_method, reference, status, paid_at, created_at, updated_at)
VALUES
    (@member_paid, @membership_paid, 450.00, 'cash', 'QA-PAY-001', 'paid', NOW(), NOW(), NOW()),
    (@member_partial, @membership_partial, 200.00, 'card', 'QA-PAY-002', 'partial', NOW(), NOW(), NOW()),
    (@member_expired, @membership_expired, 450.00, 'transfer', 'QA-PAY-003', 'paid', DATE_SUB(NOW(), INTERVAL 30 DAY), NOW(), NOW()),
    (@member_inactive, @membership_suspended, 4200.00, 'cash', 'QA-PAY-004', 'paid', NOW(), NOW(), NOW());

INSERT INTO products
    (name, sku, category_id, sale_type, inventory_unit, sale_price, cost_price, stock, minimum_stock, portion_size, is_active, created_at, updated_at)
VALUES
    ('QA - Agua 600 ml', 'QA-WATER-001', NULL, 'piece', 'unit', 20.00, 8.00, 48.00, 10.00, 1.00, 1, NOW(), NOW()),
    ('QA - Proteina whey', 'QA-WHEY-001', NULL, 'scoop', 'gram', 35.00, 0.80, 1940.00, 300.00, 30.00, 1, NOW(), NOW()),
    ('QA - Avena a granel', 'QA-OATS-001', NULL, 'weight', 'gram', 0.12, 0.05, 9750.00, 500.00, 1.00, 1, NOW(), NOW());

SET @product_water := (SELECT id FROM products WHERE sku = 'QA-WATER-001' LIMIT 1);
SET @product_whey := (SELECT id FROM products WHERE sku = 'QA-WHEY-001' LIMIT 1);
SET @product_oats := (SELECT id FROM products WHERE sku = 'QA-OATS-001' LIMIT 1);

INSERT INTO sales
    (member_id, subtotal, discount, total, payment_method, status, sold_at, created_at, updated_at)
VALUES
    (@member_paid, 140.00, 0.00, 140.00, 'cash', 'completed', NOW(), NOW(), NOW());

SET @sale_id := LAST_INSERT_ID();

INSERT INTO sale_items
    (sale_id, product_id, quantity, unit_price, subtotal, inventory_quantity, created_at, updated_at)
VALUES
    (@sale_id, @product_water, 2.00, 20.00, 40.00, 2.00, NOW(), NOW()),
    (@sale_id, @product_whey, 2.00, 35.00, 70.00, 60.00, NOW(), NOW()),
    (@sale_id, @product_oats, 250.00, 0.12, 30.00, 250.00, NOW(), NOW());

INSERT INTO inventory_movements
    (product_id, type, quantity, previous_stock, new_stock, reference_type, reference_id, notes, created_at, updated_at)
VALUES
    (@product_water, 'IN', 50.00, 0.00, 50.00, 'fixture', NULL, 'Existencia inicial de prueba', NOW(), NOW()),
    (@product_whey, 'IN', 2000.00, 0.00, 2000.00, 'fixture', NULL, 'Existencia inicial en gramos', NOW(), NOW()),
    (@product_oats, 'IN', 10000.00, 0.00, 10000.00, 'fixture', NULL, 'Existencia inicial en gramos', NOW(), NOW()),
    (@product_water, 'SALE', 2.00, 50.00, 48.00, 'sale', @sale_id, 'Venta de prueba: 2 piezas', NOW(), NOW()),
    (@product_whey, 'SALE', 60.00, 2000.00, 1940.00, 'sale', @sale_id, 'Venta de prueba: 2 scoops de 30 g', NOW(), NOW()),
    (@product_oats, 'SALE', 250.00, 10000.00, 9750.00, 'sale', @sale_id, 'Venta de prueba: 250 g a granel', NOW(), NOW());

INSERT INTO visits
    (member_id, membership_id, barcode_value, checked_in_at, access_status, notes, created_at, updated_at)
VALUES
    (@member_paid, @membership_paid, 'QA-BAR-001', DATE_SUB(NOW(), INTERVAL 2 HOUR), 'granted', 'Acceso de prueba autorizado', NOW(), NOW()),
    (@member_paid, @membership_paid, 'QA-BAR-001', DATE_SUB(NOW(), INTERVAL 1 DAY), 'granted', 'Visita anterior de prueba', NOW(), NOW()),
    (@member_expired, @membership_expired, 'QA-BAR-003', NOW(), 'denied', 'Membresia vencida', NOW(), NOW()),
    (@member_inactive, @membership_suspended, 'QA-BAR-004', NOW(), 'denied', 'Miembro inactivo y membresia suspendida', NOW(), NOW());

COMMIT;