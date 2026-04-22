// ═══ routes/order.routes.js ══════════════════════════
const express  = require('express');
const { protect } = require('../middleware/auth.middleware');
const { placeOrder, getMyOrders } = require('../controllers/all.controllers');
const r = express.Router();
r.use(protect);
r.post('/', placeOrder);
r.get('/',  getMyOrders);
module.exports = r;

// ═══ routes/user.routes.js — save separately ═════════
// Create file: backend/src/routes/user.routes.js
// Content:
// const express = require('express');
// const { protect } = require('../middleware/auth.middleware');
// const { getProfile, updateProfile, getAddresses, addAddress, deleteAddress } = require('../controllers/all.controllers');
// const r = express.Router();
// r.use(protect);
// r.get('/me', getProfile); r.put('/me', updateProfile);
// r.get('/addresses', getAddresses); r.post('/addresses', addAddress);
// r.delete('/addresses/:id', deleteAddress);
// module.exports = r;
