-- ═══════════════════════════════════════════════════════
--  VEGZ — FIXED DATABASE SCHEMA + SEED DATA (combined)
--  Run this single file to set up everything
-- ═══════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS stock_levels;
DROP TABLE IF EXISTS product_quantity_options;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS otp_sessions;
DROP TABLE IF EXISTS user_addresses;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS app_settings;

SET FOREIGN_KEY_CHECKS = 1;

-- ── USERS ─────────────────────────────────────────────
CREATE TABLE users (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  mobile        VARCHAR(15)       NOT NULL UNIQUE,
  name          VARCHAR(120)      NULL,
  business_name VARCHAR(200)      NULL,
  business_type ENUM('hotel','restaurant','caterer','pg','bakery','trader','vendor','other') NULL,
  email         VARCHAR(200)      NULL,
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  is_verified   TINYINT(1)        NOT NULL DEFAULT 0,
  created_at    TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── USER ADDRESSES ────────────────────────────────────
CREATE TABLE user_addresses (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED      NOT NULL,
  label         VARCHAR(60)       NOT NULL DEFAULT 'Delivery',
  contact_name  VARCHAR(120)      NOT NULL,
  contact_phone VARCHAR(15)       NOT NULL,
  address_line1 VARCHAR(255)      NOT NULL,
  address_line2 VARCHAR(255)      NULL,
  city          VARCHAR(100)      NOT NULL,
  district      VARCHAR(100)      NOT NULL DEFAULT 'Gadag',
  state         VARCHAR(100)      NOT NULL DEFAULT 'Karnataka',
  pincode       VARCHAR(10)       NULL,
  location_lat  DECIMAL(10,7)     NULL,
  location_lng  DECIMAL(10,7)     NULL,
  is_default    TINYINT(1)        NOT NULL DEFAULT 0,
  created_at    TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── OTP SESSIONS ──────────────────────────────────────
CREATE TABLE otp_sessions (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  mobile      VARCHAR(15)       NOT NULL,
  otp_hash    VARCHAR(255)      NOT NULL,
  purpose     ENUM('login')     NOT NULL DEFAULT 'login',
  attempts    TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  is_used     TINYINT(1)        NOT NULL DEFAULT 0,
  expires_at  TIMESTAMP         NOT NULL,
  created_at  TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── CATEGORIES ────────────────────────────────────────
CREATE TABLE categories (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100)    NOT NULL,
  name_kannada VARCHAR(200)    NULL,
  image_url    VARCHAR(500)    NULL,
  sort_order   SMALLINT        NOT NULL DEFAULT 0,
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRODUCTS ──────────────────────────────────────────
CREATE TABLE products (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  category_id  INT UNSIGNED    NOT NULL,
  name         VARCHAR(150)    NOT NULL,
  name_kannada VARCHAR(300)    NULL,
  description  TEXT            NULL,
  image_url    VARCHAR(500)    NULL,
  unit         ENUM('kg','crate','bunch','piece') NOT NULL DEFAULT 'kg',
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order   SMALLINT        NOT NULL DEFAULT 0,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRODUCT QUANTITY OPTIONS ──────────────────────────
CREATE TABLE product_quantity_options (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  product_id  INT UNSIGNED    NOT NULL,
  label       VARCHAR(50)     NOT NULL,
  quantity_kg DECIMAL(8,2)    NOT NULL,
  price       DECIMAL(10,2)   NOT NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order  SMALLINT        NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── STOCK LEVELS ──────────────────────────────────────
CREATE TABLE stock_levels (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  product_id    INT UNSIGNED    NOT NULL UNIQUE,
  available_qty DECIMAL(10,2)   NOT NULL DEFAULT 0,
  min_qty_alert DECIMAL(10,2)   NOT NULL DEFAULT 50,
  is_available  TINYINT(1)      NOT NULL DEFAULT 1,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDERS ────────────────────────────────────────────
CREATE TABLE orders (
  id                 INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_number       VARCHAR(25)     NOT NULL UNIQUE,
  user_id            INT UNSIGNED    NOT NULL,
  address_id         INT UNSIGNED    NOT NULL,
  delivery_time      VARCHAR(80)     NULL,
  delivery_notes     TEXT            NULL,
  subtotal           DECIMAL(10,2)   NOT NULL DEFAULT 0,
  delivery_charge    DECIMAL(10,2)   NOT NULL DEFAULT 0,
  total_amount       DECIMAL(10,2)   NOT NULL DEFAULT 0,
  payment_method     ENUM('cod','upi') NOT NULL DEFAULT 'cod',
  payment_status     ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  upi_transaction_id VARCHAR(200)    NULL,
  status             ENUM('placed','confirmed','processing','out_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'placed',
  cancelled_reason   TEXT            NULL,
  location_lat       DECIMAL(10,7)   NULL,
  location_lng       DECIMAL(10,7)   NULL,
  created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (address_id) REFERENCES user_addresses(id),
  INDEX idx_user    (user_id),
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDER ITEMS ───────────────────────────────────────
CREATE TABLE order_items (
  id                 INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_id           INT UNSIGNED    NOT NULL,
  product_id         INT UNSIGNED    NOT NULL,
  quantity_option_id INT UNSIGNED    NOT NULL,
  product_name       VARCHAR(150)    NOT NULL,
  quantity_label     VARCHAR(50)     NOT NULL,
  quantity_kg        DECIMAL(8,2)    NOT NULL,
  unit_price         DECIMAL(10,2)   NOT NULL,
  total_price        DECIMAL(10,2)   NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDER STATUS HISTORY ──────────────────────────────
-- NOTE: references orders(id) directly — NOT order_items
CREATE TABLE order_status_history (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED    NOT NULL,
  to_status   VARCHAR(50)     NOT NULL,
  changed_by  VARCHAR(100)    NULL,
  note        TEXT            NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── NOTIFICATIONS ─────────────────────────────────────
CREATE TABLE notifications (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  target_role  ENUM('admin','user') NOT NULL DEFAULT 'admin',
  target_id    INT UNSIGNED    NULL,
  type         ENUM('new_order','order_status','low_stock','payment_received','system') NOT NULL,
  title        VARCHAR(200)    NOT NULL,
  body         TEXT            NOT NULL,
  reference_id INT UNSIGNED    NULL,
  is_read      TINYINT(1)      NOT NULL DEFAULT 0,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_target (target_role, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ADMIN USERS ───────────────────────────────────────
CREATE TABLE admin_users (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)    NOT NULL,
  email         VARCHAR(200)    NOT NULL UNIQUE,
  mobile        VARCHAR(15)     NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  role          ENUM('super_admin','admin','staff') NOT NULL DEFAULT 'admin',
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  last_login    TIMESTAMP       NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── APP SETTINGS ──────────────────────────────────────
CREATE TABLE app_settings (
  setting_key   VARCHAR(100)    NOT NULL,
  setting_value TEXT            NOT NULL,
  description   VARCHAR(300)    NULL,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ════════════════════════════════════════
--  SEED DATA
-- ════════════════════════════════════════

-- App settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('app_name',        'Vegz',                      'Application name'),
('domain',          'https://vegz.online',        'Website domain'),
('api_domain',      'https://api.vegz.online',    'API domain'),
('order_prefix',    'VGZ',                        'Order number prefix'),
('support_phone',   '+91XXXXXXXXXX',              'Support phone'),
('support_email',   'hello@vegz.online',          'Support email'),
('delivery_charge', '0',                          'Delivery charge'),
('min_order_value', '500',                        'Minimum order INR');

-- Categories
INSERT INTO categories (id, name, name_kannada, sort_order) VALUES
(1, 'Tomato & Onion',  'ಟೊಮೆಟೊ & ಈರುಳ್ಳಿ', 1),
(2, 'Root Vegetables', 'ಬೇರು ತರಕಾರಿ',      2),
(3, 'Gourds',          'ಕುಂಬಳ ತರಕಾರಿ',     3),
(4, 'Leafy Greens',    'ಸೊಪ್ಪು ತರಕಾರಿ',     4),
(5, 'Beans & Peas',    'ಬೀಕಾಯಿ & ಬಟಾಣಿ',   5),
(6, 'Exotic Vegs',     'ವಿಶೇಷ ತರಕಾರಿ',     6);

-- Products
INSERT INTO products (id, category_id, name, name_kannada, unit, sort_order) VALUES
(1,  1, 'Tomato',           'ಟೊಮೆಟೊ',              'kg',    1),
(2,  1, 'Onion',            'ಈರುಳ್ಳಿ',             'kg',    2),
(3,  1, 'Green Chilli',     'ಹಸಿ ಮೆಣಸಿನಕಾಯಿ',     'kg',    3),
(4,  2, 'Potato',           'ಆಲೂಗಡ್ಡೆ',            'kg',    1),
(5,  2, 'Carrot',           'ಗಜ್ಜರಿ',              'kg',    2),
(6,  2, 'Beetroot',         'ಬೀಟ್‌ರೂಟ್',            'kg',    3),
(7,  3, 'Bottle Gourd',     'ಸೋರೆಕಾಯಿ',            'kg',    1),
(8,  3, 'Bitter Gourd',     'ಹಾಗಲಕಾಯಿ',            'kg',    2),
(9,  3, 'Ridge Gourd',      'ಹೀರೆಕಾಯಿ',            'kg',    3),
(10, 4, 'Spinach',          'ಪಾಲಕ್',               'bunch', 1),
(11, 4, 'Methi',            'ಮೆಂತ್ಯ ಸೊಪ್ಪು',        'bunch', 2),
(12, 4, 'Coriander',        'ಕೊತ್ತಂಬರಿ ಸೊಪ್ಪು',    'bunch', 3),
(13, 5, 'Cluster Beans',    'ಗೋರಿಕಾಯಿ',            'kg',    1),
(14, 5, 'Broad Beans',      'ಅವರೆಕಾಯಿ',            'kg',    2),
(15, 5, 'Green Peas',       'ಹಸಿ ಬಟಾಣಿ',           'kg',    3),
(16, 6, 'Capsicum',         'ದೊಣ್ಣೆ ಮೆಣಸು',         'kg',    1),
(17, 6, 'Brinjal',          'ಬದನೆಕಾಯಿ',            'kg',    2),
(18, 6, 'Drumstick',        'ನುಗ್ಗೆಕಾಯಿ',           'kg',    3);

-- Quantity options
INSERT INTO product_quantity_options (product_id,label,quantity_kg,price,sort_order) VALUES
(1,'5 kg',5,130,1),(1,'10 kg',10,250,2),(1,'25 kg',25,600,3),(1,'1 Crate',40,900,4),
(2,'5 kg',5,140,1),(2,'10 kg',10,270,2),(2,'25 kg',25,650,3),(2,'1 Crate',40,1000,4),
(3,'5 kg',5,200,1),(3,'10 kg',10,380,2),(3,'25 kg',25,900,3),(3,'1 Crate',40,1400,4),
(4,'5 kg',5,120,1),(4,'10 kg',10,230,2),(4,'25 kg',25,550,3),(4,'1 Crate',50,1050,4),
(5,'5 kg',5,180,1),(5,'10 kg',10,340,2),(5,'25 kg',25,820,3),(5,'1 Crate',40,1280,4),
(6,'5 kg',5,160,1),(6,'10 kg',10,300,2),(6,'25 kg',25,720,3),(6,'1 Crate',40,1100,4),
(7,'5 kg',5,100,1),(7,'10 kg',10,190,2),(7,'25 kg',25,450,3),(7,'1 Crate',40,700,4),
(8,'5 kg',5,200,1),(8,'10 kg',10,380,2),(8,'25 kg',25,900,3),(8,'1 Crate',40,1400,4),
(9,'5 kg',5,120,1),(9,'10 kg',10,230,2),(9,'25 kg',25,550,3),(9,'1 Crate',40,850,4),
(10,'5 Bunch',2.5,80,1),(10,'10 Bunch',5,150,2),(10,'25 Bunch',12.5,350,3),
(11,'5 Bunch',2.5,70,1),(11,'10 Bunch',5,130,2),(11,'25 Bunch',12.5,300,3),
(12,'5 Bunch',1,50,1),(12,'10 Bunch',2,90,2),(12,'25 Bunch',5,200,3),
(13,'5 kg',5,150,1),(13,'10 kg',10,280,2),(13,'25 kg',25,670,3),(13,'1 Crate',40,1040,4),
(14,'5 kg',5,160,1),(14,'10 kg',10,300,2),(14,'25 kg',25,720,3),(14,'1 Crate',40,1120,4),
(15,'5 kg',5,220,1),(15,'10 kg',10,420,2),(15,'25 kg',25,1000,3),(15,'1 Crate',40,1560,4),
(16,'5 kg',5,280,1),(16,'10 kg',10,530,2),(16,'25 kg',25,1280,3),(16,'1 Crate',40,2000,4),
(17,'5 kg',5,130,1),(17,'10 kg',10,250,2),(17,'25 kg',25,600,3),(17,'1 Crate',40,930,4),
(18,'5 kg',5,200,1),(18,'10 kg',10,380,2),(18,'25 kg',25,900,3),(18,'1 Crate',40,1400,4);

-- Stock levels
INSERT INTO stock_levels (product_id, available_qty, min_qty_alert, is_available) VALUES
(1,500,50,1),(2,800,80,1),(3,200,30,1),(4,600,60,1),(5,300,40,1),(6,200,30,1),
(7,400,50,1),(8,150,25,1),(9,250,30,1),(10,100,20,1),(11,100,20,1),(12,80,20,1),
(13,200,30,1),(14,180,30,1),(15,250,40,1),(16,150,25,1),(17,300,40,1),(18,200,30,1);

-- Verify
SELECT CONCAT('Tables created: ', COUNT(*)) AS result FROM information_schema.tables WHERE table_schema = 'vegz_db';
SELECT CONCAT('Products seeded: ', COUNT(*)) AS result FROM products;
SELECT CONCAT('Options seeded: ', COUNT(*)) AS result FROM product_quantity_options;
