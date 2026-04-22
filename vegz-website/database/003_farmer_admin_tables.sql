-- ═══════════════════════════════════════════════════════
--  VEGZ — Additional Tables (Run after 001_create_all_tables.sql)
--  File: 003_farmer_admin_tables.sql
-- ═══════════════════════════════════════════════════════
USE vegz_db;

-- ── FARMER LISTINGS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_listings (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  listing_number   VARCHAR(25)      NOT NULL UNIQUE,
  user_id          INT UNSIGNED     NOT NULL,
  farmer_name      VARCHAR(120)     NOT NULL,
  farmer_mobile    VARCHAR(15)      NOT NULL,
  village          VARCHAR(150)     NOT NULL,
  taluk            VARCHAR(100)     NULL,
  district         VARCHAR(100)     NOT NULL DEFAULT 'Gadag',
  pincode          VARCHAR(10)      NULL,
  landmark         TEXT             NULL,
  pickup_time      VARCHAR(80)      NULL,
  location_lat     DECIMAL(10,7)    NULL,
  location_lng     DECIMAL(10,7)    NULL,
  estimated_total  DECIMAL(10,2)    NOT NULL DEFAULT 0,
  actual_total     DECIMAL(10,2)    NULL,
  status           ENUM('pending','agent_assigned','in_transit','collected','paid','cancelled')
                                    NOT NULL DEFAULT 'pending',
  agent_name       VARCHAR(120)     NULL,
  agent_mobile     VARCHAR(15)      NULL,
  pickup_notes     TEXT             NULL,
  payment_method   ENUM('upi','cash') NOT NULL DEFAULT 'upi',
  farmer_upi_number VARCHAR(20)     NULL,
  payment_status   ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  payment_ref      VARCHAR(200)     NULL,
  paid_at          TIMESTAMP        NULL,
  collected_at     TIMESTAMP        NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user   (user_id),
  INDEX idx_status (status),
  INDEX idx_district (district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── FARMER LISTING ITEMS ──────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_listing_items (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  listing_id        INT UNSIGNED    NOT NULL,
  product_id        INT UNSIGNED    NOT NULL,
  product_name      VARCHAR(150)    NOT NULL,
  estimated_qty_kg  DECIMAL(8,2)    NOT NULL,
  actual_qty_kg     DECIMAL(8,2)    NULL,
  price_per_kg      DECIMAL(8,2)    NOT NULL,
  estimated_amount  DECIMAL(10,2)   NOT NULL,
  actual_amount     DECIMAL(10,2)   NULL,
  quality_grade     ENUM('A','B','C','rejected') NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (listing_id) REFERENCES farmer_listings(id) ON DELETE CASCADE,
  INDEX idx_listing (listing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── FCM PUSH NOTIFICATION TOKENS ──────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED    NULL,
  token      VARCHAR(500)    NOT NULL,
  platform   ENUM('web','android','ios') NOT NULL DEFAULT 'web',
  user_type  ENUM('customer','farmer','admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token(191)),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── ADMIN USERS (proper table) ────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)    NOT NULL,
  email         VARCHAR(200)    NOT NULL UNIQUE,
  mobile        VARCHAR(15)     NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  role          ENUM('super_admin','admin','agent') NOT NULL DEFAULT 'admin',
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  last_login    TIMESTAMP       NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── SEED: Default Admin ───────────────────────────────
-- Password: Vegz@Admin2025
-- CHANGE THIS IMMEDIATELY after first login
-- Generate hash: node -e "require('bcryptjs').hash('Vegz@Admin2025',12,(_,h)=>console.log(h))"
INSERT IGNORE INTO admin_users (name, email, mobile, password_hash, role) VALUES
('Vegz Admin', 'admin@vegz.online', '+91XXXXXXXXXX',
 '$2b$12$rJhGp3k5I2Nv7Lm8QxY4uOeE1aVb9cDfWgHiJoKp6sT0yUzXnMwRl', 'super_admin');

SELECT 'Farmer & Admin tables created' AS status;
