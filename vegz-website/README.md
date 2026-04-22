# VEGZ — Project README
# vegz.online | api.vegz.online

## Stack
- Frontend: Pure HTML + CSS + JS (no framework, no build step)
- Backend:  Node.js + Express.js
- Database: MySQL 8.0 (single DB for all apps)
- Maps:     OpenStreetMap + Leaflet.js (free, no API key)
- Icons:    Lucide Icons (free)
- Fonts:    Google Fonts (free)
- SMS:      MSG91 (~₹0.20/SMS)
- SSL:      Let's Encrypt (free)
- Hosting:  AWS EC2 (2 servers)

## Architecture
- EC2 Server 1: Nginx + Node.js (frontend + API)
- EC2 Server 2: MySQL 8.0 (database only, private IP)

## Local Development

### Start backend:
    cd backend
    cp .env.example .env
    # Edit .env: set DB_HOST=localhost, OTP_DEV_MODE=true
    npm install
    npm run dev

### Start frontend:
    # VS Code: Right click index.html → Open with Live Server
    # OR:
    cd frontend
    python3 -m http.server 3000

### OTP in dev mode:
    # OTP is always: 123456
    # No SMS sent — check backend terminal

## Production Deploy
See DEPLOY_GUIDE.md for complete AWS EC2 setup instructions.

## API Base URL
- Development: http://localhost:5001
- Production:  https://api.vegz.online
