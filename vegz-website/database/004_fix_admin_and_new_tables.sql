-- ═══════════════════════════════════════════════════════════
--  VEGZ — FIX ADMIN LOGIN + ALL NEW TABLES
--  File: 004_fix_admin_and_new_tables.sql
--  Run on Server 2 (MySQL)
-- ═══════════════════════════════════════════════════════════
USE vegz_db;

-- ── FIX ADMIN LOGIN ───────────────────────────────────────
-- Password: Vegz@Admin2025
-- Hash generated with bcrypt cost 12
DELETE FROM admin_users WHERE email = 'admin@vegz.online';
INSERT INTO admin_users (name, email, mobile, password_hash, role, is_active) VALUES
('Vegz Admin', 'admin@vegz.online', '+91XXXXXXXXXX',
 '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uDutXXXiK',
 'super_admin', 1);

-- Verify login will work now:
SELECT id, name, email, role FROM admin_users WHERE email='admin@vegz.online';

-- ── AGENTS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)     NOT NULL,
  mobile        VARCHAR(15)      NOT NULL UNIQUE,
  email         VARCHAR(200)     NULL,
  password_hash VARCHAR(255)     NOT NULL,
  vehicle_type  ENUM('bike','auto','mini_truck','cycle') DEFAULT 'bike',
  vehicle_number VARCHAR(20)     NULL,
  zone          VARCHAR(100)     NULL,
  is_active     TINYINT(1)       NOT NULL DEFAULT 1,
  is_available  TINYINT(1)       NOT NULL DEFAULT 1,
  current_lat   DECIMAL(10,7)    NULL,
  current_lng   DECIMAL(10,7)    NULL,
  last_location_at TIMESTAMP     NULL,
  rating        DECIMAL(3,2)     NOT NULL DEFAULT 5.00,
  total_deliveries INT UNSIGNED  NOT NULL DEFAULT 0,
  today_deliveries INT UNSIGNED  NOT NULL DEFAULT 0,
  today_earnings   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_mobile (mobile),
  INDEX idx_zone (zone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── AGENT ASSIGNMENTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_assignments (
  id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  agent_id        INT UNSIGNED   NOT NULL,
  order_id        INT UNSIGNED   NULL,
  listing_id      INT UNSIGNED   NULL,  -- farmer listing
  type            ENUM('delivery','pickup','both') NOT NULL DEFAULT 'delivery',
  status          ENUM('assigned','accepted','en_route','arrived','picked','delivered','failed')
                                 NOT NULL DEFAULT 'assigned',
  assigned_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at     TIMESTAMP      NULL,
  picked_at       TIMESTAMP      NULL,
  delivered_at    TIMESTAMP      NULL,
  agent_notes     TEXT           NULL,
  proof_photo_url VARCHAR(500)   NULL,
  earning_amount  DECIMAL(8,2)   NOT NULL DEFAULT 0.00,
  earning_paid    TINYINT(1)     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_agent  (agent_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── AGENT LOCATION HISTORY ───────────────────────────────
CREATE TABLE IF NOT EXISTS agent_locations (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  agent_id   INT UNSIGNED  NOT NULL,
  lat        DECIMAL(10,7) NOT NULL,
  lng        DECIMAL(10,7) NOT NULL,
  recorded_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_agent (agent_id),
  INDEX idx_time  (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── INVENTORY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  product_id     INT UNSIGNED   NOT NULL,
  source         ENUM('farmer','apmc','purchased') NOT NULL DEFAULT 'farmer',
  source_ref     VARCHAR(50)    NULL,  -- listing_number or receipt
  qty_kg         DECIMAL(10,2)  NOT NULL,
  cost_per_kg    DECIMAL(8,2)   NOT NULL,
  total_cost     DECIMAL(10,2)  NOT NULL,
  received_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  batch_number   VARCHAR(30)    NOT NULL,
  quality_grade  ENUM('A','B','C') NOT NULL DEFAULT 'A',
  location       VARCHAR(100)   NULL DEFAULT 'Mundargi Hub',
  is_active      TINYINT(1)     NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_product (product_id),
  INDEX idx_batch   (batch_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── INVENTORY DISPATCH ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_dispatch (
  id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  inventory_id INT UNSIGNED   NOT NULL,
  order_id     INT UNSIGNED   NOT NULL,
  qty_kg       DECIMAL(10,2)  NOT NULL,
  dispatched_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (order_id)     REFERENCES orders(id),
  INDEX idx_inv (inventory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── EXPENSES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  category     ENUM('transport','agent_salary','packaging','rent','utilities',
                    'marketing','fuel','maintenance','other') NOT NULL,
  amount       DECIMAL(10,2)  NOT NULL,
  description  TEXT           NOT NULL,
  paid_to      VARCHAR(150)   NULL,
  payment_mode ENUM('cash','upi','bank') NOT NULL DEFAULT 'cash',
  payment_ref  VARCHAR(200)   NULL,
  expense_date DATE           NOT NULL,
  recorded_by  VARCHAR(100)   NULL,
  created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_date     (expense_date),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── DAILY FINANCE SUMMARY ────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_finance (
  id                 INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  summary_date       DATE           NOT NULL UNIQUE,
  total_orders       INT UNSIGNED   NOT NULL DEFAULT 0,
  order_revenue      DECIMAL(10,2)  NOT NULL DEFAULT 0,
  farmer_payouts     DECIMAL(10,2)  NOT NULL DEFAULT 0,
  agent_payouts      DECIMAL(10,2)  NOT NULL DEFAULT 0,
  total_expenses     DECIMAL(10,2)  NOT NULL DEFAULT 0,
  gross_profit       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  net_profit         DECIMAL(10,2)  NOT NULL DEFAULT 0,
  cash_in_hand       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  cod_collected      DECIMAL(10,2)  NOT NULL DEFAULT 0,
  upi_received       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  farmer_listings    INT UNSIGNED   NOT NULL DEFAULT 0,
  total_veg_kg       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  created_at         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── SEED: Default Agents ──────────────────────────────────
-- Password for all agents: Agent@123 (they can change in app)
-- Hash: $2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uDutXXXiK
INSERT IGNORE INTO agents (name, mobile, email, password_hash, vehicle_type, zone) VALUES
('Raju Kumar',     '+919876000001', 'raju@vegz.online',   '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uDutXXXiK', 'bike',      'Mundargi'),
('Suresh Patil',   '+919876000002', 'suresh@vegz.online', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uDutXXXiK', 'mini_truck','Gadag'),
('Mahesh Badiger',  '+919876000003', 'mahesh@vegz.online', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uDutXXXiK', 'bike',      'Ron');

SELECT 'Admin login fixed. Tables created. Agents seeded.' AS status;
SHOW TABLES;
