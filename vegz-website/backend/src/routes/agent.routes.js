// ═══════════════════════════════════════════════════════
//  VEGZ — Agent Routes (Fixed)
//  Key fixes:
//  1. Mobile lookup handles with/without +91
//  2. Race condition protection on job accept (DB lock)
//  3. Better error messages
//  4. Online status controls notification delivery
// ═══════════════════════════════════════════════════════
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/database');
const router   = express.Router();

// ── Normalize mobile ───────────────────────────
function normMobile(m) {
  const digits = m.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return m;
}

// ── Agent Auth Middleware ──────────────────────
async function agentAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Agent not authenticated' });
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type !== 'agent') return res.status(403).json({ success:false, message:'Not an agent token' });
    const [rows] = await pool.execute('SELECT * FROM agents WHERE id=? AND is_active=1 LIMIT 1', [decoded.id]);
    if (!rows.length) return res.status(401).json({ success:false, message:'Agent not found' });
    req.agent = rows[0];
    next();
  } catch(e) {
    console.error('[agentAuth]', e.message);
    res.status(401).json({ success:false, message:'Invalid agent token' });
  }
}

// ── POST /agent/auth/login ─────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;
    console.log('[agent login] attempt:', mobile);

    if (!mobile || !password) {
      return res.status(400).json({ success:false, message:'Mobile and password required' });
    }

    const normalizedMobile = normMobile(mobile);
    console.log('[agent login] normalized mobile:', normalizedMobile);

    // Try both with and without +91
    const [rows] = await pool.execute(
      'SELECT * FROM agents WHERE (mobile=? OR mobile=?) AND is_active=1 LIMIT 1',
      [normalizedMobile, mobile]
    );

    if (!rows.length) {
      console.log('[agent login] no agent found for mobile:', normalizedMobile);
      // List all agents for debug (remove in production)
      const [all] = await pool.execute('SELECT id, name, mobile FROM agents LIMIT 10');
      console.log('[agent login] agents in DB:', all);
      return res.status(404).json({ success:false, message:'Not found' });
    }

    const agent = rows[0];
    const valid = await bcrypt.compare(password, agent.password_hash);
    console.log('[agent login] password valid:', valid, 'for agent:', agent.name);

    if (!valid) return res.status(401).json({ success:false, message:'Invalid password' });

    // Mark online
    await pool.execute('UPDATE agents SET is_available=1 WHERE id=?', [agent.id]);

    const token = jwt.sign({ id:agent.id, type:'agent' }, process.env.JWT_SECRET, { expiresIn:'24h' });
    console.log('[agent login] success:', agent.name);

    res.json({ success:true, token, agent:{
      id:agent.id, name:agent.name, mobile:agent.mobile,
      vehicleType:agent.vehicle_type, zone:agent.zone,
      todayDeliveries:agent.today_deliveries||0,
      todayEarnings:agent.today_earnings||0,
    }});
  } catch(err) {
    console.error('[agent login error]', err.message);
    res.status(500).json({ success:false, message:err.message });
  }
});

// ── GET /agent/dashboard ───────────────────────
router.get('/dashboard', agentAuth, async (req, res) => {
  try {
    const a = req.agent;
    const [[pending]] = await pool.execute(
      "SELECT COUNT(*) AS c FROM agent_assignments WHERE agent_id=? AND status NOT IN ('delivered','failed')",
      [a.id]
    ).catch(()=>[[{c:0}]]);
    const [[today]] = await pool.execute(
      "SELECT COUNT(*) AS c, COALESCE(SUM(earning_amount),0) AS earn FROM agent_assignments WHERE agent_id=? AND DATE(COALESCE(delivered_at,assigned_at))=CURDATE() AND status='delivered'",
      [a.id]
    ).catch(()=>[[{c:0,earn:0}]]);
    const [[week]] = await pool.execute(
      "SELECT COALESCE(SUM(earning_amount),0) AS earn, COUNT(*) AS c FROM agent_assignments WHERE agent_id=? AND delivered_at >= DATE_SUB(NOW(),INTERVAL 7 DAY) AND status='delivered'",
      [a.id]
    ).catch(()=>[[{earn:0,c:0}]]);

    res.json({ success:true, data:{
      agentName:a.name, zone:a.zone||'—', isAvailable:a.is_available,
      pendingAssignments:pending.c, todayDeliveries:today.c, todayEarnings:today.earn,
      weekEarnings:week.earn, weekDeliveries:week.c, totalDeliveries:a.total_deliveries||0,
      rating:a.rating||5.0,
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /agent/assignments ─────────────────────
router.get('/assignments', agentAuth, async (req, res) => {
  try {
    // Create table if not exists (graceful for local dev)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS agent_assignments (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        agent_id INT UNSIGNED NOT NULL,
        order_id INT UNSIGNED NULL,
        listing_id INT UNSIGNED NULL,
        type ENUM('delivery','pickup','both') NOT NULL DEFAULT 'delivery',
        status ENUM('assigned','accepted','en_route','arrived','picked','delivered','failed') NOT NULL DEFAULT 'assigned',
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP NULL,
        picked_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        agent_notes TEXT NULL,
        earning_amount DECIMAL(8,2) NOT NULL DEFAULT 0.00,
        earning_paid TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        INDEX idx_agent (agent_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(()=>{});

    const { status } = req.query;
    let q = `SELECT aa.*,
      o.order_number, o.total_amount, o.payment_method, o.payment_status,
      o.delivery_time, o.delivery_notes,
      ua.address_line1, ua.city, ua.district, ua.contact_phone,
      ua.location_lat, ua.location_lng,
      u.name AS customer_name, u.mobile AS customer_mobile
    FROM agent_assignments aa
    LEFT JOIN orders o ON o.id = aa.order_id
    LEFT JOIN user_addresses ua ON ua.id = o.address_id
    LEFT JOIN users u ON u.id = o.user_id
    WHERE aa.agent_id = ?`;
    const params = [req.agent.id];
    if (status) { q += ' AND aa.status=?'; params.push(status); }
    else { q += " AND aa.status NOT IN ('delivered','failed')"; }
    q += ' ORDER BY aa.assigned_at DESC';
    const [rows] = await pool.execute(q, params);
    res.json({ success:true, data:rows });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── PATCH /agent/assignments/:id/status ───────
// RACE CONDITION PROTECTED: uses DB transaction + row lock
router.patch('/assignments/:id/status', agentAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { status, notes } = req.body;
    const validStatuses = ['accepted','en_route','arrived','picked','delivered','failed'];
    if (!validStatuses.includes(status)) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success:false, message:'Invalid status' });
    }

    // Lock the row — prevents two agents accepting same job simultaneously
    const [assgn] = await conn.execute(
      'SELECT * FROM agent_assignments WHERE id=? AND agent_id=? FOR UPDATE',
      [req.params.id, req.agent.id]
    );
    if (!assgn.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success:false, message:'Assignment not found or not yours' });
    }

    const a = assgn[0];

    // Prevent duplicate accept — if already accepted by this agent, return success
    if (status === 'accepted' && a.status === 'accepted') {
      await conn.commit(); conn.release();
      return res.json({ success:true, message:'Already accepted', status });
    }

    // Build update query
    let updateQ = 'UPDATE agent_assignments SET status=?, agent_notes=?';
    const uParams = [status, notes || a.agent_notes];
    if (status === 'accepted')  { updateQ += ', accepted_at=NOW()'; }
    if (status === 'picked')    { updateQ += ', picked_at=NOW()'; }
    if (status === 'delivered') { updateQ += ', delivered_at=NOW()'; }
    updateQ += ' WHERE id=?';
    uParams.push(req.params.id);
    await conn.execute(updateQ, uParams);

    // On delivery — cascade updates
    if (status === 'delivered' && a.order_id) {
      await conn.execute("UPDATE orders SET status='delivered' WHERE id=?", [a.order_id]);
      // COD payment auto-mark paid
      const [ord] = await conn.execute('SELECT * FROM orders WHERE id=?', [a.order_id]);
      if (ord[0]?.payment_method === 'cod') {
        await conn.execute("UPDATE orders SET payment_status='paid' WHERE id=?", [a.order_id]);
      }
      // Agent stats
      await conn.execute(
        'UPDATE agents SET total_deliveries=total_deliveries+1, today_deliveries=today_deliveries+1, today_earnings=today_earnings+? WHERE id=?',
        [a.earning_amount, req.agent.id]
      );
      // Notification to admin
      await conn.execute(
        "INSERT INTO notifications (target_role,type,title,body,reference_id) VALUES ('admin','order_status',?,?,?)",
        [`✅ Delivered: ${ord[0]?.order_number||a.order_id}`, `Agent ${req.agent.name} confirmed delivery`, a.order_id]
      ).catch(()=>{});
    }

    // On farmer pickup — update listing
    if (status === 'picked' && a.listing_id) {
      await conn.execute(
        "UPDATE farmer_listings SET status='collected', collected_at=NOW() WHERE id=?",
        [a.listing_id]
      ).catch(()=>{});
    }

    await conn.commit();
    res.json({ success:true, message:`Assignment → ${status}`, status });
  } catch(err) {
    await conn.rollback();
    console.error('[assignment status error]', err.message);
    res.status(500).json({ success:false, message:err.message });
  } finally { conn.release(); }
});

// ── POST /agent/location ───────────────────────
router.post('/location', agentAuth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await pool.execute(
      'UPDATE agents SET current_lat=?, current_lng=?, last_location_at=NOW() WHERE id=?',
      [lat, lng, req.agent.id]
    );
    // Store history (create table if not exists)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS agent_locations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        agent_id INT UNSIGNED NOT NULL,
        lat DECIMAL(10,7) NOT NULL,
        lng DECIMAL(10,7) NOT NULL,
        recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_agent (agent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(()=>{});
    await pool.execute(
      'INSERT INTO agent_locations (agent_id,lat,lng) VALUES (?,?,?)',
      [req.agent.id, lat, lng]
    ).catch(()=>{});
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── PATCH /agent/availability ─────────────────
// IMPORTANT: Only available agents receive new job assignments
router.patch('/availability', agentAuth, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    await pool.execute('UPDATE agents SET is_available=? WHERE id=?', [isAvailable?1:0, req.agent.id]);
    res.json({ success:true, message:isAvailable ? 'You are now online' : 'You are offline' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /agent/earnings ────────────────────────
router.get('/earnings', agentAuth, async (req, res) => {
  try {
    const { period='today' } = req.query;
    let where = "aa.status='delivered'";
    if (period==='today') where += ' AND DATE(aa.delivered_at)=CURDATE()';
    else if (period==='week') where += ' AND aa.delivered_at >= DATE_SUB(NOW(),INTERVAL 7 DAY)';
    else if (period==='month') where += ' AND aa.delivered_at >= DATE_SUB(NOW(),INTERVAL 30 DAY)';

    const [rows] = await pool.execute(
      `SELECT aa.*, o.order_number, o.total_amount, ua.city, u.name AS customer_name
       FROM agent_assignments aa
       LEFT JOIN orders o ON o.id=aa.order_id
       LEFT JOIN user_addresses ua ON ua.id=o.address_id
       LEFT JOIN users u ON u.id=o.user_id
       WHERE aa.agent_id=? AND ${where}
       ORDER BY aa.delivered_at DESC`,
      [req.agent.id]
    );
    const total = rows.reduce((s,r) => s + parseFloat(r.earning_amount||0), 0);
    res.json({ success:true, data:{ deliveries:rows, total, count:rows.length }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
module.exports.agentAuth = agentAuth;
