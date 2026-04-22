// ═══ routes/auth.routes.js ═══════════════════════════
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { sendOTPHandler, verifyOTPHandler } = require('../controllers/all.controllers');
const r1 = express.Router();

const otpLimiter = rateLimit({
  windowMs: 15*60*1000,
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX)||5,
  message: { success:false, message:'Too many OTP requests. Wait 15 minutes and try again.' },
  standardHeaders: true, legacyHeaders: false,
});

r1.post('/send-otp',   otpLimiter, sendOTPHandler);
r1.post('/verify-otp', verifyOTPHandler);

module.exports = r1;
