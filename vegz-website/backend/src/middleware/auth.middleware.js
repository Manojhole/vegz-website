// ═══ middleware/auth.middleware.js ════════════════════
const jwt    = require('jsonwebtoken');
const { pool } = require('../config/database');

async function protect(req, res, next) {
  try {
    const h = req.headers.authorization||'';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Not authenticated' });
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    const [rows]  = await pool.execute('SELECT id,mobile,name,business_name,is_active FROM users WHERE id=? LIMIT 1', [decoded.id]);
    if (!rows.length||!rows[0].is_active) return res.status(401).json({ success:false, message:'Account not found or inactive' });
    req.user = rows[0];
    next();
  } catch (err) {
    const msg = err.name==='TokenExpiredError' ? 'Session expired. Please login again.' : 'Invalid token';
    res.status(401).json({ success:false, message:msg });
  }
}

module.exports = { protect };
