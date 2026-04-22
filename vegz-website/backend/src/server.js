// ═══════════════════════════════════════════════════════
//  VEGZ BACKEND — server.js
//  Serves: REST API at /api/v1/*
//  Host:   api.vegz.online (EC2 Server 1)
//  DB:     EC2 Server 2 (private IP via VPC)
// ═══════════════════════════════════════════════════════
require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');

const { testConnection } = require('./config/database');
const authRoutes    = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes   = require('./routes/order.routes');
const userRoutes    = require('./routes/user.routes');
const farmerRoutes  = require('./routes/farmer.routes');
const adminRoutes   = require('./routes/admin.routes');

const app = express();

// ── Security ─────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowed = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // Allow: no-origin (curl/mobile), or listed origins
    if (!origin || allowed.includes(origin) || process.env.NODE_ENV === 'development') return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));
app.options('*', cors()); // preflight

// ── Parsing ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health ────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  ok: true, service: 'Vegz API', version: '2.0.0',
  env: process.env.NODE_ENV, ts: new Date().toISOString(),
}));

// ── API Routes ────────────────────────────────────
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders',   orderRoutes);
app.use('/api/v1/users',    userRoutes);
app.use('/api/v1/farmer',  farmerRoutes);
app.use('/api/v1/admin',   adminRoutes);
app.use('/api/v1/agent',   require('./routes/agent.routes'));
app.use('/api/v1/finance', require('./routes/finance.routes'));

// ── 404 ───────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// ── Error ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Start ─────────────────────────────────────────
const PORT = process.env.PORT || 5001;
(async () => {
  await testConnection();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌿  Vegz API running`);
    console.log(`    Port   : ${PORT}`);
    console.log(`    ENV    : ${process.env.NODE_ENV}`);
    console.log(`    DB     : ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    console.log(`    CORS   : ${process.env.CORS_ORIGINS}`);
    console.log(`    OTP    : ${process.env.OTP_DEV_MODE === 'true' ? 'DEV MODE' : 'LIVE SMS'}\n`);
  });
})();
