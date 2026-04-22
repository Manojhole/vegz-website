// ═══════════════════════════════════════════════
//  VEGZ — API Client
//  All HTTP calls to api.vegz.online
// ═══════════════════════════════════════════════

const API = {
  get base() { return window.VEGZ_CONFIG.API_BASE; },
  get token() { return localStorage.getItem('vegz_token'); },

  headers(auth = true) {
    const h = { 'Content-Type': 'application/json' };
    if (auth && this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  async req(method, path, body = null, auth = true) {
    const opts = { method, headers: this.headers(auth) };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${this.base}/api/v1${path}`, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      return data;
    } catch (e) {
      if (e.message.startsWith('Failed to fetch')) {
        throw new Error('Cannot reach server. Check your internet connection.');
      }
      throw e;
    }
  },

  // Auth
  sendOTP(mobile)       { return this.req('POST', '/auth/send-otp',   { mobile }, false); },
  verifyOTP(mobile, otp){ return this.req('POST', '/auth/verify-otp', { mobile, otp }, false); },

  // Products
  getProducts(catId)    { return this.req('GET', catId ? `/products?category_id=${catId}` : '/products'); },
  getCategories()       { return this.req('GET', '/products/categories'); },

  // Orders
  placeOrder(data)      { return this.req('POST', '/orders', data); },
  getOrders()           { return this.req('GET',  '/orders'); },
  getOrder(id)          { return this.req('GET',  `/orders/${id}`); },

  // User
  getProfile()          { return this.req('GET',  '/users/me'); },
  updateProfile(d)      { return this.req('PUT',  '/users/me', d); },
  getAddresses()        { return this.req('GET',  '/users/addresses'); },
  addAddress(d)         { return this.req('POST', '/users/addresses', d); },
  deleteAddress(id)     { return this.req('DELETE', `/users/addresses/${id}`); },
};

window.API = API;
