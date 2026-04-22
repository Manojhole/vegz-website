// ════════════════════════════════════════════════
//  VEGZ — One-time credential setup script
//  
//  HOW TO RUN (on your Mac, in the backend folder):
//    1. Open terminal in vegz-website/backend/
//    2. node setup-credentials.js
//
//  This fixes admin AND agent login in one shot.
// ════════════════════════════════════════════════
const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');

// ── EDIT THESE 4 LINES ────────────────────────
const DB_HOST     = 'localhost';      // 'localhost' for local, Server2 IP for EC2
const DB_PASSWORD = 'vegz123';        // your MySQL vegz_user password
const YOUR_MOBILE = '+919008015017';  // YOUR mobile number (with +91)
const YOUR_NAME   = 'Manoj';          // your name
// ─────────────────────────────────────────────

const ADMIN_PASSWORD = 'Vegz@Admin2025';
const AGENT_PASSWORD = 'Agent@123';

async function run() {
  console.log('\n🌿 VEGZ Credential Setup Script\n' + '─'.repeat(40));

  // 1. Generate hashes
  console.log('\n⏳ Generating bcrypt hashes (takes ~3 seconds)...');
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const agentHash = await bcrypt.hash(AGENT_PASSWORD, 12);

  // 2. Verify hashes are correct
  const adminOk = await bcrypt.compare(ADMIN_PASSWORD, adminHash);
  const agentOk = await bcrypt.compare(AGENT_PASSWORD, agentHash);
  if (!adminOk || !agentOk) {
    console.error('❌ Hash verification failed — do not proceed');
    process.exit(1);
  }
  console.log('✅ Hashes generated and verified');

  // 3. Connect to DB
  console.log('\n⏳ Connecting to MySQL...');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: DB_HOST, user: 'vegz_user',
      password: DB_PASSWORD, database: 'vegz_db',
    });
  } catch (e) {
    console.error('❌ MySQL connection failed:', e.message);
    console.error('\nCheck that:');
    console.error('  1. MySQL is running: brew services start mysql');
    console.error('  2. DB_PASSWORD is correct in this file');
    console.error('  3. vegz_db database exists');
    process.exit(1);
  }
  console.log('✅ Connected to MySQL');

  // 4. Fix admin_users table
  await conn.execute('DELETE FROM admin_users WHERE email = ?', ['admin@vegz.online']);
  await conn.execute(
    'INSERT INTO admin_users (name, email, mobile, password_hash, role, is_active) VALUES (?,?,?,?,?,1)',
    ['Vegz Admin', 'admin@vegz.online', YOUR_MOBILE, adminHash, 'super_admin']
  );
  console.log('✅ Admin credentials fixed');

  // 5. Fix agents table — ensure table exists first
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name          VARCHAR(120) NOT NULL,
        mobile        VARCHAR(15)  NOT NULL UNIQUE,
        email         VARCHAR(200) NULL,
        password_hash VARCHAR(255) NOT NULL,
        vehicle_type  ENUM('bike','auto','mini_truck','cycle') DEFAULT 'bike',
        zone          VARCHAR(100) NULL,
        is_active     TINYINT(1)   NOT NULL DEFAULT 1,
        is_available  TINYINT(1)   NOT NULL DEFAULT 1,
        current_lat   DECIMAL(10,7) NULL,
        current_lng   DECIMAL(10,7) NULL,
        last_location_at TIMESTAMP NULL,
        rating        DECIMAL(3,2) NOT NULL DEFAULT 5.00,
        total_deliveries INT UNSIGNED NOT NULL DEFAULT 0,
        today_deliveries INT UNSIGNED NOT NULL DEFAULT 0,
        today_earnings   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch(e) { /* table already exists */ }

  // Remove placeholder agents
  await conn.execute(
    "DELETE FROM agents WHERE mobile IN ('+919876000001','+919876000002','+919876000003')"
  ).catch(() => {});

  // Upsert your agent
  const [existing] = await conn.execute('SELECT id FROM agents WHERE mobile=?', [YOUR_MOBILE]);
  if (existing.length) {
    await conn.execute('UPDATE agents SET password_hash=?,name=?,is_active=1 WHERE mobile=?',
      [agentHash, YOUR_NAME, YOUR_MOBILE]);
    console.log('✅ Agent credentials updated (existing record)');
  } else {
    await conn.execute(
      'INSERT INTO agents (name,mobile,password_hash,vehicle_type,zone,is_active) VALUES (?,?,?,?,?,1)',
      [YOUR_NAME, YOUR_MOBILE, agentHash, 'bike', 'Mundargi']
    );
    console.log('✅ Agent created');
  }

  // 6. Verify by re-reading from DB and comparing
  console.log('\n⏳ Verifying login will work...');
  const [[adminRow]] = await conn.execute('SELECT password_hash FROM admin_users WHERE email=?', ['admin@vegz.online']);
  const [[agentRow]] = await conn.execute('SELECT password_hash FROM agents WHERE mobile=?', [YOUR_MOBILE]);

  const adminVerify = await bcrypt.compare(ADMIN_PASSWORD, adminRow.password_hash);
  const agentVerify = await bcrypt.compare(AGENT_PASSWORD, agentRow.password_hash);

  await conn.end();

  if (!adminVerify || !agentVerify) {
    console.error('❌ Post-insert verification failed. Something went wrong.');
    process.exit(1);
  }

  // 7. Print results
  console.log('\n' + '═'.repeat(45));
  console.log('✅  ALL DONE — Login credentials are set');
  console.log('═'.repeat(45));

  console.log('\n🔑  ADMIN DASHBOARD');
  console.log('    URL:      http://127.0.0.1:5500/frontend/pages/admin.html');
  console.log('    Email:    admin@vegz.online');
  console.log(`    Password: ${ADMIN_PASSWORD}`);

  console.log('\n🚚  AGENT APP');
  console.log('    URL:      http://127.0.0.1:5500/frontend/pages/agent.html');
  console.log(`    Mobile:   ${YOUR_MOBILE.replace('+91', '')}`);
  console.log(`    Password: ${AGENT_PASSWORD}`);

  console.log('\n📌  Next step: restart backend');
  console.log('    npm run dev\n');
}

run().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
