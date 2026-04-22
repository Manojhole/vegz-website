# VEGZ — COMPLETE DEPLOYMENT GUIDE
# vegz.online + api.vegz.online
# AWS EC2 Two-Server Architecture
# ═══════════════════════════════════════════════════════

## ARCHITECTURE OVERVIEW

┌─────────────────────────────────────────────────────┐
│                    INTERNET                          │
│                        │                             │
│              vegz.online / www.vegz.online           │
│              api.vegz.online                         │
└────────────────────┬────────────────────────────────┘
                     │ (HTTPS via Nginx + Let's Encrypt)
          ┌──────────▼──────────────┐
          │   EC2 SERVER 1          │
          │   (t3.small or t3.micro)│
          │                         │
          │   Nginx (port 80/443)   │
          │     → vegz.online       │  serves frontend HTML
          │     → api.vegz.online   │  proxies to :5001
          │                         │
          │   Node.js (port 5001)   │  Vegz backend API
          │   PM2 (process manager) │
          └──────────┬──────────────┘
                     │ (Private VPC — MySQL port 3306)
          ┌──────────▼──────────────┐
          │   EC2 SERVER 2          │
          │   (t3.micro)            │
          │                         │
          │   MySQL 8.0             │
          │   DB: vegz_db           │
          │   User: vegz_user       │
          │   (NO public IP)        │
          └─────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 1 — AWS SETUP (Do this first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1A. Create a VPC (or use default)
- AWS Console → VPC → Your VPCs
- Use the default VPC, or create a new one with CIDR 10.0.0.0/16
- Create 2 subnets: public (10.0.1.0/24) and private (10.0.2.0/24)

### 1B. Create EC2 Server 1 (Web + API)
- AWS Console → EC2 → Launch Instance
- Name: vegz-server1
- AMI: Ubuntu Server 22.04 LTS (free tier eligible)
- Instance type: t3.micro (free tier) or t3.small
- VPC: your VPC | Subnet: PUBLIC subnet
- Auto-assign public IP: ENABLE
- Security Group: Create new "vegz-web-sg"
  - Inbound rules:
    - SSH  | TCP | 22   | My IP only (for your security)
    - HTTP | TCP | 80   | 0.0.0.0/0
    - HTTPS| TCP | 443  | 0.0.0.0/0
  - Outbound: All traffic (default)
- Key pair: Create new → download .pem file → SAVE IT
- Storage: 20 GB gp3
- Launch

### 1C. Create EC2 Server 2 (Database only)
- AWS Console → EC2 → Launch Instance
- Name: vegz-server2-db
- AMI: Ubuntu Server 22.04 LTS
- Instance type: t3.micro
- VPC: same VPC | Subnet: PRIVATE subnet (or same subnet)
- Auto-assign public IP: DISABLE (database should NOT be public)
- Security Group: Create new "vegz-db-sg"
  - Inbound rules:
    - MySQL/Aurora | TCP | 3306 | Source: vegz-web-sg (select the security group)
    - SSH | TCP | 22 | Source: vegz-web-sg (to SSH from Server 1 if needed)
  - Outbound: All traffic
- Key pair: Use same key pair as Server 1
- Storage: 20 GB gp3
- Launch

### 1D. Get your IPs
- Server 1: Note the PUBLIC IPv4 address (e.g. 54.123.456.789)
- Server 2: Note the PRIVATE IPv4 address (e.g. 10.0.1.25)
  (Server 2 has no public IP — you access it only through Server 1)

### 1E. Set up Elastic IP for Server 1 (so IP doesn't change on restart)
- EC2 → Elastic IPs → Allocate Elastic IP
- Associate with Server 1 instance
- Your site will always point to this IP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 2 — DNS SETUP (Point vegz.online to Server 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In your domain registrar (GoDaddy, Namecheap, etc.):

Add these DNS records:
Type  | Name | Value               | TTL
─────────────────────────────────────────
A     | @    | 54.123.456.789      | 300
A     | www  | 54.123.456.789      | 300
A     | api  | 54.123.456.789      | 300

Wait 15-60 minutes for DNS propagation.
Check: https://dnschecker.org → type vegz.online

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 3 — SET UP EC2 SERVER 2 (Database)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTION A: SSH via Server 1 (jump host)
  ssh -i your-key.pem ubuntu@SERVER1_PUBLIC_IP
  ssh -i your-key.pem ubuntu@SERVER2_PRIVATE_IP

OPTION B: Use AWS Session Manager (no SSH needed)
  AWS Console → EC2 → Server 2 → Connect → Session Manager

### 3A. Install MySQL on Server 2
    sudo apt update && sudo apt upgrade -y
    sudo apt install mysql-server -y
    sudo systemctl enable mysql
    sudo systemctl start mysql

### 3B. Secure MySQL
    sudo mysql_secure_installation
    # Set root password: YES
    # Remove anonymous users: YES
    # Disallow root remote login: YES
    # Remove test database: YES
    # Reload privileges: YES

### 3C. Create database and user
    sudo mysql -u root -p

    -- Inside MySQL:
    CREATE DATABASE vegz_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    -- Create user that connects from SERVER 1's private IP
    -- Replace 10.0.1.XXX with Server 1's PRIVATE IP
    CREATE USER 'vegz_user'@'10.0.1.%' IDENTIFIED BY 'YourStrongPassword123!@#';
    GRANT ALL PRIVILEGES ON vegz_db.* TO 'vegz_user'@'10.0.1.%';
    FLUSH PRIVILEGES;
    EXIT;

### 3D. Configure MySQL to accept remote connections
    sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

    Find this line:
    bind-address = 127.0.0.1

    Change to (allows connections from VPC):
    bind-address = 0.0.0.0

    Save (Ctrl+O, Enter, Ctrl+X)

    sudo systemctl restart mysql

### 3E. Upload and run database SQL files
    # From your local machine, copy SQL files to Server 1 first:
    scp -i your-key.pem database/*.sql ubuntu@SERVER1_IP:/home/ubuntu/

    # Then from Server 1, connect to Server 2 MySQL directly:
    mysql -h SERVER2_PRIVATE_IP -u vegz_user -p vegz_db < /home/ubuntu/001_create_all_tables.sql
    mysql -h SERVER2_PRIVATE_IP -u vegz_user -p vegz_db < /home/ubuntu/001_seed_categories_products.sql

### 3F. Verify from Server 1 that connection works
    mysql -h SERVER2_PRIVATE_IP -u vegz_user -p vegz_db -e "SHOW TABLES;"
    # Should show 15 tables

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 4 — SET UP EC2 SERVER 1 (Web + API)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    ssh -i your-key.pem ubuntu@SERVER1_PUBLIC_IP

### 4A. Install required software
    sudo apt update && sudo apt upgrade -y

    # Node.js 20 (LTS)
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install nodejs -y
    node --version  # should show v20.x.x

    # Nginx
    sudo apt install nginx -y

    # PM2 (keeps Node.js running forever)
    sudo npm install -g pm2

    # Git
    sudo apt install git -y

    # Certbot (free SSL)
    sudo apt install certbot python3-certbot-nginx -y

### 4B. Upload your project files
Option A — Using SCP (from your Mac terminal):
    scp -i your-key.pem -r ./vegz-website ubuntu@SERVER1_IP:/home/ubuntu/

Option B — Using Git (recommended for future updates):
    # On Server 1:
    cd /var/www
    sudo mkdir vegz && sudo chown ubuntu:ubuntu vegz
    cd /var/www/vegz
    git clone YOUR_GITHUB_REPO_URL .

### 4C. Setup the backend
    cd /var/www/vegz/backend
    npm install --production

    cp .env.example .env
    nano .env

    # Fill in these values:
    NODE_ENV=production
    PORT=5001
    DB_HOST=10.0.1.XXX          ← Server 2's PRIVATE IP
    DB_PORT=3306
    DB_USER=vegz_user
    DB_PASSWORD=YourStrongPassword123!@#
    DB_NAME=vegz_db
    JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
    OTP_DEV_MODE=false
    MSG91_AUTH_KEY=your_msg91_key
    MSG91_TEMPLATE_ID=your_template_id
    CORS_ORIGINS=https://vegz.online,https://www.vegz.online

    # Save file: Ctrl+O, Enter, Ctrl+X

### 4D. Test backend starts correctly
    cd /var/www/vegz/backend
    node src/server.js
    # Should see: ✅ MySQL connected + 🌿 Vegz API running
    # Press Ctrl+C to stop

### 4E. Start with PM2
    cd /var/www/vegz/backend
    pm2 start src/server.js --name vegz-api
    pm2 save
    pm2 startup  # copy and run the command it gives you

    # Verify running:
    pm2 status
    pm2 logs vegz-api --lines 20

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 5 — NGINX CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    sudo nano /etc/nginx/sites-available/vegz

Paste this ENTIRE configuration:

─────────────────────────────────────────────────────
# Frontend: vegz.online
server {
    listen 80;
    server_name vegz.online www.vegz.online;
    root /var/www/vegz/frontend;
    index index.html;

    # Gzip compression (makes pages load faster)
    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
    gzip_min_length 1000;

    # Cache static assets (CSS, JS, images)
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # All pages
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

# API: api.vegz.online → Node.js on port 5001
server {
    listen 80;
    server_name api.vegz.online;

    # Increase body size for order requests
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;

        # CORS headers (backup — main CORS is in Node.js)
        add_header Access-Control-Allow-Origin "https://vegz.online" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
}
─────────────────────────────────────────────────────

    # Enable the config
    sudo ln -s /etc/nginx/sites-available/vegz /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default

    # Test nginx config
    sudo nginx -t
    # Should say: syntax is ok / test is successful

    # Restart nginx
    sudo systemctl restart nginx
    sudo systemctl enable nginx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 6 — FREE SSL CERTIFICATE (HTTPS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # Get SSL for all 3 domains in one command
    sudo certbot --nginx \
      -d vegz.online \
      -d www.vegz.online \
      -d api.vegz.online \
      --non-interactive \
      --agree-tos \
      --email hello@vegz.online

    # Certbot automatically:
    # 1. Gets free SSL from Let's Encrypt
    # 2. Updates your nginx config for HTTPS
    # 3. Sets up auto-renewal (runs every 90 days)

    # Test auto-renewal works:
    sudo certbot renew --dry-run

    # Restart nginx after SSL
    sudo systemctl restart nginx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 7 — VERIFY EVERYTHING WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run these checks:

1. Website loads:
   curl https://vegz.online
   # Should return HTML

2. API health:
   curl https://api.vegz.online/health
   # Should return: {"ok":true,"service":"Vegz API",...}

3. Products load:
   curl https://api.vegz.online/api/v1/products
   # Should return 18 vegetables

4. OTP test (uses MSG91 in production):
   curl -X POST https://api.vegz.online/api/v1/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"mobile":"9876543210"}'
   # Should return: {"success":true,"message":"OTP sent successfully"}

5. In browser:
   - Open https://vegz.online
   - Landing page should load beautifully
   - Click "Order Now" → Login modal opens
   - Enter mobile → OTP arrives on phone
   - Enter OTP → Goes to shop page
   - Add items → Cart works
   - Checkout → Address + map + payment
   - Place order → Success page

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 8 — MSG91 SMS SETUP (Real OTP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to msg91.com → Sign up (free)

2. Complete KYC (required for transactional SMS in India)
   - Submit Aadhar/PAN and business documents
   - Approval takes 1-2 business days

3. Create OTP Template:
   - Dashboard → SMS → OTP
   - Template text (EXACT):
     "Your Vegz OTP is ##OTP##. Valid for 10 minutes. Do not share. - Vegz Private Limited"
   - Submit for DLT approval (takes 24-48 hours)

4. Get credentials:
   - Dashboard → API → Auth Key → Copy it
   - Your template will have a Template ID

5. Update /var/www/vegz/backend/.env:
   OTP_DEV_MODE=false
   MSG91_AUTH_KEY=xxxxxxxxxxxxxxxxxxxx
   MSG91_TEMPLATE_ID=xxxxxxxxxxxxxxxxxxxx
   MSG91_SENDER_ID=VEGZAP

6. Restart backend:
   pm2 restart vegz-api

7. Test:
   curl -X POST https://api.vegz.online/api/v1/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"mobile":"YOUR_ACTUAL_NUMBER"}'
   # OTP should arrive on your phone within 5 seconds

Cost: ~₹0.20 per OTP SMS
500 SMSs = ₹100
Recharge at msg91.com → Wallet → Add Money

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 9 — DEPLOYING UPDATES (Future)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When you make changes to the code:

### Frontend update (HTML/CSS/JS):
    # From your Mac, upload changed files:
    scp -i your-key.pem frontend/pages/shop.html ubuntu@SERVER1_IP:/var/www/vegz/frontend/pages/
    scp -i your-key.pem frontend/css/styles.css ubuntu@SERVER1_IP:/var/www/vegz/frontend/css/
    # No restart needed — Nginx serves static files directly

### Backend update (Node.js):
    # Upload changed files:
    scp -i your-key.pem backend/src/controllers/all.controllers.js ubuntu@SERVER1_IP:/var/www/vegz/backend/src/controllers/
    # Then restart:
    ssh -i your-key.pem ubuntu@SERVER1_IP "pm2 restart vegz-api"

### Using Git (cleaner approach):
    # On Server 1:
    cd /var/www/vegz
    git pull origin main
    cd backend && npm install --production
    pm2 restart vegz-api

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 10 — MONITORING & MAINTENANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Check backend status:
    pm2 status
    pm2 logs vegz-api --lines 50
    pm2 monit  # live dashboard

### Check nginx:
    sudo systemctl status nginx
    sudo tail -f /var/log/nginx/error.log
    sudo tail -f /var/log/nginx/access.log

### Check MySQL (from Server 1):
    mysql -h SERVER2_PRIVATE_IP -u vegz_user -p vegz_db
    SELECT COUNT(*) FROM orders;
    SELECT COUNT(*) FROM users;

### Database backup (run weekly on Server 1):
    mysqldump -h SERVER2_PRIVATE_IP -u vegz_user -p vegz_db > /home/ubuntu/backup_$(date +%Y%m%d).sql
    # Upload to S3:
    aws s3 cp /home/ubuntu/backup_$(date +%Y%m%d).sql s3://vegz-backups/

### Server disk space:
    df -h

### Server RAM:
    free -m

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PRODUCTION SECURITY CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

□ OTP_DEV_MODE=false in .env
□ JWT_SECRET is 64+ random characters (not a word)
□ DB_PASSWORD is strong (12+ chars, mixed case, symbols)
□ .env is NOT in git (.gitignore has .env)
□ Server 2 has NO public IP
□ Server 2 security group only allows port 3306 from Server 1
□ HTTPS enabled (certbot)
□ CORS_ORIGINS only has vegz.online (not *)
□ SSH only allowed from your IP (not 0.0.0.0/0)
□ PM2 auto-restart configured
□ Database backups scheduled
□ Server 1 firewall: only ports 22, 80, 443 open

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ESTIMATED AWS MONTHLY COST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Server 1 (t3.micro):   $0 (free tier for 12 months) / $8.50/month after
Server 2 (t3.micro):   $0 (free tier for 12 months) / $8.50/month after
Storage (2 × 20GB):    $2/month total
Data transfer:         First 100GB free, $0.09/GB after
SSL certificate:       $0 (Let's Encrypt, free forever)
Elastic IP:            $0 (free when attached to running instance)

TOTAL YEAR 1:          ~$2/month (just storage)
TOTAL YEAR 2+:         ~$20/month

For production (more traffic), upgrade to t3.small = ~$15/month each

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## QUICK REFERENCE COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Restart backend:          pm2 restart vegz-api
View backend logs:        pm2 logs vegz-api
Reload nginx:             sudo nginx -s reload
Restart nginx:            sudo systemctl restart nginx
Test nginx config:        sudo nginx -t
View nginx errors:        sudo tail -100 /var/log/nginx/error.log
Renew SSL:                sudo certbot renew
Connect to DB:            mysql -h SERVER2_IP -u vegz_user -p vegz_db
Backup DB:                mysqldump -h SERVER2_IP -u vegz_user -p vegz_db > backup.sql
Check disk:               df -h
Check RAM:                free -m
Check PM2:                pm2 status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## COMPLETE FILE STRUCTURE ON SERVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/var/www/vegz/
├── frontend/
│   ├── index.html              ← vegz.online landing page
│   ├── css/
│   │   ├── main.css            ← Design system
│   │   └── styles.css          ← All component styles
│   ├── js/
│   │   ├── config.js           ← API URL (auto-detects prod vs dev)
│   │   ├── api.js              ← All API calls to api.vegz.online
│   │   ├── auth.js             ← OTP login, session management
│   │   └── ui.js               ← Navbar, animations
│   └── pages/
│       ├── shop.html           ← Vegetable catalogue + cart
│       ├── checkout.html       ← Address + OSM map + payment
│       ├── order-success.html  ← Order confirmation
│       └── orders.html         ← Order history
│
└── backend/
    ├── src/
    │   ├── server.js           ← Express entry point (port 5001)
    │   ├── config/
    │   │   └── database.js     ← MySQL pool → EC2 Server 2
    │   ├── services/
    │   │   └── otp.service.js  ← MSG91 / Twilio OTP
    │   ├── middleware/
    │   │   └── auth.middleware.js ← JWT verification
    │   ├── controllers/
    │   │   └── all.controllers.js ← All business logic
    │   └── routes/
    │       ├── auth.routes.js
    │       ├── product.routes.js
    │       ├── order.routes.js
    │       └── user.routes.js
    ├── .env                    ← NEVER commit this
    └── package.json
