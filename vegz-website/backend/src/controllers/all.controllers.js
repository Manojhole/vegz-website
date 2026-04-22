// ═══ controllers/auth.controller.js ══════════════════
const jwt    = require('jsonwebtoken');
const { pool } = require('../config/database');
const { sendOTP, verifyOTP } = require('../services/otp.service');

function normMobile(m) {
  const d = m.replace(/\D/g,'');
  if (d.length===10) return `+91${d}`;
  if (d.length===12 && d.startsWith('91')) return `+${d}`;
  return `+${d}`;
}

function sign(userId) {
  return jwt.sign({ id:userId, type:'user' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN||'30d' });
}

async function sendOTPHandler(req, res) {
  try {
    const mob = normMobile(req.body.mobile||'');
    if (mob.length < 13) return res.status(400).json({ success:false, message:'Valid mobile number required' });
    await sendOTP(mob, 'login');
    res.json({ success:true, message:'OTP sent successfully', mobile:mob,
      ...(process.env.OTP_DEV_MODE==='true' && { _dev:'Check server console for OTP' }) });
  } catch (err) {
    console.error('sendOTP:', err.message);
    res.status(500).json({ success:false, message: err.message || 'Failed to send OTP' });
  }
}

async function verifyOTPHandler(req, res) {
  try {
    const mob = normMobile(req.body.mobile||'');
    const otp = String(req.body.otp||'');
    if (!mob||!otp) return res.status(400).json({ success:false, message:'Mobile and OTP required' });

    const result = await verifyOTP(mob, otp, 'login');
    if (!result.valid) return res.status(400).json({ success:false, message:result.reason, attemptsLeft:result.attemptsLeft });

    let [rows] = await pool.execute('SELECT * FROM users WHERE mobile=? LIMIT 1', [mob]);
    let isNew = false;
    if (!rows.length) {
      const [ir] = await pool.execute('INSERT INTO users (mobile, is_verified) VALUES (?,1)', [mob]);
      [rows] = await pool.execute('SELECT * FROM users WHERE id=?', [ir.insertId]);
      isNew = true;
    } else {
      await pool.execute('UPDATE users SET is_verified=1 WHERE id=?', [rows[0].id]);
    }
    const user = rows[0];
    res.json({ success:true, message: isNew?'Account created':'Login successful', isNewUser:isNew,
      token: sign(user.id),
      user: { id:user.id, mobile:user.mobile, name:user.name, businessName:user.business_name, businessType:user.business_type }
    });
  } catch (err) {
    console.error('verifyOTP:', err.message);
    res.status(500).json({ success:false, message:'Verification failed' });
  }
}

module.exports = { sendOTPHandler, verifyOTPHandler };

// ═══ controllers/product.controller.js ══════════════
const { pool: db } = require('../config/database');

async function getAllProducts(req, res) {
  try {
    const { category_id } = req.query;
    let q = `SELECT p.id,p.name,p.name_kannada,p.description,p.image_url,p.unit,p.sort_order,
      c.id AS categoryId,c.name AS categoryName,c.name_kannada AS categoryNameKannada,
      sl.is_available
      FROM products p
      JOIN categories c ON c.id=p.category_id
      LEFT JOIN stock_levels sl ON sl.product_id=p.id
      WHERE p.is_active=1 AND c.is_active=1`;
    const params = [];
    if (category_id) { q += ' AND p.category_id=?'; params.push(category_id); }
    q += ' ORDER BY c.sort_order,p.sort_order';

    const [prods] = await db.execute(q, params);
    if (!prods.length) return res.json({ success:true, data:[], total:0 });

    const ids = prods.map(p=>p.id);
    const ph  = ids.map(()=>'?').join(',');
    const [opts] = await db.execute(
      `SELECT * FROM product_quantity_options WHERE product_id IN (${ph}) AND is_active=1 ORDER BY product_id,sort_order`, ids);

    const optMap = {};
    opts.forEach(o => {
      if (!optMap[o.product_id]) optMap[o.product_id]=[];
      optMap[o.product_id].push({ id:o.id, label:o.label, quantityKg:parseFloat(o.quantity_kg), price:parseFloat(o.price) });
    });

    const data = prods.map(p => ({
      id:p.id, name:p.name, nameKannada:p.name_kannada, description:p.description,
      imageUrl:p.image_url, unit:p.unit, categoryId:p.categoryId,
      categoryName:p.categoryName, isAvailable:p.is_available===1,
      quantityOptions: optMap[p.id]||[],
    }));
    res.json({ success:true, data, total:data.length });
  } catch (err) { res.status(500).json({ success:false, message:'Failed to fetch products' }); }
}

async function getCategories(req, res) {
  try {
    const [rows] = await db.execute('SELECT id,name,name_kannada,image_url,sort_order FROM categories WHERE is_active=1 ORDER BY sort_order');
    res.json({ success:true, data:rows });
  } catch { res.status(500).json({ success:false, message:'Failed to fetch categories' }); }
}

// ═══ controllers/order.controller.js ════════════════
async function placeOrder(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const userId = req.user.id;
    const { items, addressId, deliveryTime, deliveryNotes, paymentMethod, locationLat, locationLng } = req.body;
    if (!items?.length) { await conn.rollback(); return res.status(400).json({ success:false, message:'Cart is empty' }); }

    const [addrRows] = await conn.execute('SELECT * FROM user_addresses WHERE id=? AND user_id=?', [addressId, userId]);
    if (!addrRows.length) { await conn.rollback(); return res.status(400).json({ success:false, message:'Invalid address' }); }

    let subtotal = 0;
    const validated = [];
    for (const item of items) {
      const [r] = await conn.execute(
        `SELECT p.id,p.name,pqo.id AS opt_id,pqo.label,pqo.quantity_kg,pqo.price,sl.is_available
         FROM products p JOIN product_quantity_options pqo ON pqo.id=? AND pqo.product_id=p.id
         LEFT JOIN stock_levels sl ON sl.product_id=p.id WHERE p.id=? AND p.is_active=1`,
        [item.quantityOptionId, item.productId]);
      if (!r.length) { await conn.rollback(); return res.status(400).json({ success:false, message:`Product ${item.productId} not found` }); }
      const p = r[0];
      if (!p.is_available) { await conn.rollback(); return res.status(400).json({ success:false, message:`${p.name} is out of stock` }); }
      const qty = parseInt(item.quantity)||1;
      const total = parseFloat(p.price)*qty;
      subtotal += total;
      validated.push({ productId:p.id, productName:p.name, quantityOptionId:p.opt_id, quantityLabel:p.label, quantityKg:parseFloat(p.quantity_kg)*qty, unitPrice:p.price, totalPrice:total });
    }

    const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const prefix = process.env.ORDER_PREFIX||'VGZ';
    const [cnt] = await conn.execute('SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE ?', [`${prefix}-${date}%`]);
    const orderNum = `${prefix}-${date}-${String((cnt[0].c||0)+1).padStart(4,'0')}`;

    const [or] = await conn.execute(
      `INSERT INTO orders (order_number,user_id,address_id,delivery_time,delivery_notes,subtotal,delivery_charge,total_amount,payment_method,status)
       VALUES (?,?,?,?,?,?,0,?,?,'placed')`,
      [orderNum, userId, addressId, deliveryTime||null, deliveryNotes||null, subtotal, subtotal, paymentMethod||'cod']);

    const orderId = or.insertId;
    for (const i of validated) {
      await conn.execute(
        'INSERT INTO order_items (order_id,product_id,quantity_option_id,product_name,quantity_label,quantity_kg,unit_price,total_price) VALUES (?,?,?,?,?,?,?,?)',
        [orderId, i.productId, i.quantityOptionId, i.productName, i.quantityLabel, i.quantityKg, i.unitPrice, i.totalPrice]);
    }

    await conn.execute(
      'INSERT INTO order_status_history (order_id,to_status,changed_by,note) VALUES (?,"placed",?,"Order placed via website")',
      [orderId, `user:${userId}`]);
    await conn.execute(
      'INSERT INTO notifications (target_role,type,title,body,reference_id) VALUES ("admin","new_order",?,?,?)',
      [`New Order: ${orderNum}`, `₹${subtotal.toFixed(0)} · ${validated.length} items · ${paymentMethod?.toUpperCase()} · ${addrRows[0].city}`, orderId]);

    await conn.commit();
    res.status(201).json({ success:true, message:'Order placed!', data:{ orderId, orderNumber:orderNum, totalAmount:subtotal, paymentMethod, status:'placed' }});
  } catch (err) {
    await conn.rollback();
    console.error('placeOrder:', err.message);
    res.status(500).json({ success:false, message:'Order failed. Try again.' });
  } finally { conn.release(); }
}

async function getMyOrders(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT o.id,o.order_number,o.status,o.total_amount,o.payment_method,o.payment_status,
       o.delivery_time,o.created_at,a.address_line1,a.city
       FROM orders o JOIN user_addresses a ON a.id=o.address_id
       WHERE o.user_id=? ORDER BY o.created_at DESC`, [req.user.id]);
    res.json({ success:true, data:rows });
  } catch { res.status(500).json({ success:false, message:'Failed to fetch orders' }); }
}

// ═══ controllers/user.controller.js ═════════════════
async function getProfile(req, res) {
  try {
    const [r] = await db.execute('SELECT id,mobile,name,business_name,business_type,email,is_verified FROM users WHERE id=?', [req.user.id]);
    res.json({ success:true, data:r[0] });
  } catch { res.status(500).json({ success:false, message:'Failed' }); }
}

async function updateProfile(req, res) {
  try {
    const { name, businessName, businessType, email } = req.body;
    await db.execute('UPDATE users SET name=?,business_name=?,business_type=?,email=? WHERE id=?', [name, businessName, businessType, email, req.user.id]);
    res.json({ success:true, message:'Profile updated' });
  } catch { res.status(500).json({ success:false, message:'Failed' }); }
}

async function getAddresses(req, res) {
  try {
    const [r] = await db.execute('SELECT * FROM user_addresses WHERE user_id=? ORDER BY is_default DESC,id DESC', [req.user.id]);
    res.json({ success:true, data:r });
  } catch { res.status(500).json({ success:false, message:'Failed' }); }
}

async function addAddress(req, res) {
  try {
    const { label, contactName, contactPhone, addressLine1, addressLine2, city, district, pincode, isDefault } = req.body;
    if (isDefault) await db.execute('UPDATE user_addresses SET is_default=0 WHERE user_id=?', [req.user.id]);
    const [r] = await db.execute(
      'INSERT INTO user_addresses (user_id,label,contact_name,contact_phone,address_line1,address_line2,city,district,pincode,is_default) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, label||'Delivery', contactName, contactPhone, addressLine1, addressLine2||null, city, district||'Gadag', pincode||'', isDefault?1:0]);
    res.status(201).json({ success:true, message:'Address added', id:r.insertId });
  } catch { res.status(500).json({ success:false, message:'Failed to add address' }); }
}

async function deleteAddress(req, res) {
  try {
    await db.execute('DELETE FROM user_addresses WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success:true, message:'Address removed' });
  } catch { res.status(500).json({ success:false, message:'Failed' }); }
}

module.exports = {
  sendOTPHandler, verifyOTPHandler,
  getAllProducts, getCategories,
  placeOrder, getMyOrders,
  getProfile, updateProfile, getAddresses, addAddress, deleteAddress,
};
