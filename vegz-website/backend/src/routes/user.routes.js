// ═══ routes/user.routes.js ═══════════════════════════
const express  = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getProfile, updateProfile, getAddresses, addAddress, deleteAddress } = require('../controllers/all.controllers');
const r = express.Router();
r.use(protect);
r.get('/me',             getProfile);
r.put('/me',             updateProfile);
r.get('/addresses',      getAddresses);
r.post('/addresses',     addAddress);
r.delete('/addresses/:id', deleteAddress);
module.exports = r;
