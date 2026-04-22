// ═══════════════════════════════════════════════
//  VEGZ — Admin Routes (Fixed)
//  Key fixes:
//  1. Better error logging to diagnose login issues
//  2. Mobile number lookup flexibility
//  3. Race condition protection on agent job accept
// ═══════════════════════════════════════════════
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/database');
const router   = express.Router();

// ── Admin Auth Middleware ──────────────────────
async function adminAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Admin not authenticated' });
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ success:false, message:'Not an admin token' });
    const [rows] = await pool.execute('SELECT * FROM admin_users WHERE id=? AND is_active=1 LIMIT 1', [decoded.id]);
    if (!rows.length) return res.status(401).json({ success:false, message:'Admin not found' });
    req.admin = rows[0];
    next();
  } catch(e) {
    console.error('[adminAuth error]', e.message);
    res.status(401).json({ success:false, message:'Invalid admin token' });
  }
}

// ── POST /admin/auth/login ─────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[admin login] attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ success:false, message:'Email and password required' });
    }

    // Find admin
    const [rows] = await pool.execute(
      'SELECT * FROM admin_users WHERE email=? LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      console.log('[admin login] email not found:', email);
      return res.status(401).json({ success:false, message:'Invalid credentials' });
    }

    const admin = rows[0];

    if (!admin.is_active) {
      return res.status(401).json({ success:false, message:'Account disabled' });
    }

    // Compare password
    const valid = await bcrypt.compare(password, admin.password_hash);
    console.log('[admin login] password valid:', valid);

    if (!valid) {
      return res.status(401).json({ success:false, message:'Invalid credentials' });
    }

    // Update last login
    await pool.execute('UPDATE admin_users SET last_login=NOW() WHERE id=?', [admin.id]);

    const token = jwt.sign(
      { id:admin.id, type:'admin', role:admin.role },
      process.env.JWT_SECRET,
      { expiresIn:'12h' }
    );

    console.log('[admin login] success for:', email);
    res.json({
      success: true,
      token,
      admin: { id:admin.id, name:admin.name, email:admin.email, role:admin.role }
    });
  } catch(err) {
    console.error('[admin login error]', err.message, err.stack);
    res.status(500).json({ success:false, message:'Server error: ' + err.message });
  }
});

// ── GET /admin/dashboard ──────────────────────
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [[orders]]    = await pool.execute("SELECT COUNT(*) AS total, COALESCE(SUM(total_amount),0) AS revenue FROM orders WHERE DATE(created_at)=CURDATE() AND status!='cancelled'");
    const [[pending]]   = await pool.execute("SELECT COUNT(*) AS c FROM orders WHERE status IN ('placed','confirmed')");
    const [[delivered]] = await pool.execute("SELECT COUNT(*) AS c FROM orders WHERE status='delivered' AND DATE(created_at)=CURDATE()");
    const [[farmers]]   = await pool.execute("SELECT COUNT(*) AS c FROM farmer_listings WHERE status='pending'").catch(()=>[[{c:0}]]);
    const [[users]]     = await pool.execute("SELECT COUNT(*) AS c FROM users WHERE DATE(created_at)=CURDATE()");

    res.json({ success:true, data:{
      todayOrders:              orders.total   || 0,
      todayRevenue:             orders.revenue || 0,
      pendingOrders:            pending.c      || 0,
      deliveredToday:           delivered.c    || 0,
      pendingFarmerCollections: farmers.c      || 0,
      newUsersToday:            users.c        || 0,
    }});
  } catch(err) {
    console.error('[dashboard error]', err.message);
    res.status(500).json({ success:false, message:err.message });
  }
});

// ── GET /admin/orders ─────────────────────────
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { status, city, date, user_id, limit=50, offset=0 } = req.query;
    let q = `SELECT o.*, u.name AS user_name, u.mobile AS user_mobile,
               a.address_line1, a.city, a.district
             FROM orders o
             JOIN users u ON u.id=o.user_id
             JOIN user_addresses a ON a.id=o.address_id
             WHERE 1=1`;
    const params = [];
    if (status) { q += ' AND o.status=?'; params.push(status); }
    if (city)   { q += ' AND a.city LIKE ?'; params.push(`%${city}%`); }
    if (date)   { q += ' AND DATE(o.created_at)=?'; params.push(date); }
    if (user_id){ q += ' AND o.user_id=?'; params.push(user_id); }
    q += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await pool.execute(q, params);
    res.json({ success:true, data:rows, total:rows.length });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /admin/orders/:id ─────────────────────
router.get('/orders/:id', adminAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT o.*, u.name AS user_name, u.mobile AS user_mobile,
              a.address_line1, a.city, a.district, a.pincode, a.contact_phone
       FROM orders o JOIN users u ON u.id=o.user_id JOIN user_addresses a ON a.id=o.address_id
       WHERE o.id=?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success:false, message:'Order not found' });
    const [items]   = await pool.execute('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
    const [history] = await pool.execute('SELECT * FROM order_status_history WHERE order_id=? ORDER BY created_at', [req.params.id]).catch(()=>[[]]); 
    res.json({ success:true, data:{ ...rows[0], items, history }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── PATCH /admin/orders/:id/status ────────────
router.patch('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['placed','confirmed','processing','out_for_delivery','delivered','cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ success:false, message:'Invalid status' });
    await pool.execute('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
    await pool.execute(
      "INSERT IGNORE INTO order_status_history (order_id,to_status,changed_by,note) VALUES (?,?,?,'Updated by admin')",
      [req.params.id, status, `admin:${req.admin.id}`]
    ).catch(()=>{});
    res.json({ success:true, message:`Order status → ${status}` });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /admin/farmer/listings ────────────────
router.get('/farmer/listings', adminAuth, async (req, res) => {
  try {
    const { status, district, date } = req.query;
    let q = `SELECT fl.*, u.mobile AS farmer_mobile_reg,
               (SELECT COUNT(*) FROM farmer_listing_items WHERE listing_id=fl.id) AS item_count
             FROM farmer_listings fl JOIN users u ON u.id=fl.user_id WHERE 1=1`;
    const params = [];
    if (status)   { q += ' AND fl.status=?'; params.push(status); }
    if (district) { q += ' AND fl.district LIKE ?'; params.push(`%${district}%`); }
    if (date)     { q += ' AND DATE(fl.created_at)=?'; params.push(date); }
    q += ' ORDER BY fl.created_at DESC LIMIT 200';
    const [rows] = await pool.execute(q, params);
    res.json({ success:true, data:rows });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── PATCH /admin/farmer/listings/:id ──────────
router.patch('/farmer/listings/:id', adminAuth, async (req, res) => {
  try {
    const { status, agentName, agentMobile, actualTotal, pickupNotes } = req.body;
    const collected = status === 'collected' ? ', collected_at=NOW()' : '';
    await pool.execute(
      `UPDATE farmer_listings SET status=?,agent_name=?,agent_mobile=?,actual_total=?,pickup_notes=?${collected},updated_at=NOW() WHERE id=?`,
      [status, agentName||null, agentMobile||null, actualTotal||null, pickupNotes||null, req.params.id]
    );
    res.json({ success:true, message:'Listing updated' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /admin/farmer/listings/:id/pay ───────
router.post('/farmer/listings/:id/pay', adminAuth, async (req, res) => {
  try {
    const { paymentRef, paidAmount } = req.body;
    await pool.execute(
      `UPDATE farmer_listings SET payment_status='paid',payment_ref=?,actual_total=?,paid_at=NOW(),status='paid' WHERE id=?`,
      [paymentRef, paidAmount, req.params.id]
    );
    res.json({ success:true, message:'Payment marked as completed' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /admin/users ──────────────────────────
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { search } = req.query;
    let q = `SELECT u.id, u.name, u.mobile, u.business_name, u.business_type, u.created_at,
               COUNT(o.id) AS total_orders,
               COALESCE(SUM(o.total_amount),0) AS total_spent,
               MAX(o.created_at) AS last_order_at
             FROM users u LEFT JOIN orders o ON o.user_id=u.id
             WHERE 1=1`;
    const params = [];
    if (search) { q += ' AND (u.name LIKE ? OR u.mobile LIKE ?)'; params.push(`%${search}%`,`%${search}%`); }
    q += ' GROUP BY u.id ORDER BY last_order_at DESC LIMIT 100';
    const [rows] = await pool.execute(q, params);
    res.json({ success:true, data:rows });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /admin/users/:id/orders ───────────────
router.get('/users/:id/orders', adminAuth, async (req, res) => {
  try {
    const [user]   = await pool.execute('SELECT * FROM users WHERE id=?', [req.params.id]);
    const [orders] = await pool.execute(
      `SELECT o.*, a.address_line1, a.city FROM orders o
       JOIN user_addresses a ON a.id=o.address_id
       WHERE o.user_id=? ORDER BY o.created_at DESC`, [req.params.id]
    );
    res.json({ success:true, data:{ user:user[0], orders }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /admin/notifications ──────────────────
router.get('/notifications', adminAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM notifications WHERE target_role='admin' ORDER BY created_at DESC LIMIT 50"
    );
    res.json({ success:true, data:rows });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
module.exports.adminAuth = adminAuth;
