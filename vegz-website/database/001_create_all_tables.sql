-- ═══════════════════════════════════════════════════════
--  VEGZ PLATFORM — DATABASE SCHEMA
--  Run on EC2 Server 2 MySQL
--  File: 001_create_all_tables.sql
-- ═══════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS vegz_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vegz_db;

-- ── USERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
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

-- ── USER ADDRESSES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_addresses (
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

-- ── OTP SESSIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_sessions (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  mobile      VARCHAR(15)     NOT NULL,
  otp_hash    VARCHAR(255)    NOT NULL,
  purpose     ENUM('login')   NOT NULL DEFAULT 'login',
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_used     TINYINT(1)      NOT NULL DEFAULT 0,
  expires_at  TIMESTAMP       NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── CATEGORIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100)    NOT NULL,
  name_kannada VARCHAR(200)    NULL,
  image_url    VARCHAR(500)    NULL,
  sort_order   SMALLINT        NOT NULL DEFAULT 0,
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRODUCTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
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
  INDEX idx_category (category_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRODUCT QUANTITY OPTIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS product_quantity_options (
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

-- ── STOCK LEVELS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_levels (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  product_id    INT UNSIGNED    NOT NULL UNIQUE,
  available_qty DECIMAL(10,2)   NOT NULL DEFAULT 0,
  min_qty_alert DECIMAL(10,2)   NOT NULL DEFAULT 50,
  is_available  TINYINT(1)      NOT NULL DEFAULT 1,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
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
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (address_id) REFERENCES user_addresses(id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDER ITEMS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
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
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ORDER STATUS HISTORY ──────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED    NOT NULL,
  to_status   VARCHAR(50)     NOT NULL,
  changed_by  VARCHAR(100)    NULL,
  note        TEXT            NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES order_items(order_id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  target_role ENUM('admin','farmer','agent','user') NOT NULL,
  target_id   INT UNSIGNED    NULL,
  type        ENUM('new_order','order_status','low_stock','payment_received','system') NOT NULL,
  title       VARCHAR(200)    NOT NULL,
  body        TEXT            NOT NULL,
  reference_id INT UNSIGNED   NULL,
  is_read     TINYINT(1)      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_target (target_role, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ADMIN USERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
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

-- ── APP SETTINGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(100)    NOT NULL,
  setting_value TEXT            NOT NULL,
  description   VARCHAR(300)    NULL,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'All tables created successfully' AS status;
SHOW TABLES;
