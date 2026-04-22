// ═══ config/database.js ═══════════════════════════════
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER || 'vegz_user',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME || 'vegz_db',
  waitForConnections: true,
  connectionLimit:    parseInt(process.env.DB_POOL_MAX) || 20,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+05:30',
  connectTimeout:     10000,
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log(`✅  MySQL connected → ${process.env.DB_HOST}/${process.env.DB_NAME}`);
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
