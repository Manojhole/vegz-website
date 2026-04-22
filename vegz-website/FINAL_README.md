# 🌿 Vegz Private Limited — Platform Documentation

> **B2B Fresh Vegetable Delivery Platform for North Karnataka**  
> Hotels · Restaurants · Caterers · PGs · Bakeries · Mundargi · Gadag district

---

## 📋 Table of Contents

1. [Business Overview](#1-business-overview)
2. [Platform Architecture](#2-platform-architecture)
3. [Tech Stack](#3-tech-stack)
4. [All URLs and Domains](#4-all-urls-and-domains)
5. [User Roles and Their Apps](#5-user-roles-and-their-apps)
6. [Complete File Structure](#6-complete-file-structure)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Local Development Setup](#9-local-development-setup)
10. [Environment Variables](#10-environment-variables)
11. [AWS EC2 Production Deployment](#11-aws-ec2-production-deployment)
12. [Business Flows](#12-business-flows)
13. [Finance Management](#13-finance-management)
14. [Third-party Services](#14-third-party-services)
15. [Security](#15-security)
16. [Maintenance](#16-maintenance)
17. [Future: Android Apps](#17-future-android-apps)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Business Overview

Vegz Private Limited is a B2B fresh vegetable delivery platform for North Karnataka. We source vegetables directly from local farmers and deliver to hotels, restaurants, caterers, PGs and bakeries — every morning, fresh.

**Market:** North Karnataka — Mundargi, Gadag, Ron, Shirahatti, Laxmeshwar, Nargund  
**Model:** Like NinjaCart but for North Karnataka (NinjaCart has zero presence here)  
**Company:** Vegz Private Limited, Mundargi, Gadag District, Karnataka 582118

**Business Flow:**
```
Farmer submits listing
    → Admin assigns agent
        → Agent visits farm, weighs vegetables
            → Vegetables brought to hub
                → Customer orders
                    → Agent delivers to customer's kitchen
                        → Payment collected (COD or UPI)
                            → Farmer paid via UPI after delivery confirmed
```

---

## 2. Platform Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        INTERNET                           │
└────────────────────────┬─────────────────────────────────┘
                         │ DNS (all subdomains → Server 1)
                         ▼
┌──────────────────────────────────────────────────────────┐
│              EC2 SERVER 1 (Ubuntu 22.04)                  │
│              IP: SERVER1_PUBLIC_IP                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Nginx (port 80/443) + Let's Encrypt SSL            │ │
│  │  ├── vegz.online         → /frontend/index.html     │ │
│  │  ├── farmer.vegz.online  → /frontend/pages/farmer   │ │
│  │  ├── admin.vegz.online   → /frontend/pages/admin    │ │
│  │  ├── agent.vegz.online   → /frontend/pages/agent    │ │
│  │  └── api.vegz.online     → proxy :5001              │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Node.js + Express (port 5001) — managed by PM2     │ │
│  │  REST API: /api/v1/*                                │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────┬──────────────────────────────────┘
                        │ MySQL :3306
                        ▼
┌──────────────────────────────────────────────────────────┐
│              EC2 SERVER 2 (Ubuntu 22.04)                  │
│              IP: SERVER2_PUBLIC_IP                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  MySQL 8.x                                          │ │
│  │  Database: vegz_db                                  │ │
│  │  User: vegz_user                                    │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Pure HTML + CSS + JS | No build step, works on any server |
| Backend | Node.js 20 + Express 4 | Fast, simple REST API |
| Database | MySQL 8.x | Relational, ACID compliant |
| Process Manager | PM2 | Keeps Node.js alive 24/7 |
| Web Server | Nginx | Reverse proxy, static files, SSL |
| SSL | Let's Encrypt + Certbot | Free, auto-renewing HTTPS |
| Maps | OpenStreetMap + Leaflet.js | Completely free, no API key |
| Geocoding | Nominatim (OSM) | Free reverse geocoding |
| SMS OTP | MSG91 | ₹0.20/SMS, DLT compliant |
| Payments | Razorpay | 2% fee, UPI/cards |
| Push Notif. | Firebase FCM | Free forever |
| Auth | JWT (jsonwebtoken) | Stateless, secure |
| Passwords | bcryptjs (cost 12) | Industry standard hashing |
| Rate Limiting | express-rate-limit | Bot/abuse protection |
| Security | helmet.js | Security headers |
| Hosting | AWS EC2 t3.micro × 2 | ~$2/month year 1 |
| Fonts | Google Fonts (Instrument Serif + Plus Jakarta Sans) | |

---

## 4. All URLs and Domains

| URL | Purpose | Who uses it |
|-----|---------|------------|
| `https://vegz.online` | Customer landing page | Business owners, hotels |
| `https://vegz.online/pages/shop.html` | Vegetable shop | Logged-in customers |
| `https://vegz.online/pages/checkout.html` | Checkout | Customers |
| `https://vegz.online/pages/orders.html` | Order history | Customers |
| `https://farmer.vegz.online` | Farmer portal | Vegetable farmers |
| `https://admin.vegz.online` | Admin dashboard | Vegz admin team |
| `https://agent.vegz.online` | Agent app | Delivery agents |
| `https://api.vegz.online` | Backend REST API | All frontends |
| `https://api.vegz.online/health` | Health check | Monitoring |

**Local development:**
```
http://127.0.0.1:5500/frontend/             → Customer site
http://127.0.0.1:5500/frontend/pages/admin.html  → Admin
http://127.0.0.1:5500/frontend/pages/agent.html  → Agent
http://127.0.0.1:5500/frontend/pages/farmer.html → Farmer
http://localhost:5001/health                → API health
```

---

## 5. User Roles and Their Apps

### 👤 Customer (Business Owner / Hotel / Restaurant)
- **Login:** Mobile OTP (6-digit, SMS via MSG91)
- **App:** vegz.online (web)
- **Can do:** Browse vegetables, add to cart, checkout, track orders, view history
- **Payment:** COD or UPI

### 🌾 Farmer
- **Login:** Mobile OTP (same flow as customer)
- **App:** farmer.vegz.online (web)
- **Can do:** Submit sell listing (which vegetables, estimated quantity), track collection status, see payment
- **Gets paid:** UPI to registered number, after actual weight verified by agent at farm

### 🚚 Delivery Agent
- **Login:** Mobile number + Password (given by admin)
- **App:** agent.vegz.online (web, mobile-responsive)
- **Can do:** Accept/reject jobs, navigate to pickup/delivery, confirm pickup from farm, confirm delivery to customer, track earnings
- **Earns:** ₹25 per delivery, ₹50 per farm pickup (configured in .env)

### 🔐 Admin (Vegz team)
- **Login:** Email + Password
- **App:** admin.vegz.online (web)
- **Can do:** All orders management, farmer listings, assign agents, manage finances, add expenses, view inventory, customer history
- **Credentials:** admin@vegz.online / Vegz@Admin2025

---

## 6. Complete File Structure

```
vegz-website/
├── frontend/                          # All frontend HTML/CSS/JS
│   ├── index.html                     # Main landing page (vegz.online)
│   ├── firebase-messaging-sw.js       # FCM push notification service worker
│   ├── css/
│   │   ├── main.css                   # Global CSS variables, OTP cells
│   │   └── styles.css                 # Shop, checkout, agent styles
│   ├── js/
│   │   ├── config.js                  # API_BASE (auto-detects local/prod)
│   │   ├── api.js                     # All API calls (API.sendOTP, etc.)
│   │   ├── auth.js                    # OTP login, JWT session management
│   │   └── ui.js                      # Navbar, scroll animations
│   └── pages/
│       ├── shop.html                  # Vegetable catalogue + cart
│       ├── checkout.html              # Address, delivery time, payment
│       ├── order-success.html         # Order confirmation page
│       ├── orders.html                # Order history for customer
│       ├── profile.html               # Customer profile editing
│       ├── farmer.html                # Farmer sell listing portal
│       ├── admin.html                 # Admin dashboard (ALL management)
│       ├── agent.html                 # Agent app (jobs, map, earnings)
│       ├── finance.html               # Finance dashboard (standalone)
│       ├── terms.html                 # Terms & Conditions
│       ├── privacy.html               # Privacy Policy
│       └── refund.html                # Refund Policy
│
├── backend/
│   ├── package.json
│   ├── .env                           # ← NEVER COMMIT THIS
│   ├── .env.example                   # Template (commit this)
│   ├── setup-credentials.js           # One-time credential setup script
│   └── src/
│       ├── server.js                  # Express app entry point
│       ├── config/
│       │   └── database.js            # MySQL connection pool
│       ├── middleware/
│       │   └── auth.middleware.js     # JWT verification for customers
│       ├── routes/
│       │   ├── auth.routes.js         # /api/v1/auth/* (OTP login)
│       │   ├── product.routes.js      # /api/v1/products/*
│       │   ├── order.routes.js        # /api/v1/orders/*
│       │   ├── user.routes.js         # /api/v1/users/* (profile, addresses)
│       │   ├── farmer.routes.js       # /api/v1/farmer/* (sell listings)
│       │   ├── admin.routes.js        # /api/v1/admin/* (all admin APIs)
│       │   ├── agent.routes.js        # /api/v1/agent/* (agent APIs)
│       │   ├── finance.routes.js      # /api/v1/finance/* (reports)
│       │   └── payment.routes.js      # /api/v1/payments/* (Razorpay)
│       └── services/
│           ├── otp.service.js         # MSG91 SMS integration
│           └── notification.service.js # Firebase FCM push notifications
│
└── database/
    ├── 001_create_all_tables.sql      # Core tables (run first)
    ├── 002_seed_data.sql              # 6 categories, 18 vegetables
    ├── 003_farmer_admin_tables.sql    # Farmer + admin + push_tokens
    └── 004_fix_admin_and_new_tables.sql # Agents, inventory, expenses, finance
```

---

## 7. Database Schema

**23 Tables total:**

| Table | Purpose |
|-------|---------|
| `users` | Customer accounts (mobile OTP login) |
| `user_addresses` | Saved delivery addresses per customer |
| `otp_sessions` | Temporary OTP codes (auto-expire in 10 min) |
| `categories` | 6 vegetable categories |
| `products` | 18 vegetables with Kannada names |
| `product_quantity_options` | 5kg/10kg/25kg/crate price options |
| `stock_levels` | Current stock per vegetable |
| `orders` | Customer orders |
| `order_items` | Line items per order |
| `order_status_history` | Full status change log |
| `notifications` | Admin and customer notifications |
| `admin_users` | Admin login (email + password) |
| `agents` | Delivery agent accounts |
| `agent_assignments` | Which agent handles which order/pickup |
| `agent_locations` | GPS location history |
| `farmer_listings` | Farmer sell listings |
| `farmer_listing_items` | Items per farmer listing |
| `inventory` | Stock received from farmers |
| `inventory_dispatch` | Stock dispatched for orders |
| `expenses` | Business expenses (fuel, salary, etc.) |
| `daily_finance` | Auto-calculated daily P&L summary |
| `push_tokens` | Firebase FCM tokens per user/device |
| `app_settings` | Global config (min order, delivery charge, etc.) |

---

## 8. API Reference

### Authentication (Customer)
```
POST /api/v1/auth/send-otp        Body: { mobile }
POST /api/v1/auth/verify-otp      Body: { mobile, otp }
```

### Products
```
GET  /api/v1/products             List all vegetables
GET  /api/v1/products/categories  List categories
```

### Orders (requires customer JWT)
```
POST /api/v1/orders               Place new order
GET  /api/v1/orders               Get customer's orders
```

### Users (requires customer JWT)
```
GET  /api/v1/users/me             Get profile
PUT  /api/v1/users/profile        Update profile
POST /api/v1/users/addresses      Add address
PUT  /api/v1/users/addresses/:id  Edit address
DEL  /api/v1/users/addresses/:id  Delete address
```

### Farmer (requires customer JWT)
```
POST /api/v1/farmer/listings      Submit sell listing
GET  /api/v1/farmer/listings      Get farmer's listings
GET  /api/v1/farmer/listings/:id  Get single listing
```

### Admin (requires admin JWT — email/password login)
```
POST /api/v1/admin/auth/login
GET  /api/v1/admin/dashboard
GET  /api/v1/admin/orders
GET  /api/v1/admin/orders/:id
PATCH /api/v1/admin/orders/:id/status
GET  /api/v1/admin/farmer/listings
PATCH /api/v1/admin/farmer/listings/:id
POST /api/v1/admin/farmer/listings/:id/pay
GET  /api/v1/admin/users
GET  /api/v1/admin/users/:id/orders
GET  /api/v1/admin/notifications
```

### Agent (requires agent JWT — mobile/password login)
```
POST  /api/v1/agent/auth/login
GET   /api/v1/agent/dashboard
GET   /api/v1/agent/assignments
PATCH /api/v1/agent/assignments/:id/status
POST  /api/v1/agent/location
GET   /api/v1/agent/earnings
PATCH /api/v1/agent/availability
```

### Finance (requires admin JWT)
```
GET  /api/v1/finance/summary      Revenue, expenses, profit
GET  /api/v1/finance/today        Today's live numbers
POST /api/v1/finance/expenses     Record expense
GET  /api/v1/finance/expenses     List expenses
GET  /api/v1/finance/inventory    Current stock levels
POST /api/v1/finance/inventory    Add inventory batch
GET  /api/v1/finance/agents       All agents + earnings
POST /api/v1/finance/agent-assign Assign agent to order/pickup
```

### Payments (requires customer JWT)
```
POST /api/v1/payments/create-order  Create Razorpay order
POST /api/v1/payments/verify        Verify payment signature
```

---

## 9. Local Development Setup

### Prerequisites
- Node.js 18 or 20: [nodejs.org](https://nodejs.org)
- MySQL 8.x: `brew install mysql && brew services start mysql`
- VS Code with **Live Server** extension

### Step 1 — Database

```bash
# Login to MySQL (no password set initially)
mysql -u root

# Inside MySQL:
CREATE DATABASE vegz_db CHARACTER SET utf8mb4;
CREATE USER 'vegz_user'@'localhost' IDENTIFIED BY 'vegz123';
GRANT ALL PRIVILEGES ON vegz_db.* TO 'vegz_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Run SQL files in order
mysql -u vegz_user -pvegz123 vegz_db < database/001_create_all_tables.sql
mysql -u vegz_user -pvegz123 vegz_db < database/002_seed_data.sql
mysql -u vegz_user -pvegz123 vegz_db < database/003_farmer_admin_tables.sql
mysql -u vegz_user -pvegz123 vegz_db < database/004_fix_admin_and_new_tables.sql

# Verify
mysql -u vegz_user -pvegz123 vegz_db -e "SELECT COUNT(*) FROM products;"
# Should show 18
```

### Step 2 — Backend

```bash
cd vegz-website/backend

# Install dependencies
npm install

# Setup credentials (fixes admin + agent login)
# Edit setup-credentials.js first — change YOUR_MOBILE and YOUR_NAME
node setup-credentials.js

# Create .env
cp .env.example .env
# Edit .env — at minimum, set JWT_SECRET (generate it below)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Start backend
npm run dev

# Verify
curl http://localhost:5001/health
# → {"ok":true,"service":"Vegz API","env":"development"}
```

### Step 3 — Frontend

1. Open VS Code → Open folder `vegz-website/frontend/`
2. Install extension: **Live Server** by Ritwick Dey
3. Right-click `index.html` → **Open with Live Server**
4. Browser opens at `http://127.0.0.1:5500`

### Step 4 — Test Full Flow

1. Open `http://127.0.0.1:5500`
2. Click **Order Now**
3. Enter any 10-digit mobile (e.g. `9876543210`)
4. OTP: `123456` (dev mode)
5. Browse shop → Add tomatoes → Checkout → Place order ✅

**Admin:** `http://127.0.0.1:5500/frontend/pages/admin.html`  
Email: `admin@vegz.online` | Password: `Vegz@Admin2025`

**Agent:** `http://127.0.0.1:5500/frontend/pages/agent.html`  
Mobile: (your number from setup-credentials.js) | Password: `Agent@123`

---

## 10. Environment Variables

See `.env.example` for complete list with explanations.

**Critical variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `development` or `production` | Changes logging, error messages |
| `DB_HOST` | `localhost` or Server 2 IP | Server 2 IP for production |
| `JWT_SECRET` | 64-char random hex | Generate once, never change |
| `OTP_DEV_MODE` | `true` (local) `false` (production) | **Set false before launch!** |
| `MSG91_AUTH_KEY` | From MSG91 dashboard | Required for live OTP |
| `CORS_ORIGINS` | Comma-separated domains | All frontend domains |
| `RAZORPAY_KEY_ID` | From Razorpay dashboard | Required for UPI payments |

---

## 11. AWS EC2 Production Deployment

See `AWS_EC2_SETUP_GUIDE.txt` for complete step-by-step guide.

**Quick reference:**
```bash
# Upload files to Server 1
scp -i vegz-key.pem -r vegz-website/frontend ubuntu@SERVER1_IP:/var/www/vegz/
scp -i vegz-key.pem -r vegz-website/backend  ubuntu@SERVER1_IP:/var/www/vegz/

# Start backend
pm2 start src/server.js --name vegz-api && pm2 save

# Free SSL
sudo certbot --nginx -d vegz.online -d www.vegz.online -d api.vegz.online \
  -d admin.vegz.online -d farmer.vegz.online -d agent.vegz.online

# Check everything
pm2 status && curl https://api.vegz.online/health
```

---

## 12. Business Flows

### Customer Order Flow
```
1. Customer visits vegz.online
2. Clicks "Order Now" → enters mobile → gets OTP SMS
3. Enters OTP → logged in
4. Browses shop (18+ vegetables, multiple quantities)
5. Adds to cart → clicks checkout
6. Selects/adds delivery address (with OSM map pin)
7. Picks delivery time slot (5AM-7AM to 7PM-10PM)
8. Selects payment: COD or UPI
9. Places order → order number generated (VGZ-20260421-0001)
10. Admin notified → admin assigns agent
11. Agent delivers → marks delivered in agent app
12. Order auto-marked delivered in customer + admin simultaneously
13. COD: auto-marked paid | UPI: already paid online
14. Customer sees delivery confirmation
```

### Farmer Sell Flow
```
1. Farmer visits farmer.vegz.online
2. OTP login (same as customer)
3. Selects vegetables to sell (pricing shown per kg)
4. Enters ESTIMATED quantity (25kg / 50kg / 100kg / custom)
5. Enters farm address + pins on OSM map
6. Selects preferred pickup time
7. Adds UPI ID for payment
8. Submits listing
9. Admin sees listing → assigns agent
10. Agent visits farm → weighs actual quantity (may differ from estimate)
11. Agent marks "Picked" in app → farmer listing → "collected"
12. Vegetables brought to Vegz hub
13. Admin verifies actual quantity → marks collected
14. Admin pays farmer via UPI manually (or Razorpay Payouts)
15. Admin enters UTR → marks paid → farmer sees payment confirmation
```

### Agent Assignment Flow
```
1. Admin sees new order → clicks "Assign Agent"
2. Only available agents (is_available=1) are shown
3. Admin selects agent → sets earning amount (default ₹25)
4. Agent's phone shows notification (if FCM setup)
5. Agent sees job in "Active Jobs" tab
6. Agent clicks "Accept Job" (DB lock prevents double-accept)
7. Agent clicks "Start Journey" → navigates via Google Maps
8. For delivery: Agent clicks "Confirm Delivery" → enters payment details
9. Order marked delivered in all systems simultaneously
10. Agent's today_deliveries and today_earnings updated
```

---

## 13. Finance Management

### Revenue Sources
- Customer orders (COD + UPI)

### Costs
- Farmer payouts (actual kg × price/kg)
- Agent payouts (₹25/delivery + ₹50/pickup)
- Expenses (fuel, packaging, rent, utilities, etc.)

### Profit Calculation
```
Net Profit = Order Revenue - Farmer Payouts - Agent Payouts - Expenses
```

### Finance Dashboard (`/pages/finance.html`)
- KPI cards: Revenue, Farmer Payouts, Agent Payouts, Expenses, Net Profit, Orders
- Bar chart: Daily revenue (last 7 days) — Chart.js
- Doughnut chart: Expense breakdown by category
- Farmer earnings tracker: All farmers, how much we paid, status
- Agent earnings: Today's deliveries and earnings per agent
- Current inventory: Stock levels per vegetable (auto-updates)
- Expense recorder: Add any expense with category, amount, mode

### Auto-calculations
- When agent marks delivery → `daily_finance` table updated automatically
- When farmer listing marked collected → inventory updated
- When expense added → reflected in next finance summary load

---

## 14. Third-party Services

### MSG91 (OTP SMS) — ₹0.20/SMS
- Setup: msg91.com → KYC → Create OTP template → Get Auth Key
- DLT Registration required: trai.gov.in (takes 3-7 days)
- Template: `"Your Vegz OTP is ##OTP##. Valid 10 minutes. -VEGZPL"`
- Add to `.env`: `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`

### Razorpay (Payments) — 2% per transaction
- Setup: razorpay.com → KYC (1-3 business days) → Get API keys
- Documents needed: PAN, Aadhaar, Bank account, Business proof
- For farmer payouts: Also set up Razorpay Payouts (separate KYC)
- Test mode available during development (no real money)

### Firebase FCM (Push Notifications) — FREE
- Setup: console.firebase.google.com → New project → Web app
- Get: apiKey, messagingSenderId, appId, serverKey
- Place `firebase-messaging-sw.js` in `/frontend/` root (NOT in /pages/)
- Works on Chrome, Firefox, Android Chrome

### OpenStreetMap + Leaflet.js — FREE (no API key)
- Used in: checkout.html, farmer.html, agent.html
- Nominatim API for reverse geocoding (address from GPS coordinates)
- Leaflet CDN: `unpkg.com/leaflet@1.9.4/dist/leaflet.js`

---

## 15. Security

### What's in place
- **bcrypt (cost 12)** — all passwords hashed, never stored plain
- **JWT tokens** — expire in 12h (admin), 24h (agent), 30d (customer)
- **Rate limiting** — 200 requests/15min per IP, 5 OTP requests/15min
- **Helmet.js** — security headers (XSS, clickjacking protection)
- **CORS whitelist** — only listed domains can call the API
- **OTP expiry** — 10 minutes, max 5 wrong attempts
- **Admin isolation** — admin routes require `type:'admin'` in JWT
- **Agent isolation** — agent routes require `type:'agent'` in JWT
- **DB transactions + row locks** — prevent race conditions on job accept

### Important rules
1. Never commit `.env` to Git
2. Never share JWT_SECRET
3. Change `OTP_DEV_MODE=false` before launch
4. Change default passwords after first login
5. Keep `vegz-key.pem` file safe — cannot be recovered
6. Set MySQL bind-address only if you need remote access

### What to add before scale
- AWS WAF (Web Application Firewall)
- CloudFlare (DDoS protection + CDN)
- MySQL SSL connection
- API request signing for mobile apps
- 2FA for admin dashboard

---

## 16. Maintenance

### Daily (admin)
- Check pm2 status: `pm2 status`
- Review pending orders in dashboard
- Assign agents to new farmer listings
- Mark farmer payments done

### Weekly
```bash
# Check disk space
df -h

# Check error logs
pm2 logs vegz-api --lines 100
sudo tail -100 /var/log/nginx/error.log

# Clean old OTP sessions
mysql -u vegz_user -pvegz123 vegz_db -e \
  "DELETE FROM otp_sessions WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);"
```

### Monthly
```bash
# Clean agent location history (keeps DB small)
mysql -u vegz_user -pvegz123 vegz_db -e \
  "DELETE FROM agent_locations WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 7 DAY);"

# Backup database
mysqldump -u vegz_user -pvegz123 vegz_db > vegz_backup_$(date +%Y%m%d).sql
```

### Deploying code changes
```bash
# 1. Upload changed files
scp -i vegz-key.pem frontend/pages/shop.html ubuntu@SERVER1_IP:/var/www/vegz/frontend/pages/

# 2. For backend changes
scp -i vegz-key.pem backend/src/routes/order.routes.js ubuntu@SERVER1_IP:/var/www/vegz/backend/src/routes/
pm2 restart vegz-api

# 3. Verify
curl https://api.vegz.online/health
```

---

## 17. Future: Android Apps

**Planned apps (in priority order):**

| App | Users | Priority | Notes |
|-----|-------|----------|-------|
| `vegz-agent` | Delivery agents | High | Same API, React Native UI |
| `vegz-farmers` | Farmers | Medium | Kannada UI, offline-capable |
| `vegz` | Customers | Low | Web works well on mobile |

**Recommended stack:** React Native + Expo  
**Why React Native:** Shares JavaScript with existing web code. Same backend API — no changes needed. Firebase FCM native integration is straightforward.

**Key features for native apps:**
- Background location tracking (agent app)
- Offline support with sync (farmer app)
- Deep links for push notification taps
- Biometric login option
- Camera for proof-of-delivery photos

---

## 18. Troubleshooting

### Admin login "Invalid credentials"
```bash
# Step 1: Check admin exists in DB
mysql -u vegz_user -pvegz123 vegz_db -e "SELECT id,email,is_active FROM admin_users;"

# Step 2: Re-run credential setup
cd backend
node setup-credentials.js

# Step 3: Restart backend
pm2 restart vegz-api
```

### Agent login "Not found"
```bash
# Check agents in DB
mysql -u vegz_user -pvegz123 vegz_db -e "SELECT id,name,mobile FROM agents;"

# Mobile must match exactly with +91 prefix in DB
# In agent app, enter only 10 digits (the code adds +91 automatically)
```

### API "Connection refused"
```bash
# Check backend is running
pm2 status
# If stopped: pm2 restart vegz-api

# Check it's on correct port
curl http://localhost:5001/health
```

### CORS error in browser
```bash
# Add domain to CORS_ORIGINS in .env
# Then restart: pm2 restart vegz-api
```

### OTP not received (production)
```bash
# Check OTP_DEV_MODE=false in .env
# Check MSG91_AUTH_KEY is valid
# Check DLT template is approved
# Test OTP API: curl -X POST https://api.vegz.online/api/v1/auth/send-otp -d '{"mobile":"9999999999"}'
```

---

## Quick Reference Card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VEGZ QUICK REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Admin:   admin@vegz.online / Vegz@Admin2025
  Agent:   [your mobile] / Agent@123
  Dev OTP: 123456

  pm2 restart vegz-api     (restart backend)
  pm2 logs vegz-api        (view logs)
  pm2 status               (check if running)

  mysql -u vegz_user -pvegz123 vegz_db
  
  API Health: https://api.vegz.online/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Vegz Private Limited — Mundargi, Gadag District, Karnataka 582118*  
*hello@vegz.online | vegz.online*
