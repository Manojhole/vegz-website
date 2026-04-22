// ═══════════════════════════════════════════════════════
//  VEGZ — Auth Module (Fixed)
//  Fixes:
//  1. backMobile() alias added (was only backToMobile)
//  2. OTP cell selector supports both .otp-cell AND .ocell
//  3. Auto-focus moves correctly on each digit
//  4. Auto-verify fires correctly when all 6 entered
//  5. No lucide dependency in reset functions
// ═══════════════════════════════════════════════════════

let _mobile = '';
let _resendInterval = null;

// ── Get OTP cells (works for both index.html and shop pages) ──
function _getCells() {
  // index.html uses .ocell, shop pages use .otp-cell
  const cells = document.querySelectorAll('.otp-cell, .ocell');
  return Array.from(cells);
}

// ── Modal open/close ──────────────────────────────────
function openModal(id) {
  const modalId = id || 'login-modal';
  document.getElementById(modalId)?.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('mobile-inp')?.focus(), 300);
}

function closeModal(id) {
  const modalId = id || 'login-modal';
  document.getElementById(modalId)?.classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOutside(e, id) {
  if (e.target.id === (id || 'login-modal')) closeModal(id);
}

// ── Step 1: Send OTP ──────────────────────────────────
async function sendOTP() {
  const inp   = document.getElementById('mobile-inp');
  const errEl = document.getElementById('mobile-err');
  const btn   = document.getElementById('btn-send');
  const pf    = document.getElementById('pwrap') || document.getElementById('phone-field');
  const mob   = (inp?.value || '').replace(/\D/g, '');

  if (errEl) errEl.textContent = '';
  pf?.classList.remove('err');

  if (mob.length !== 10) {
    if (errEl) errEl.textContent = 'Enter a valid 10-digit mobile number.';
    pf?.classList.add('err');
    inp?.focus();
    return;
  }

  _mobile = mob;
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spin"></div><span>Sending…</span>'; }

  try {
    await API.sendOTP(mob);
    const display = document.getElementById('otp-sent-to');
    if (display) display.textContent = `OTP sent to +91 ${mob.slice(0,5)} ${mob.slice(5)}`;
    _switchStep('otp');
    _startResend();
    // Focus first OTP cell after a short delay
    setTimeout(() => { const c = _getCells(); c[0]?.focus(); }, 150);
    toast('OTP sent! Check your phone.', 'success');
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Failed to send OTP. Try again.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>Send OTP</span> <span>→</span>'; }
  }
}

// ── OTP input handler ─────────────────────────────────
function otpIn(el, idx) {
  // Keep only last digit, strip non-digits
  const v = el.value.replace(/\D/g, '');
  el.value = v ? v.slice(-1) : '';

  // Clear any error
  const errEl = document.getElementById('otp-err');
  if (errEl) errEl.textContent = '';

  if (el.value) {
    el.classList.add('ok');
    el.classList.remove('err');

    // Move focus to next cell
    const cells = _getCells();
    if (idx < cells.length - 1) {
      cells[idx + 1].focus();
    }

    // Auto-verify when all cells are filled
    const filled = cells.map(c => c.value).join('');
    if (filled.length === cells.length && cells.length === 6) {
      // Small delay so the last cell value is committed
      setTimeout(() => verifyOTP(), 100);
    }
  } else {
    el.classList.remove('ok');
  }
}

// ── OTP keydown handler ───────────────────────────────
function otpKey(el, idx, e) {
  const cells = _getCells();
  if (e.key === 'Backspace') {
    if (el.value) {
      el.value = '';
      el.classList.remove('ok', 'err');
    } else if (idx > 0) {
      // Move back to previous cell
      cells[idx - 1].focus();
      cells[idx - 1].value = '';
      cells[idx - 1].classList.remove('ok', 'err');
    }
    e.preventDefault();
  }
  if (e.key === 'ArrowLeft' && idx > 0) cells[idx - 1].focus();
  if (e.key === 'ArrowRight' && idx < cells.length - 1) cells[idx + 1].focus();
}

// ── Also handle paste on first OTP cell ──────────────
function otpPaste(e) {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
  if (!pasted) return;
  const cells = _getCells();
  pasted.split('').slice(0, 6).forEach((d, i) => {
    if (cells[i]) { cells[i].value = d; cells[i].classList.add('ok'); }
  });
  const last = Math.min(pasted.length, 6) - 1;
  cells[last]?.focus();
  const filled = cells.map(c => c.value).join('');
  if (filled.length === 6) setTimeout(() => verifyOTP(), 100);
}

// ── Step 2: Verify OTP ───────────────────────────────
async function verifyOTP() {
  const cells = _getCells();
  const otp   = cells.map(c => c.value).join('');
  const errEl = document.getElementById('otp-err');
  const btn   = document.getElementById('btn-verify');

  if (errEl) errEl.textContent = '';

  // Guard: don't proceed if not all 6 filled
  if (otp.length < 6 || cells.some(c => !c.value)) {
    if (errEl) errEl.textContent = 'Please enter all 6 digits.';
    return;
  }

  // Guard: don't double-submit
  if (btn?.disabled) return;

  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spin"></div><span>Verifying…</span>'; }

  try {
    const res = await API.verifyOTP(_mobile, otp);
    localStorage.setItem('vegz_token', res.token);
    localStorage.setItem('vegz_user', JSON.stringify(res.user));
    toast('Login successful! 🎉', 'success');

    // Close modal
    document.querySelectorAll('.mbg.open, .modal-backdrop.open').forEach(m => {
      m.classList.remove('open');
    });
    document.body.style.overflow = '';

    // Redirect to shop
    setTimeout(() => {
      // If on root (index.html), go to pages/shop.html
      // If already in pages/, go to shop.html
      const isRoot = !window.location.pathname.includes('/pages/');
      window.location.href = isRoot ? 'pages/shop.html' : 'shop.html';
    }, 500);

  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Incorrect OTP. Try again.';
    cells.forEach(c => c.classList.add('err'));
    setTimeout(() => {
      cells.forEach(c => { c.value = ''; c.classList.remove('err', 'ok'); });
      cells[0]?.focus();
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>Verify &amp; Login</span> <span>✓</span>'; }
    }, 800);
  }
}

// ── Resend OTP ───────────────────────────────────────
function _startResend() {
  let secs = 30;
  clearInterval(_resendInterval);
  const info   = document.getElementById('resend-info');
  const btn    = document.getElementById('resend-btn');
  const timerEl= document.getElementById('resend-timer');
  if (info) info.style.display = '';
  if (btn)  btn.style.display  = 'none';

  _resendInterval = setInterval(() => {
    secs--;
    if (timerEl) timerEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(_resendInterval);
      if (info) info.style.display = 'none';
      if (btn)  btn.style.display  = '';
    }
  }, 1000);
}

async function resendOTP() {
  try {
    await API.sendOTP(_mobile);
    _getCells().forEach(c => { c.value = ''; c.classList.remove('ok', 'err'); });
    _getCells()[0]?.focus();
    _startResend();
    toast('OTP resent!', 'success');
  } catch { toast('Could not resend. Try again.', 'error'); }
}

// ── Step switch ──────────────────────────────────────
function _switchStep(step) {
  const mobile = document.getElementById('step-mobile');
  const otp    = document.getElementById('step-otp');
  if (mobile) mobile.style.display = step === 'mobile' ? '' : 'none';
  if (otp)    otp.style.display    = step === 'otp'    ? '' : 'none';
}

// backMobile and backToMobile are the SAME function — both names work
function backMobile() {
  clearInterval(_resendInterval);
  _switchStep('mobile');

  const otpErr    = document.getElementById('otp-err');
  const mobileErr = document.getElementById('mobile-err');
  if (otpErr)    otpErr.textContent    = '';
  if (mobileErr) mobileErr.textContent = '';

  // Reset OTP cells
  _getCells().forEach(c => { c.value = ''; c.classList.remove('ok', 'err'); });

  // Reset send button
  const btn = document.getElementById('btn-send');
  if (btn) { btn.disabled = false; btn.innerHTML = '<span>Send OTP</span> <span>→</span>'; }

  // Focus mobile input
  setTimeout(() => document.getElementById('mobile-inp')?.focus(), 100);
}

// Alias — both names work regardless of which HTML uses which
const backToMobile = backMobile;

// ── Session helpers ──────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem('vegz_user') || 'null'); } catch { return null; }
}

function requireAuth(redirectTo) {
  if (!localStorage.getItem('vegz_token')) {
    // Auto-detect correct path
    const isPages = window.location.pathname.includes('/pages/');
    window.location.href = redirectTo || (isPages ? '../index.html' : 'index.html');
    return false;
  }
  return true;
}

function logout() {
  if (!confirm('Logout from Vegz?')) return;
  localStorage.removeItem('vegz_token');
  localStorage.removeItem('vegz_user');
  const isPages = window.location.pathname.includes('/pages/');
  window.location.href = isPages ? '../index.html' : 'index.html';
}

// ── Toast notifications ──────────────────────────────
function toast(msg, type = 'info') {
  let wrap = document.getElementById('toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toasts';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s, transform .3s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ── Escape closes any open modal ─────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.mbg.open, .modal-backdrop.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});
