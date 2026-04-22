-- ═══════════════════════════════════════════════════════
--  VEGZ — SEED DATA
--  Run AFTER migrations
-- ═══════════════════════════════════════════════════════
USE vegz_db;

-- ── APP SETTINGS ──────────────────────────────────────────
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('app_name',         'Vegz',                        'Application name'),
('domain',           'https://vegz.online',          'Website domain'),
('api_domain',       'https://api.vegz.online',      'API domain'),
('order_prefix',     'VGZ',                          'Order number prefix'),
('support_phone',    '+91XXXXXXXXXX',                'Support phone'),
('support_email',    'hello@vegz.online',            'Support email'),
('delivery_charge',  '0',                            'Delivery charge (0=free)'),
('min_order_value',  '500',                          'Minimum order amount in INR'),
('business_city',    'Mundargi, Gadag, Karnataka',   'Business location');

-- ── CATEGORIES ────────────────────────────────────────────
INSERT INTO categories (id, name, name_kannada, sort_order) VALUES
(1, 'Tomato & Onion',  'ಟೊಮೆಟೊ & ಈರುಳ್ಳಿ', 1),
(2, 'Root Vegetables', 'ಬೇರು ತರಕಾರಿ',    2),
(3, 'Gourds',          'ಕುಂಬಳ ತರಕಾರಿ',   3),
(4, 'Leafy Greens',    'ಸೊಪ್ಪು ತರಕಾರಿ',   4),
(5, 'Beans & Peas',    'ಬೀಕಾಯಿ & ಬಟಾಣಿ', 5),
(6, 'Exotic Vegs',     'ವಿಶೇಷ ತರಕಾರಿ',   6);

-- ── PRODUCTS ──────────────────────────────────────────────
INSERT INTO products (id, category_id, name, name_kannada, unit, sort_order) VALUES
-- Tomato & Onion
(1,  1, 'Tomato',           'ಟೊಮೆಟೊ',           'kg',    1),
(2,  1, 'Onion',            'ಈರುಳ್ಳಿ',           'kg',    2),
(3,  1, 'Green Chilli',     'ಹಸಿ ಮೆಣಸಿನಕಾಯಿ',   'kg',    3),
-- Root Vegetables
(4,  2, 'Potato',           'ಆಲೂಗಡ್ಡೆ',         'kg',    1),
(5,  2, 'Carrot',           'ಗಜ್ಜರಿ',           'kg',    2),
(6,  2, 'Beetroot',         'ಬೀಟ್‌ರೂಟ್',         'kg',    3),
-- Gourds
(7,  3, 'Bottle Gourd',     'ಸೋರೆಕಾಯಿ',         'kg',    1),
(8,  3, 'Bitter Gourd',     'ಹಾಗಲಕಾಯಿ',         'kg',    2),
(9,  3, 'Ridge Gourd',      'ಹೀರೆಕಾಯಿ',         'kg',    3),
-- Leafy Greens
(10, 4, 'Spinach',          'ಪಾಲಕ್',             'bunch', 1),
(11, 4, 'Methi / Fenugreek','ಮೆಂತ್ಯ ಸೊಪ್ಪು',     'bunch', 2),
(12, 4, 'Coriander',        'ಕೊತ್ತಂಬರಿ ಸೊಪ್ಪು', 'bunch', 3),
-- Beans & Peas
(13, 5, 'Cluster Beans',    'ಗೋರಿಕಾಯಿ',         'kg',    1),
(14, 5, 'Broad Beans',      'ಅವರೆಕಾಯಿ',         'kg',    2),
(15, 5, 'Green Peas',       'ಹಸಿ ಬಟಾಣಿ',        'kg',    3),
-- Exotic
(16, 6, 'Capsicum',         'ದೊಣ್ಣೆ ಮೆಣಸು',     'kg',    1),
(17, 6, 'Brinjal',          'ಬದನೆಕಾಯಿ',         'kg',    2),
(18, 6, 'Drumstick',        'ನುಗ್ಗೆಕಾಯಿ',        'kg',    3);

-- ── QUANTITY OPTIONS ──────────────────────────────────────
-- Tomato
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(1,'5 kg',5,130,1),(1,'10 kg',10,250,2),(1,'25 kg',25,600,3),(1,'1 Crate',40,900,4);
-- Onion
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(2,'5 kg',5,140,1),(2,'10 kg',10,270,2),(2,'25 kg',25,650,3),(2,'1 Crate',40,1000,4);
-- Green Chilli
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(3,'5 kg',5,200,1),(3,'10 kg',10,380,2),(3,'25 kg',25,900,3),(3,'1 Crate',40,1400,4);
-- Potato
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(4,'5 kg',5,120,1),(4,'10 kg',10,230,2),(4,'25 kg',25,550,3),(4,'1 Crate',50,1050,4);
-- Carrot
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(5,'5 kg',5,180,1),(5,'10 kg',10,340,2),(5,'25 kg',25,820,3),(5,'1 Crate',40,1280,4);
-- Beetroot
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(6,'5 kg',5,160,1),(6,'10 kg',10,300,2),(6,'25 kg',25,720,3),(6,'1 Crate',40,1100,4);
-- Bottle Gourd
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(7,'5 kg',5,100,1),(7,'10 kg',10,190,2),(7,'25 kg',25,450,3),(7,'1 Crate',40,700,4);
-- Bitter Gourd
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(8,'5 kg',5,200,1),(8,'10 kg',10,380,2),(8,'25 kg',25,900,3),(8,'1 Crate',40,1400,4);
-- Ridge Gourd
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(9,'5 kg',5,120,1),(9,'10 kg',10,230,2),(9,'25 kg',25,550,3),(9,'1 Crate',40,850,4);
-- Spinach
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(10,'5 Bunch',2.5,80,1),(10,'10 Bunch',5,150,2),(10,'25 Bunch',12.5,350,3);
-- Methi
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(11,'5 Bunch',2.5,70,1),(11,'10 Bunch',5,130,2),(11,'25 Bunch',12.5,300,3);
-- Coriander
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(12,'5 Bunch',1,50,1),(12,'10 Bunch',2,90,2),(12,'25 Bunch',5,200,3);
-- Cluster Beans
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(13,'5 kg',5,150,1),(13,'10 kg',10,280,2),(13,'25 kg',25,670,3),(13,'1 Crate',40,1040,4);
-- Broad Beans
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(14,'5 kg',5,160,1),(14,'10 kg',10,300,2),(14,'25 kg',25,720,3),(14,'1 Crate',40,1120,4);
-- Green Peas
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(15,'5 kg',5,220,1),(15,'10 kg',10,420,2),(15,'25 kg',25,1000,3),(15,'1 Crate',40,1560,4);
-- Capsicum
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(16,'5 kg',5,280,1),(16,'10 kg',10,530,2),(16,'25 kg',25,1280,3),(16,'1 Crate',40,2000,4);
-- Brinjal
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(17,'5 kg',5,130,1),(17,'10 kg',10,250,2),(17,'25 kg',25,600,3),(17,'1 Crate',40,930,4);
-- Drumstick
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(18,'5 kg',5,200,1),(18,'10 kg',10,380,2),(18,'25 kg',25,900,3),(18,'1 Crate',40,1400,4);

-- ── STOCK LEVELS ──────────────────────────────────────────
INSERT INTO stock_levels (product_id, available_qty, min_qty_alert, is_available) VALUES
(1,500,50,1),(2,800,80,1),(3,200,30,1),(4,600,60,1),(5,300,40,1),(6,200,30,1),
(7,400,50,1),(8,150,25,1),(9,250,30,1),(10,100,20,1),(11,100,20,1),(12,80,20,1),
(13,200,30,1),(14,180,30,1),(15,250,40,1),(16,150,25,1),(17,300,40,1),(18,200,30,1);

-- ── DEFAULT ADMIN (change password on first login) ────────
-- Password: Admin@Vegz2025 → bcrypt hash below
-- To generate your own: node -e "require('bcryptjs').hash('YourPassword',12,(_,h)=>console.log(h))"
INSERT INTO admin_users (name, email, mobile, password_hash, role) VALUES
('Vegz Admin', 'admin@vegz.online', '+91XXXXXXXXXX',
 '$2b$12$placeholder_CHANGE_THIS_IMMEDIATELY_run_hash_script',
 'super_admin');

SELECT CONCAT('✅ Seeded: ', COUNT(*), ' products') AS status FROM products;
SELECT CONCAT('✅ Seeded: ', COUNT(*), ' quantity options') AS status FROM product_quantity_options;
SELECT CONCAT('✅ Seeded: ', COUNT(*), ' stock records') AS status FROM stock_levels;
