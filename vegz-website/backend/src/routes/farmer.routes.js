// ═══════════════════════════════════════════════
//  VEGZ — Farmer Routes
//  POST /api/v1/farmer/listings   — submit sell listing
//  GET  /api/v1/farmer/listings   — farmer's own listings
//  GET  /api/v1/farmer/listings/:id — single listing detail
// ═══════════════════════════════════════════════
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { pool }    = require('../config/database');

// ── POST /farmer/listings — Submit a sell listing ─────────────────
router.post('/listings', protect, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userId = req.user.id;
    const {
      farmerName, farmerMobile, village, taluk, district, pincode,
      landmark, pickupTime, locationLat, locationLng, items,
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'No items listed' });
    }

    // Generate listing number
    const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const [cnt] = await conn.execute(
      "SELECT COUNT(*) AS c FROM farmer_listings WHERE listing_number LIKE ?",
      [`FARM-${date}%`]
    );
    const listingNum = `FARM-${date}-${String((cnt[0].c||0)+1).padStart(4,'0')}`;

    // Calculate estimated total
    const estTotal = items.reduce((s, i) => s + (i.estimatedAmount || 0), 0);

    // Insert listing
    const [lr] = await conn.execute(
      `INSERT INTO farmer_listings
        (listing_number, user_id, farmer_name, farmer_mobile, village, taluk,
         district, pincode, landmark, pickup_time, location_lat, location_lng,
         estimated_total, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
      [listingNum, userId, farmerName, farmerMobile||req.user.mobile,
       village, taluk, district||'Gadag', pincode||'', landmark||'',
       pickupTime||'Morning 8AM–11AM', locationLat||null, locationLng||null, estTotal]
    );
    const listingId = lr.insertId;

    // Insert items
    for (const item of items) {
      await conn.execute(
        `INSERT INTO farmer_listing_items
          (listing_id, product_id, product_name, estimated_qty_kg, price_per_kg, estimated_amount)
         VALUES (?,?,?,?,?,?)`,
        [listingId, item.productId, item.productName,
         item.estimatedQtyKg, item.pricePerKg, item.estimatedAmount]
      );
    }

    // Notify admin
    await conn.execute(
      `INSERT INTO notifications (target_role,type,title,body,reference_id)
       VALUES ('admin','new_farmer_listing',?,?,?)`,
      [`New Farmer Listing: ${listingNum}`,
       `${farmerName} from ${village} — Est. ₹${estTotal.toLocaleString('en-IN')} — ${items.length} item(s)`,
       listingId]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Listing submitted! Our agent will contact you within 2 hours.',
      data: {
        listingId,
        listingNumber: listingNum,
        estimatedTotal: estTotal,
        status: 'pending',
        items: items.length,
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('farmer listing error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Submission failed. Try again.' });
  } finally { conn.release(); }
});

// ── GET /farmer/listings — Farmer's own listings ──────────────────
router.get('/listings', protect, async (req, res) => {
  try {
    const [listings] = await pool.execute(
      `SELECT fl.*,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT(
           'name', fli.product_name,
           'estimatedQty', fli.estimated_qty_kg,
           'actualQty', fli.actual_qty_kg,
           'pricePerKg', fli.price_per_kg,
           'estimatedAmt', fli.estimated_amount,
           'actualAmt', fli.actual_amount
         )) FROM farmer_listing_items fli WHERE fli.listing_id = fl.id) AS items
       FROM farmer_listings fl
       WHERE fl.user_id = ?
       ORDER BY fl.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: listings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /farmer/listings/:id — Single listing detail ─────────────
router.get('/listings/:id', protect, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM farmer_listings WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success:false, message:'Listing not found' });
    const [items] = await pool.execute(
      'SELECT * FROM farmer_listing_items WHERE listing_id=?', [req.params.id]
    );
    res.json({ success: true, data: { ...rows[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
