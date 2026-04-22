// ═══════════════════════════════════════════════
//  VEGZ — Finance & Inventory Routes (Admin only)
// ═══════════════════════════════════════════════
const express  = require('express');
const { pool } = require('../config/database');
const router   = express.Router();

// Re-use admin auth from admin.routes.js
const jwt = require('jsonwebtoken');
async function adminAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Not authenticated' });
    const d = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    if (d.type !== 'admin') return res.status(403).json({ success:false, message:'Admin only' });
    const [rows] = await pool.execute('SELECT * FROM admin_users WHERE id=? AND is_active=1', [d.id]);
    if (!rows.length) return res.status(401).json({ success:false, message:'Admin not found' });
    req.admin = rows[0]; next();
  } catch { res.status(401).json({ success:false, message:'Invalid token' }); }
}

// ── GET /finance/summary ─────────────────────────────────
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(Date.now()-30*24*3600000).toISOString().slice(0,10);
    const dateTo   = to   || new Date().toISOString().slice(0,10);

    // Revenue from orders
    const [[rev]] = await pool.execute(
      `SELECT COALESCE(SUM(total_amount),0) AS revenue,
              COALESCE(SUM(CASE WHEN payment_method='cod' THEN total_amount ELSE 0 END),0) AS cod_rev,
              COALESCE(SUM(CASE WHEN payment_method='upi' THEN total_amount ELSE 0 END),0) AS upi_rev,
              COUNT(*) AS order_count,
              COALESCE(SUM(CASE WHEN status='delivered' THEN total_amount ELSE 0 END),0) AS collected_rev
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'`,
      [dateFrom, dateTo]
    );

    // Farmer payouts
    const [[farmer_pay]] = await pool.execute(
      `SELECT COALESCE(SUM(actual_total),0) AS total_paid,
              COUNT(*) AS listings_paid
       FROM farmer_listings WHERE payment_status='paid' AND DATE(paid_at) BETWEEN ? AND ?`,
      [dateFrom, dateTo]
    );

    // Expenses
    const [[exp]] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE expense_date BETWEEN ? AND ?`,
      [dateFrom, dateTo]
    );

    // Agent payouts
    const [[agent_pay]] = await pool.execute(
      `SELECT COALESCE(SUM(earning_amount),0) AS total FROM agent_assignments WHERE status='delivered' AND DATE(delivered_at) BETWEEN ? AND ?`,
      [dateFrom, dateTo]
    );

    const grossProfit = rev.revenue - farmer_pay.total_paid - agent_pay.total - exp.total;

    // By category expenses
    const [expByCategory] = await pool.execute(
      `SELECT category, SUM(amount) AS total FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY category`,
      [dateFrom, dateTo]
    );

    // Daily breakdown
    const [daily] = await pool.execute(
      `SELECT DATE(created_at) AS date,
              COUNT(*) AS orders,
              SUM(total_amount) AS revenue
       FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
       GROUP BY DATE(created_at) ORDER BY date`,
      [dateFrom, dateTo]
    );

    res.json({ success:true, data:{
      period: { from:dateFrom, to:dateTo },
      revenue: rev.revenue, codRevenue:rev.cod_rev, upiRevenue:rev.upi_rev,
      orderCount: rev.order_count, collectedRevenue: rev.collected_rev,
      farmerPayouts: farmer_pay.total_paid,
      agentPayouts: agent_pay.total,
      totalExpenses: exp.total,
      grossProfit,
      expenseBreakdown: expByCategory,
      dailyBreakdown: daily,
    }});
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /finance/today ───────────────────────────────────
router.get('/today', adminAuth, async (req, res) => {
  try {
    const [[orders]]   = await pool.execute("SELECT COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS r FROM orders WHERE DATE(created_at)=CURDATE() AND status!='cancelled'");
    const [[delivered]]= await pool.execute("SELECT COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS r FROM orders WHERE DATE(created_at)=CURDATE() AND status='delivered'");
    const [[cod]]      = await pool.execute("SELECT COALESCE(SUM(total_amount),0) AS r FROM orders WHERE DATE(created_at)=CURDATE() AND payment_method='cod' AND payment_status='paid'");
    const [[upi]]      = await pool.execute("SELECT COALESCE(SUM(total_amount),0) AS r FROM orders WHERE DATE(created_at)=CURDATE() AND payment_method='upi' AND payment_status='paid'");
    const [[fPaid]]    = await pool.execute("SELECT COALESCE(SUM(actual_total),0) AS r FROM farmer_listings WHERE DATE(paid_at)=CURDATE()");
    const [[agentPay]] = await pool.execute("SELECT COALESCE(SUM(earning_amount),0) AS r FROM agent_assignments WHERE DATE(delivered_at)=CURDATE() AND status='delivered'");
    const [[exp]]      = await pool.execute("SELECT COALESCE(SUM(amount),0) AS r FROM expenses WHERE expense_date=CURDATE()");
    const [[farmers]]  = await pool.execute("SELECT COUNT(*) AS c FROM farmer_listings WHERE DATE(created_at)=CURDATE()");
    const [[agents]]   = await pool.execute("SELECT COUNT(*) AS c FROM agents WHERE is_available=1");
    const [[inventory]]= await pool.execute("SELECT COALESCE(SUM(qty_kg),0) AS kg FROM inventory WHERE is_active=1 AND received_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)");

    res.json({ success:true, data:{
      todayOrders:  orders.c,    todayRevenue: orders.r,
      delivered:    delivered.c, deliveredRevenue: delivered.r,
      codCollected: cod.r,       upiReceived: upi.r,
      farmerPaid:   fPaid.r,     agentPaid: agentPay.r,
      expenses:     exp.r,
      netToday: parseFloat(orders.r) - parseFloat(fPaid.r) - parseFloat(agentPay.r) - parseFloat(exp.r),
      farmerListings: farmers.c,
      activeAgents:   agents.c,
      inventoryKg:    inventory.kg,
    }});
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /finance/expenses ───────────────────────────────
router.post('/expenses', adminAuth, async (req, res) => {
  try {
    const { category, amount, description, paidTo, paymentMode, paymentRef, expenseDate } = req.body;
    if (!category || !amount || !description) return res.status(400).json({ success:false, message:'category, amount, description required' });
    await pool.execute(
      'INSERT INTO expenses (category,amount,description,paid_to,payment_mode,payment_ref,expense_date,recorded_by) VALUES (?,?,?,?,?,?,?,?)',
      [category, amount, description, paidTo||null, paymentMode||'cash', paymentRef||null, expenseDate||new Date().toISOString().slice(0,10), `admin:${req.admin.id}`]
    );
    res.status(201).json({ success:true, message:'Expense recorded' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /finance/expenses ────────────────────────────────
router.get('/expenses', adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const [rows] = await pool.execute(
      `SELECT * FROM expenses WHERE expense_date BETWEEN ? AND ? ORDER BY expense_date DESC`,
      [from||new Date(Date.now()-7*86400000).toISOString().slice(0,10), to||new Date().toISOString().slice(0,10)]
    );
    res.json({ success:true, data:rows });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /finance/inventory ───────────────────────────────
router.get('/inventory', adminAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT i.*, p.name AS product_name, p.name_kannada
       FROM inventory i JOIN products p ON p.id=i.product_id
       WHERE i.is_active=1 ORDER BY i.received_at DESC`
    );
    // Current stock (received - dispatched)
    const [stock] = await pool.execute(
      `SELECT p.name, p.id, 
         COALESCE(SUM(i.qty_kg),0) - COALESCE((SELECT SUM(d.qty_kg) FROM inventory_dispatch d JOIN inventory ii ON ii.id=d.inventory_id WHERE ii.product_id=p.id),0) AS available_kg,
         COALESCE(SUM(i.qty_kg * i.cost_per_kg),0) AS stock_value
       FROM products p LEFT JOIN inventory i ON i.product_id=p.id AND i.is_active=1
       GROUP BY p.id ORDER BY available_kg DESC`
    );
    res.json({ success:true, data:{ batches:rows, currentStock:stock }});
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /finance/inventory ──────────────────────────────
router.post('/inventory', adminAuth, async (req, res) => {
  try {
    const { productId, source, sourceRef, qtyKg, costPerKg, qualityGrade, location } = req.body;
    const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const [[cnt]] = await pool.execute("SELECT COUNT(*) AS c FROM inventory WHERE batch_number LIKE ?", [`BAT-${date}%`]);
    const batch = `BAT-${date}-${String((cnt.c||0)+1).padStart(3,'0')}`;
    await pool.execute(
      'INSERT INTO inventory (product_id,source,source_ref,qty_kg,cost_per_kg,total_cost,batch_number,quality_grade,location) VALUES (?,?,?,?,?,?,?,?,?)',
      [productId, source||'farmer', sourceRef||null, qtyKg, costPerKg, qtyKg*costPerKg, batch, qualityGrade||'A', location||'Mundargi Hub']
    );
    // Update stock levels
    await pool.execute('UPDATE stock_levels SET available_qty=available_qty+?, is_available=1 WHERE product_id=?', [qtyKg, productId]);
    res.status(201).json({ success:true, message:'Inventory added', batchNumber:batch });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /finance/agents ──────────────────────────────────
router.get('/agents', adminAuth, async (req, res) => {
  try {
    const [agents] = await pool.execute(
      `SELECT a.*,
         (SELECT COUNT(*) FROM agent_assignments aa WHERE aa.agent_id=a.id AND DATE(aa.delivered_at)=CURDATE() AND aa.status='delivered') AS today_deliveries,
         (SELECT COALESCE(SUM(earning_amount),0) FROM agent_assignments aa WHERE aa.agent_id=a.id AND DATE(aa.delivered_at)=CURDATE() AND aa.status='delivered') AS today_earnings,
         (SELECT COUNT(*) FROM agent_assignments aa WHERE aa.agent_id=a.id AND aa.status NOT IN ('delivered','failed')) AS pending_count
       FROM agents a ORDER BY a.is_available DESC, today_deliveries DESC`
    );
    res.json({ success:true, data:agents });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /finance/agent-assign ───────────────────────────
router.post('/agent-assign', adminAuth, async (req, res) => {
  try {
    const { agentId, orderId, listingId, type, earningAmount } = req.body;
    await pool.execute(
      'INSERT INTO agent_assignments (agent_id,order_id,listing_id,type,earning_amount) VALUES (?,?,?,?,?)',
      [agentId, orderId||null, listingId||null, type||'delivery', earningAmount||25]
    );
    // Update order status if delivery assignment
    if (orderId) await pool.execute("UPDATE orders SET status='processing' WHERE id=?", [orderId]);
    if (listingId) await pool.execute("UPDATE farmer_listings SET status='agent_assigned',agent_name=(SELECT name FROM agents WHERE id=?) WHERE id=?", [agentId, listingId]);
    res.status(201).json({ success:true, message:'Agent assigned successfully' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
