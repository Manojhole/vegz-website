// ═══════════════════════════════════════════════
//  VEGZ — Configuration
//  Production API: api.vegz.online
// ═══════════════════════════════════════════════

window.VEGZ_CONFIG = {
  // Production API on EC2 Server 1 (with Nginx reverse proxy)
  // Development: http://localhost:5001
API_BASE: (() => {
  const h = window.location.hostname;

  if (h === 'vegz.online' || h === 'www.vegz.online') {
    return 'https://api.vegz.online';
  }

  // Allow EC2 testing also
  if (h.includes('compute.amazonaws.com')) {
    return 'http://localhost:5001';
  }

  return 'http://localhost:5001';
})(),
};
