// ═══ services/otp.service.js ══════════════════════════
const bcrypt   = require('bcryptjs');
const { pool } = require('../config/database');

function genOTP(len = 6) {
  const min = Math.pow(10, len - 1);
  return String(Math.floor(min + Math.random() * (9 * min)));
}

// ── MSG91 (Indian SMS — cheapest option) ──────────────
async function sendMSG91(mobile, otp) {
  const https = require('https');
  const data = JSON.stringify({
    template_id: process.env.MSG91_TEMPLATE_ID,
    mobile:      mobile.replace('+', ''),
    authkey:     process.env.MSG91_AUTH_KEY,
    otp,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'control.msg91.com',
      path:     '/api/v5/otp',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const r = JSON.parse(body);
        if (r.type === 'success') resolve(r);
        else reject(new Error(r.message || 'MSG91 failed'));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Twilio (fallback) ─────────────────────────────────
async function sendTwilio(mobile, otp) {
  const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await twilio.messages.create({
    body: `Your Vegz OTP is ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share. — Vegz Private Limited`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   mobile,
  });
}

// ── Main sendOTP ──────────────────────────────────────
async function sendOTP(mobile, purpose = 'login') {
  const otp    = process.env.OTP_DEV_MODE === 'true'
                   ? (process.env.OTP_DEV_FIXED || '123456')
                   : genOTP(6);
  const hash   = await bcrypt.hash(otp, 10);
  const expiry = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60000);

  // Invalidate old OTPs
  await pool.execute('UPDATE otp_sessions SET is_used=1 WHERE mobile=? AND is_used=0', [mobile]);
  await pool.execute(
    'INSERT INTO otp_sessions (mobile, otp_hash, purpose, expires_at) VALUES (?,?,?,?)',
    [mobile, hash, purpose, expiry]
  );

  if (process.env.OTP_DEV_MODE === 'true') {
    console.log(`\n📱  DEV OTP for ${mobile}: ${otp}\n`);
  } else if (process.env.MSG91_AUTH_KEY) {
    await sendMSG91(mobile, otp);
  } else if (process.env.TWILIO_ACCOUNT_SID) {
    await sendTwilio(mobile, otp);
  } else {
    throw new Error('No SMS provider configured. Set MSG91_AUTH_KEY or TWILIO_ACCOUNT_SID in .env');
  }
  return { sent: true };
}

// ── Verify OTP ────────────────────────────────────────
async function verifyOTP(mobile, enteredOtp, purpose = 'login') {
  const max = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
  const [rows] = await pool.execute(
    'SELECT * FROM otp_sessions WHERE mobile=? AND purpose=? AND is_used=0 AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1',
    [mobile, purpose]
  );
  if (!rows.length) return { valid: false, reason: 'OTP expired or not found. Request a new one.' };

  const session = rows[0];
  if (session.attempts >= max) return { valid: false, reason: 'Too many attempts. Request a new OTP.' };

  await pool.execute('UPDATE otp_sessions SET attempts=attempts+1 WHERE id=?', [session.id]);
  const match = await bcrypt.compare(enteredOtp, session.otp_hash);

  if (!match) {
    const left = max - (session.attempts + 1);
    return { valid: false, reason: 'Incorrect OTP.', attemptsLeft: left };
  }

  await pool.execute('UPDATE otp_sessions SET is_used=1 WHERE id=?', [session.id]);
  return { valid: true };
}

module.exports = { sendOTP, verifyOTP };
