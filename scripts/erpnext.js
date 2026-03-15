#!/usr/bin/env node
/**
 * RIFAH Connect — ERPNext API Utility
 *
 * Usage as CLI:
 *   node scripts/erpnext.js get-session 919000000001
 *   node scripts/erpnext.js get-member 919000000001
 *   node scripts/erpnext.js list-sessions
 *   node scripts/erpnext.js list-members
 *   node scripts/erpnext.js delete-session 919000000001
 *   node scripts/erpnext.js delete-member 919000000001
 *   node scripts/erpnext.js clean 919000000001        # deletes both session + member
 *   node scripts/erpnext.js clean-test-phones         # cleans all 5 test phones
 *   node scripts/erpnext.js whoami
 *
 * Usage as module:
 *   const erp = require('./scripts/erpnext')
 *   const session = await erp.getSession('919000000001')
 *   const member  = await erp.getMember('919000000001')
 *   await erp.cleanPhone('919000000001')
 */

const http  = require('http');
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE    = process.env.ERPNEXT_URL         || 'http://localhost:8080';
const API_KEY = process.env.ERPNEXT_API_KEY     || '';
const API_SEC = process.env.ERPNEXT_API_SECRET  || '';
const SITE    = process.env.ERPNEXT_SITE        || 'rifah.localhost';

const HEADERS = {
  'Authorization': `token ${API_KEY}:${API_SEC}`,
  'Content-Type': 'application/json',
  'Host': SITE,
};

const TEST_PHONES = {
  free:     '919000000001',
  premium:  '919000000002',
  existing: '919000000003',
  edge:     '919000000004',
  product:  '919000000005',
};

// ── Core request ──────────────────────────────────────────────────────────────
function request(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const data   = body ? JSON.stringify(body) : null;

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + (parsed.search || ''),
      method,
      headers: { ...HEADERS, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

function enc(v) { return encodeURIComponent(JSON.stringify(v)); }

// ── Sessions ──────────────────────────────────────────────────────────────────
async function getSession(phone) {
  const fields  = enc(['name', 'phone_number', 'current_step', 'status', 'session_data']);
  const filters = enc([['phone_number', '=', phone]]);
  const r = await request(`${BASE}/api/resource/RIFAH Session?filters=${filters}&fields=${fields}`);
  return r.body?.data?.[0] || null;
}

async function getSessionDetail(name) {
  const r = await request(`${BASE}/api/resource/RIFAH Session/${name}`);
  return r.body?.data || null;
}

async function listSessions(limit = 20) {
  const fields = enc(['name', 'phone_number', 'current_step', 'status']);
  const r = await request(`${BASE}/api/resource/RIFAH Session?limit=${limit}&fields=${fields}`);
  return r.body?.data || [];
}

async function deleteSession(phone) {
  const s = await getSession(phone);
  if (!s) return null;
  return request(`${BASE}/api/resource/RIFAH Session/${s.name}`, 'DELETE');
}

// ── Members ───────────────────────────────────────────────────────────────────
async function getMember(phone) {
  const fields  = enc(['name', 'rifah_id', 'full_name', 'whatsapp_number', 'membership_tier', 'status', 'rifahmart_url', 'dashboard_password']);
  const filters = enc([['whatsapp_number', '=', phone]]);
  const r = await request(`${BASE}/api/resource/RIFAH Member?filters=${filters}&fields=${fields}`);
  return r.body?.data?.[0] || null;
}

async function getMemberDetail(name) {
  const r = await request(`${BASE}/api/resource/RIFAH Member/${name}`);
  return r.body?.data || null;
}

async function listMembers(limit = 20) {
  const fields = enc(['name', 'rifah_id', 'full_name', 'whatsapp_number', 'membership_tier', 'status']);
  const r = await request(`${BASE}/api/resource/RIFAH Member?limit=${limit}&fields=${fields}`);
  return r.body?.data || [];
}

async function createMember(data) {
  return request(`${BASE}/api/resource/RIFAH Member`, 'POST', { doctype: 'RIFAH Member', ...data });
}

async function deleteMember(phone) {
  const m = await getMember(phone);
  if (!m) return null;
  return request(`${BASE}/api/resource/RIFAH Member/${m.name}`, 'DELETE');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function cleanPhone(phone) {
  await deleteSession(phone);
  await deleteMember(phone);
}

async function cleanTestPhones() {
  for (const [name, phone] of Object.entries(TEST_PHONES)) {
    await cleanPhone(phone);
    console.log(`  cleaned: ${name} (${phone})`);
  }
}

async function whoami() {
  const r = await request(`${BASE}/api/method/frappe.auth.get_logged_user`);
  return r.body?.message || null;
}

module.exports = {
  getSession, getSessionDetail, listSessions, deleteSession,
  getMember, getMemberDetail, listMembers, createMember, deleteMember,
  cleanPhone, cleanTestPhones, whoami,
  TEST_PHONES, HEADERS, BASE,
};

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);

  (async () => {
    switch (cmd) {
      case 'whoami': {
        const user = await whoami();
        console.log('Logged in as:', user);
        break;
      }
      case 'get-session': {
        const s = await getSession(arg);
        s ? console.log(JSON.stringify(s, null, 2)) : console.log('Not found');
        break;
      }
      case 'get-member': {
        const m = await getMember(arg);
        m ? console.log(JSON.stringify(m, null, 2)) : console.log('Not found');
        break;
      }
      case 'list-sessions': {
        const list = await listSessions();
        list.forEach(s => console.log(`${s.phone_number} | ${s.current_step} | ${s.status}`));
        break;
      }
      case 'list-members': {
        const list = await listMembers();
        list.forEach(m => console.log(`${m.whatsapp_number} | ${m.rifah_id} | ${m.membership_tier} | ${m.status}`));
        break;
      }
      case 'delete-session': {
        await deleteSession(arg);
        console.log(`Session deleted for ${arg}`);
        break;
      }
      case 'delete-member': {
        await deleteMember(arg);
        console.log(`Member deleted for ${arg}`);
        break;
      }
      case 'clean': {
        await cleanPhone(arg);
        console.log(`Cleaned session + member for ${arg}`);
        break;
      }
      case 'clean-test-phones': {
        console.log('Cleaning all test phones...');
        await cleanTestPhones();
        console.log('Done.');
        break;
      }
      default:
        console.log('Commands: whoami, get-session, get-member, list-sessions, list-members, delete-session, delete-member, clean, clean-test-phones');
    }
  })().catch(e => { console.error(e.message); process.exit(1); });
}
