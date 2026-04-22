// ═══ routes/product.routes.js ═══════════════════════
const express = require('express');
const { getAllProducts, getCategories } = require('../controllers/all.controllers');
const r = express.Router();
r.get('/', getAllProducts);
r.get('/categories', getCategories);
module.exports = r;
