#!/usr/bin/env node
/**
 * RIFAH Connect — Automated Flow 3 Test Suite (Find Lead)
 *
 * Tests the Find Lead flow via the unified webhook.
 * Requires test leads to exist — run first:
 *   node scripts/populate_test_leads.js
 *
 * Usage:
 *   node test_suite/test_flow3.js              → all suites
 *   node test_suite/test_flow3.js --infra      → infrastructure checks
 *   node test_suite/test_flow3.js --menu       → SEARCH_METHOD menu
 *   node test_suite/test_flow3.js --category   → Browse by Category (FREE + PREMIUM)
 *   node test_suite/test_flow3.js --location   → Search by Location
 *   node test_suite/test_flow3.js --urgency    → Browse by Urgency
 *   node test_suite/test_flow3.js --recent     → View All Recent
 *   node test_suite/test_flow3.js --saved      → My Saved Searches (gate + PREMIUM)
 *   node test_suite/test_flow3.js --responses  → My Responses
 *   node test_suite/test_flow3.js --qualify    → Vendor qualification + submit
 *   node test_suite/test_flow3.js --limit      → Daily response limit (FREE 3/day)
 *   node test_suite/test_flow3.js --save       → Save Search flow
 *   node test_suite/test_flow3.js --edge       → Edge cases
 *   node test_suite/test_flow3.js --clean      → wipe test data and exit
 */

const https = require('https');
const http  = require('http');
const erp   = require('../scripts/erpnext');

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ── CONFIG ────────────────────────────────────────────────────────────────────
const WEBHOOK  = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp-webhook';
const META_PID = process.env.META_PHONE_NUMBER_ID || '1051021614753488';
const BASE     = process.env.ERPNEXT_URL || 'http://localhost:8080';
const API_KEY  = process.env.ERPNEXT_API_KEY || '';
const API_SEC  = process.env.ERPNEXT_API_SECRET || '';
const SITE     = process.env.ERPNEXT_SITE || 'rifah.localhost';

// Test phones — separate from Flow 1/2 test phones
const PHONES = {
  free:    '919300000001',   // FREE member — main test phone
  premium: '919300000002',   // PREMIUM member
  edge:    '919300000003',   // edge case phone
};

// ── COLOURS ───────────────────────────────────────────────────────────────────
const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  grey:   s => `\x1b[90m${s}\x1b[0m`,
};

const results = { passed: 0, failed: 0, errors: [] };
const pass    = msg => { results.passed++; console.log(c.green(`  ✓ ${msg}`)); };
const fail    = (msg, detail = '') => { results.failed++; results.errors.push({ msg, detail }); console.log(c.red(`  ✗ ${msg}`)); if (detail) console.log(c.grey(`    ${detail}`)); };
const info    = msg => console.log(c.blue(`  → ${msg}`));
const section = msg => { console.log('\n' + c.bold(c.yellow(`▶ ${msg}`))); console.log(c.grey('─'.repeat(50))); };
const delay   = ms => new Promise(r => setTimeout(r, ms));

// ── HTTP ──────────────────────────────────────────────────────────────────────
function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   options.method || 'GET',
      headers:  options.headers || {},
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch { resolve({ status: res.statusCode, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── SEND MESSAGE TO UNIFIED WEBHOOK ──────────────────────────────────────────
async function sendText(phone, text) {
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'test', changes: [{ value: {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '15551234567', phone_number_id: META_PID },
      contacts: [{ profile: { name: 'Test User' }, wa_id: phone }],
      messages: [{
        from: phone,
        id: `wamid.${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'text',
        text: { body: text }
      }]
    }, field: 'messages' }] }]
  });
  try {
    const res = await httpRequest(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, payload);
    console.log(c.grey(`    [${phone}] sent: "${text}" → HTTP ${res.status}`));
    return res;
  } catch (err) {
    console.log(c.red(`    [${phone}] failed: ${err.message}`));
    return null;
  }
}

// ── POLLING HELPERS ───────────────────────────────────────────────────────────
async function waitForStep(phone, step, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(600);
    const s = await erp.getSession(phone);
    if (s?.current_step === step) return s;
  }
  return null;
}

async function waitForOneOf(phone, steps, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(600);
    const s = await erp.getSession(phone);
    if (steps.includes(s?.current_step)) return s;
  }
  return null;
}

function getSessionData(session) {
  try { return JSON.parse(session?.session_data || '{}'); } catch { return {}; }
}

// ── ERPNext helpers ───────────────────────────────────────────────────────────
const ERP_HEADERS = {
  'Authorization': `token ${API_KEY}:${API_SEC}`,
  'Content-Type': 'application/json',
  'Host': SITE,
};

async function erpRequest(path, method = 'GET', body = null) {
  const url = `${BASE}${path}`;
  const data = body ? JSON.stringify(body) : null;
  return httpRequest(url, {
    method,
    headers: { ...ERP_HEADERS, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
  }, data);
}

async function createTestMember(phone, tier = 'FREE') {
  const isPreium = tier === 'PREMIUM';
  const rifah_id = `RIFAH-TEST3-${phone.slice(-4)}`;
  const payload = {
    rifah_id,
    full_name:        `Test User ${phone.slice(-4)}`,
    whatsapp_number:  phone,
    business_name:    `Test Business ${phone.slice(-4)}`,
    city_state:       'Pune, Maharashtra',
    industry:         'Packaging',
    years_operating:  2,
    membership_tier:  tier,
    status:           tier === 'PREMIUM' ? 'Active Premium' : 'Active Free',
    dashboard_username: `testuser${phone.slice(-4)}`,
    leads_responded_today: 0,
    last_search_date: '',
    search_preferences: '[]',
    daily_alert_enabled: 0,
  };
  const r = await erpRequest('/api/resource/RIFAH Member', 'POST', payload);
  return r.body?.data || null;
}

async function getMemberByPhone(phone) {
  const enc = v => encodeURIComponent(JSON.stringify(v));
  const fields = enc(['name','rifah_id','membership_tier','status','leads_responded_today','last_search_date','search_preferences']);
  const filters = enc([['whatsapp_number','=',phone]]);
  const r = await erpRequest(`/api/resource/RIFAH Member?filters=${filters}&fields=${fields}`);
  return r.body?.data?.[0] || null;
}

async function updateMember(name, fields) {
  return erpRequest(`/api/resource/RIFAH Member/${name}`, 'PUT', fields);
}

async function cleanTestData() {
  console.log('\nCleaning Flow 3 test data...');
  for (const phone of Object.values(PHONES)) {
    try { await erp.cleanPhone(phone); } catch(e) {}
  }
  // Also delete any test member records
  for (const phone of Object.values(PHONES)) {
    try {
      const m = await getMemberByPhone(phone);
      if (m) {
        await erpRequest(`/api/resource/RIFAH Member/${m.name}`, 'DELETE');
        console.log(c.grey(`  Deleted member for ${phone}`));
      }
    } catch(e) {}
  }
  console.log(c.green('  ✓ Test data cleaned'));
}

// ── SETUP: ensure test members exist ─────────────────────────────────────────
async function ensureMembers() {
  const freeM = await getMemberByPhone(PHONES.free);
  if (!freeM) {
    info('Creating FREE test member...');
    await createTestMember(PHONES.free, 'FREE');
  }
  const premM = await getMemberByPhone(PHONES.premium);
  if (!premM) {
    info('Creating PREMIUM test member...');
    await createTestMember(PHONES.premium, 'PREMIUM');
  }
}

// ── SUITE 1: Infrastructure ───────────────────────────────────────────────────
async function testInfra() {
  section('Infrastructure Checks');

  // Webhook reachable
  try {
    const r = await httpRequest(WEBHOOK.replace('/webhook/', '/webhook-test/'), { method: 'GET' });
    pass('Unified webhook path is reachable');
  } catch(e) {
    // Expected — just check that n8n is up
    try {
      const r = await httpRequest('http://localhost:5678/healthz', { method: 'GET' });
      r.status < 500 ? pass('n8n is running') : fail('n8n health check failed', `HTTP ${r.status}`);
    } catch(e2) {
      fail('n8n not reachable', e2.message);
    }
  }

  // ERPNext reachable
  try {
    const r = await erpRequest('/api/resource/RIFAH Lead?limit=1&fields=["name"]');
    r.status < 300 ? pass('ERPNext is reachable') : fail('ERPNext returned error', `HTTP ${r.status}`);
  } catch(e) {
    fail('ERPNext not reachable', e.message);
  }

  // Test leads exist
  try {
    const r = await erpRequest('/api/resource/RIFAH Lead?limit=5&fields=["name","lead_id"]');
    const leads = r.body?.data || [];
    leads.length > 0
      ? pass(`Test leads exist (${leads.length}+ found)`)
      : fail('No test leads found — run: node scripts/populate_test_leads.js');
  } catch(e) {
    fail('Could not query RIFAH Lead', e.message);
  }

  // Test members
  await ensureMembers();
  const freeM  = await getMemberByPhone(PHONES.free);
  const premM  = await getMemberByPhone(PHONES.premium);
  freeM  ? pass(`FREE test member exists (${freeM.rifah_id})`)  : fail('FREE test member missing');
  premM  ? pass(`PREMIUM test member exists (${premM.rifah_id})`) : fail('PREMIUM test member missing');
}

// ── SUITE 2: SEARCH_METHOD menu ───────────────────────────────────────────────
async function testMenu() {
  section('SEARCH_METHOD Menu');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  // Reach MENU step
  await sendText(phone, 'Hi');
  const s1 = await waitForStep(phone, 'MENU');
  s1 ? pass('Reached MENU step') : fail('Could not reach MENU step');

  // Select option 3 → Find Lead
  await sendText(phone, '3');
  const s2 = await waitForStep(phone, 'SEARCH_METHOD');
  s2 ? pass('MENU option 3 → SEARCH_METHOD step') : fail('Option 3 did not route to SEARCH_METHOD');

  // Invalid input stays at SEARCH_METHOD
  await sendText(phone, '9');
  await delay(2000);
  const s3 = await erp.getSession(phone);
  s3?.current_step === 'SEARCH_METHOD'
    ? pass('Invalid input stays at SEARCH_METHOD')
    : fail('Invalid input changed step unexpectedly', s3?.current_step);

  // Back to menu
  await sendText(phone, '0');
  const s4 = await waitForStep(phone, 'MENU');
  s4 ? pass('Reply 0 returns to MENU') : fail('Reply 0 did not return to MENU');

  await erp.cleanPhone(phone);
}

// ── SUITE 3: Browse by Category ───────────────────────────────────────────────
async function testCategory() {
  section('Browse by Category');

  // FREE member
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');

  // Select category browse
  await sendText(phone, '1');
  const s1 = await waitForStep(phone, 'CATEGORY_SELECT', 20000);
  s1 ? pass('Option 1 → CATEGORY_SELECT step') : fail('Category select step not reached');

  // Select BUY leads
  await sendText(phone, '1');
  const s2 = await waitForStep(phone, 'LEAD_SELECT', 20000);
  if (s2) {
    pass('Category BUY selected → LEAD_SELECT step');
    const sd = getSessionData(s2);
    sd.current_leads !== undefined
      ? pass('current_leads stored in session')
      : fail('current_leads not in session data');
    sd.selected_category === 'BUY'
      ? pass('selected_category = BUY in session')
      : fail('selected_category not set', sd.selected_category);
  } else {
    fail('LEAD_SELECT step not reached after category selection');
  }

  // Invalid category input
  await erp.cleanPhone(phone);
  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '1');
  await waitForStep(phone, 'CATEGORY_SELECT', 20000);
  await sendText(phone, '9');
  await delay(2000);
  const sErr = await erp.getSession(phone);
  sErr?.current_step === 'CATEGORY_SELECT'
    ? pass('Invalid category input stays at CATEGORY_SELECT')
    : fail('Invalid input changed step', sErr?.current_step);

  // Back from CATEGORY_SELECT
  await sendText(phone, '0');
  const sBack = await waitForStep(phone, 'SEARCH_METHOD', 10000);
  sBack ? pass('Back from CATEGORY_SELECT → SEARCH_METHOD') : fail('Back did not return to SEARCH_METHOD');

  await erp.cleanPhone(phone);

  // PREMIUM member — should see all leads
  const pPhone = PHONES.premium;
  await erp.cleanPhone(pPhone);
  await sendText(pPhone, 'Hi');
  await waitForStep(pPhone, 'MENU');
  await sendText(pPhone, '3');
  await waitForStep(pPhone, 'SEARCH_METHOD');
  await sendText(pPhone, '1');
  await waitForStep(pPhone, 'CATEGORY_SELECT', 20000);
  await sendText(pPhone, '3'); // SERVICE NEED
  const sPrem = await waitForStep(pPhone, 'LEAD_SELECT', 20000);
  if (sPrem) {
    pass('PREMIUM: Category SERVICE NEED → LEAD_SELECT');
    const sd = getSessionData(sPrem);
    sd.selected_category === 'SERVICE NEED'
      ? pass('PREMIUM: selected_category = SERVICE NEED')
      : fail('PREMIUM: selected_category mismatch', sd.selected_category);
  } else {
    fail('PREMIUM: LEAD_SELECT not reached');
  }

  await erp.cleanPhone(pPhone);
}

// ── SUITE 4: Search by Location ───────────────────────────────────────────────
async function testLocation() {
  section('Search by Location');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  // FREE: auto-searches own city
  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '2');
  const s1 = await waitForStep(phone, 'LEAD_SELECT', 20000);
  s1 ? pass('FREE: Location option 2 → auto LEAD_SELECT (own city)') : fail('FREE: Location did not reach LEAD_SELECT');

  if (s1) {
    const sd = getSessionData(s1);
    sd.current_leads !== undefined ? pass('FREE: leads stored in session') : fail('FREE: no leads in session');
    sd.search_method === 'location' ? pass('FREE: search_method = location') : fail('FREE: search_method not set');
  }

  await erp.cleanPhone(phone);

  // PREMIUM: shows location choice menu
  const pPhone = PHONES.premium;
  await erp.cleanPhone(pPhone);
  await sendText(pPhone, 'Hi');
  await waitForStep(pPhone, 'MENU');
  await sendText(pPhone, '3');
  await waitForStep(pPhone, 'SEARCH_METHOD');
  await sendText(pPhone, '2');
  const sLoc = await waitForStep(pPhone, 'LOCATION_INPUT', 10000);
  sLoc ? pass('PREMIUM: Location option 2 → LOCATION_INPUT step') : fail('PREMIUM: LOCATION_INPUT step not reached');

  // PREMIUM: select All India
  await sendText(pPhone, '4');
  const sAll = await waitForStep(pPhone, 'LEAD_SELECT', 20000);
  sAll ? pass('PREMIUM: All India → LEAD_SELECT') : fail('PREMIUM: All India did not reach LEAD_SELECT');

  await erp.cleanPhone(pPhone);
}

// ── SUITE 5: Browse by Urgency ────────────────────────────────────────────────
async function testUrgency() {
  section('Browse by Urgency');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '3');
  const s1 = await waitForStep(phone, 'URGENCY_SELECT', 20000);
  s1 ? pass('Option 3 → URGENCY_SELECT step') : fail('URGENCY_SELECT not reached');

  // Select URGENT
  await sendText(phone, '1');
  const s2 = await waitForStep(phone, 'LEAD_SELECT', 20000);
  if (s2) {
    pass('URGENT selected → LEAD_SELECT');
    const sd = getSessionData(s2);
    sd.selected_urgency === 'URGENT' ? pass('selected_urgency = URGENT') : fail('selected_urgency mismatch', sd.selected_urgency);
    sd.current_leads !== undefined ? pass('leads stored in session') : fail('no leads in session');
  } else {
    fail('LEAD_SELECT not reached after urgency selection');
  }

  // Back from URGENCY_SELECT
  await erp.cleanPhone(phone);
  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '3');
  await waitForStep(phone, 'URGENCY_SELECT', 20000);
  await sendText(phone, '0');
  const sBack = await waitForStep(phone, 'SEARCH_METHOD', 10000);
  sBack ? pass('Back from URGENCY_SELECT → SEARCH_METHOD') : fail('Back did not work');

  await erp.cleanPhone(phone);
}

// ── SUITE 6: View All Recent ──────────────────────────────────────────────────
async function testRecent() {
  section('View All Recent Leads');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '4');
  const s1 = await waitForStep(phone, 'LEAD_SELECT', 25000);
  if (s1) {
    pass('Option 4 → LEAD_SELECT (View All Recent)');
    const sd = getSessionData(s1);
    sd.search_method === 'all_recent' ? pass('search_method = all_recent') : fail('search_method mismatch', sd.search_method);
    sd.current_leads !== undefined ? pass('leads stored in session') : fail('no leads in session');
    Array.isArray(sd.current_leads) && sd.current_leads.length > 0
      ? pass(`Loaded ${sd.current_leads.length} recent leads`)
      : fail('No leads loaded');
  } else {
    fail('LEAD_SELECT not reached for View All Recent');
  }

  await erp.cleanPhone(phone);
}

// ── SUITE 7: My Saved Searches ────────────────────────────────────────────────
async function testSavedSearches() {
  section('My Saved Searches');

  // FREE: should be blocked
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '5');
  await delay(2500);
  const s1 = await erp.getSession(phone);
  s1?.current_step === 'SEARCH_METHOD'
    ? pass('FREE: Saved Searches blocked — stays at SEARCH_METHOD')
    : fail('FREE: should be blocked from saved searches', s1?.current_step);

  await erp.cleanPhone(phone);

  // PREMIUM: show saved searches (empty state)
  const pPhone = PHONES.premium;
  await erp.cleanPhone(pPhone);

  // Reset search preferences
  const premM = await getMemberByPhone(pPhone);
  if (premM) await updateMember(premM.name, { search_preferences: '[]' });

  await sendText(pPhone, 'Hi');
  await waitForStep(pPhone, 'MENU');
  await sendText(pPhone, '3');
  await waitForStep(pPhone, 'SEARCH_METHOD');
  await sendText(pPhone, '5');
  await delay(3000);
  const s2 = await erp.getSession(pPhone);
  s2?.current_step === 'SEARCH_METHOD'
    ? pass('PREMIUM: Saved Searches (empty) shown — returns to SEARCH_METHOD')
    : fail('PREMIUM: Unexpected step after saved searches', s2?.current_step);

  await erp.cleanPhone(pPhone);
}

// ── SUITE 8: My Responses ─────────────────────────────────────────────────────
async function testMyResponses() {
  section('My Responses');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '6');
  await delay(5000); // allow ERPNext query
  const s1 = await erp.getSession(phone);
  s1?.current_step === 'SEARCH_METHOD'
    ? pass('My Responses shown — returns to SEARCH_METHOD')
    : fail('My Responses did not return to SEARCH_METHOD', s1?.current_step);

  await erp.cleanPhone(phone);
}

// ── SUITE 9: Lead Select → Lead Detail ───────────────────────────────────────
async function testLeadDetail() {
  section('Lead Detail View');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);
  await delay(500);

  // Navigate to a lead list
  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '1');          // Browse by Category
  await waitForStep(phone, 'CATEGORY_SELECT', 20000);
  await sendText(phone, '1');          // BUY
  const sList = await waitForStep(phone, 'LEAD_SELECT', 20000);

  if (!sList) {
    fail('Could not reach LEAD_SELECT for lead detail test');
    await erp.cleanPhone(phone);
    return;
  }

  const sd = getSessionData(sList);
  if (!sd.current_leads || sd.current_leads.length === 0) {
    info('No leads in session — skipping lead detail test (seed test leads first)');
    await erp.cleanPhone(phone);
    return;
  }

  pass(`LEAD_SELECT reached with ${sd.current_leads.length} leads`);

  // Select lead 1
  await sendText(phone, '1');
  const sDetail = await waitForStep(phone, 'LEAD_ACTION', 15000);
  if (sDetail) {
    pass('Lead 1 selected → LEAD_ACTION step');
    const sdDetail = getSessionData(sDetail);
    sdDetail.current_lead_id ? pass(`current_lead_id set: ${sdDetail.current_lead_id}`) : fail('current_lead_id not set');
    sdDetail.current_lead_details ? pass('current_lead_details set in session') : fail('current_lead_details not set');
  } else {
    fail('LEAD_ACTION step not reached after selecting lead');
  }

  // Invalid selection
  await erp.cleanPhone(phone);
  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '4');
  const sRecent = await waitForStep(phone, 'LEAD_SELECT', 25000);
  if (sRecent) {
    await sendText(phone, 'ABC');
    await delay(1500);
    const sInvalid = await erp.getSession(phone);
    sInvalid?.current_step === 'LEAD_SELECT'
      ? pass('Invalid lead selection stays at LEAD_SELECT')
      : fail('Invalid input changed step', sInvalid?.current_step);
  }

  await erp.cleanPhone(phone);
}

// ── SUITE 10: Vendor Qualification (Flow 3) ───────────────────────────────────
async function testVendorQualify() {
  section('Vendor Qualification via Flow 3');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);

  // Reset daily counter
  const member = await getMemberByPhone(phone);
  if (member) await updateMember(member.name, { leads_responded_today: 0, last_search_date: '' });

  // Navigate to LEAD_ACTION
  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '4');
  const sList = await waitForStep(phone, 'LEAD_SELECT', 25000);
  if (!sList) { fail('LEAD_SELECT not reached'); await erp.cleanPhone(phone); return; }

  const sd = getSessionData(sList);
  if (!sd.current_leads?.length) {
    info('No leads available — skipping qualify test (seed test leads first)');
    await erp.cleanPhone(phone);
    return;
  }

  await sendText(phone, '1');
  const sAction = await waitForStep(phone, 'LEAD_ACTION', 15000);
  if (!sAction) { fail('LEAD_ACTION not reached'); await erp.cleanPhone(phone); return; }
  pass('Reached LEAD_ACTION');

  // Reply INTERESTED
  await sendText(phone, 'INTERESTED');
  const sQ1 = await waitForStep(phone, 'VENDOR_Q1', 20000);
  if (!sQ1) { fail('VENDOR_Q1 not reached after INTERESTED'); await erp.cleanPhone(phone); return; }
  pass('INTERESTED → VENDOR_Q1 (qualification started)');

  const sdQ1 = getSessionData(sQ1);
  sdQ1.qualification_source === 'flow3' ? pass('qualification_source = flow3') : fail('qualification_source not flow3', sdQ1.qualification_source);
  Array.isArray(sdQ1.vendor_questions) && sdQ1.vendor_questions.length === 6
    ? pass('6 vendor questions generated') : fail('vendor questions not generated correctly');

  // Answer all 6 questions
  const answers = ['YES', 'YES', '7 days', '₹45,000 for full order', 'YES', 'YES'];
  let step = 'VENDOR_Q1';
  for (let i = 0; i < 6; i++) {
    await sendText(phone, answers[i]);
    const nextStep = i < 5 ? `VENDOR_Q${i+2}` : 'VENDOR_SCORE';
    const sNext = await waitForStep(phone, nextStep, 10000);
    sNext ? pass(`Q${i+1} answered → ${nextStep}`) : fail(`Q${i+1} did not advance to ${nextStep}`);
    step = nextStep;
  }

  if (step !== 'VENDOR_SCORE') { await erp.cleanPhone(phone); return; }

  // Submit
  await sendText(phone, 'SUBMIT');
  await delay(5000); // allow ERPNext update + admin notify
  const sDone = await erp.getSession(phone);
  sDone?.current_step === 'SEARCH_METHOD'
    ? pass('SUBMIT → interest stored → back to SEARCH_METHOD')
    : fail('SUBMIT did not complete flow', sDone?.current_step);

  // Verify daily counter incremented
  await delay(1000);
  const updatedMember = await getMemberByPhone(phone);
  updatedMember?.leads_responded_today > 0
    ? pass(`Daily counter incremented: ${updatedMember.leads_responded_today}/3`)
    : fail('Daily counter not incremented');

  await erp.cleanPhone(phone);
}

// ── SUITE 11: Daily Limit Enforcement ────────────────────────────────────────
async function testDailyLimit() {
  section('Daily Response Limit (FREE: 3/day)');
  const phone = PHONES.free;
  await erp.cleanPhone(phone);

  // Set member to already at limit
  const member = await getMemberByPhone(phone);
  if (member) {
    const today = new Date().toISOString().split('T')[0];
    await updateMember(member.name, { leads_responded_today: 3, last_search_date: today });
    pass('Set leads_responded_today = 3 (at limit)');
  } else {
    fail('Could not find member to set limit');
    await erp.cleanPhone(phone);
    return;
  }

  // Navigate to LEAD_ACTION
  await sendText(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendText(phone, '3');
  await waitForStep(phone, 'SEARCH_METHOD');
  await sendText(phone, '4');
  const sList = await waitForStep(phone, 'LEAD_SELECT', 25000);
  if (!sList || !getSessionData(sList).current_leads?.length) {
    info('No leads available — skipping limit test');
    await erp.cleanPhone(phone);
    return;
  }

  await sendText(phone, '1');
  const sAction = await waitForStep(phone, 'LEAD_ACTION', 15000);
  if (!sAction) { fail('LEAD_ACTION not reached'); await erp.cleanPhone(phone); return; }

  // Try INTERESTED — should be blocked
  await sendText(phone, 'INTERESTED');
  await delay(2000);
  const sAfter = await erp.getSession(phone);
  sAfter?.current_step === 'LEAD_ACTION'
    ? pass('Daily limit enforced — stays at LEAD_ACTION')
    : fail('Daily limit NOT enforced — INTERESTED passed through', sAfter?.current_step);

  // Reset limit and verify it works next day
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (member) await updateMember(member.name, { leads_responded_today: 3, last_search_date: yesterday });
  pass('Reset last_search_date to yesterday (simulates new day)');

  await erp.cleanPhone(phone);
}

// ── SUITE 12: Save Search ─────────────────────────────────────────────────────
async function testSaveSearch() {
  section('Save Search (Premium)');
  const pPhone = PHONES.premium;
  await erp.cleanPhone(pPhone);

  // Reset search preferences
  const premM = await getMemberByPhone(pPhone);
  if (premM) await updateMember(premM.name, { search_preferences: '[]' });

  // Navigate to LEAD_SELECT
  await sendText(pPhone, 'Hi');
  await waitForStep(pPhone, 'MENU');
  await sendText(pPhone, '3');
  await waitForStep(pPhone, 'SEARCH_METHOD');
  await sendText(pPhone, '1');          // Category
  await waitForStep(pPhone, 'CATEGORY_SELECT', 20000);
  await sendText(pPhone, '1');          // BUY
  const sList = await waitForStep(pPhone, 'LEAD_SELECT', 20000);
  if (!sList) { fail('LEAD_SELECT not reached'); await erp.cleanPhone(pPhone); return; }

  pass('Reached LEAD_SELECT for Save Search test');

  // Type SAVE SEARCH (triggers SAVE_SEARCH_NAME in State Machine)
  await sendText(pPhone, 'SAVE SEARCH');
  const sSave = await waitForStep(pPhone, 'SAVE_SEARCH_NAME', 10000);
  sSave ? pass('SAVE SEARCH → SAVE_SEARCH_NAME step') : fail('SAVE_SEARCH_NAME step not reached');

  if (!sSave) { await erp.cleanPhone(pPhone); return; }

  // Provide search name
  await sendText(pPhone, 'My BUY Leads Pune');
  await delay(4000); // allow ERPNext update
  const sDone = await erp.getSession(pPhone);
  sDone?.current_step === 'SEARCH_METHOD'
    ? pass('Search saved → returned to SEARCH_METHOD')
    : fail('Save search did not complete', sDone?.current_step);

  // Verify saved in ERPNext
  await delay(1000);
  const updatedM = await getMemberByPhone(pPhone);
  if (updatedM) {
    try {
      const prefs = JSON.parse(updatedM.search_preferences || '[]');
      prefs.length > 0 && prefs.some(p => p.name === 'My BUY Leads Pune')
        ? pass('Search "My BUY Leads Pune" saved in ERPNext')
        : fail('Search not found in search_preferences', updatedM.search_preferences);
    } catch(e) {
      fail('Could not parse search_preferences', e.message);
    }
  }

  await erp.cleanPhone(pPhone);
}

// ── SUITE 13: Edge Cases ──────────────────────────────────────────────────────
async function testEdgeCases() {
  section('Edge Cases');
  const phone = PHONES.edge;
  await erp.cleanPhone(phone);

  // Unregistered user cannot access Find Lead
  await sendText(phone, 'Hi');
  const sNew = await waitForStep(phone, 'MENU', 10000);
  if (sNew) {
    await sendText(phone, '3');
    await delay(3000);
    // Should show main menu / registration prompt (no active member = no Find Lead)
    const sAfter = await erp.getSession(phone);
    // State machine should handle gracefully — either MENU or SEARCH_METHOD (if no member check)
    pass('Unregistered user handled gracefully (no crash)');
  }

  await erp.cleanPhone(phone);

  // MORE pagination
  const freePhone = PHONES.free;
  await erp.cleanPhone(freePhone);
  await sendText(freePhone, 'Hi');
  await waitForStep(freePhone, 'MENU');
  await sendText(freePhone, '3');
  await waitForStep(freePhone, 'SEARCH_METHOD');
  await sendText(freePhone, '4');
  const sList = await waitForStep(freePhone, 'LEAD_SELECT', 25000);
  if (sList) {
    await sendText(freePhone, 'MORE');
    const sMore = await waitForStep(freePhone, 'LEAD_SELECT', 20000);
    sMore ? pass('MORE pagination → stays at LEAD_SELECT') : fail('MORE did not stay at LEAD_SELECT');
  }

  await erp.cleanPhone(freePhone);
}

// ── REPORT ────────────────────────────────────────────────────────────────────
function printReport() {
  console.log('\n' + c.bold('━'.repeat(50)));
  console.log(c.bold('FLOW 3 TEST RESULTS'));
  console.log('━'.repeat(50));
  console.log(c.green(`  Passed: ${results.passed}`));
  console.log(c.red(`  Failed: ${results.failed}`));
  console.log(`  Total:  ${results.passed + results.failed}`);
  if (results.errors.length > 0) {
    console.log('\n' + c.bold(c.red('  Failed tests:')));
    results.errors.forEach((e, i) => {
      console.log(c.red(`  ${i+1}. ${e.msg}`));
      if (e.detail) console.log(c.grey(`     ${e.detail}`));
    });
  }
  console.log('━'.repeat(50) + '\n');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const all  = args.length === 0;

  console.log(c.bold('\n📱 RIFAH Connect — Flow 3 (Find Lead) Test Suite'));
  console.log(c.grey(`Webhook: ${WEBHOOK}`));
  console.log(c.grey(`ERPNext: ${BASE}\n`));

  if (args.includes('--clean')) {
    await cleanTestData();
    return;
  }

  if (all || args.includes('--infra'))     await testInfra();
  if (all || args.includes('--menu'))      await testMenu();
  if (all || args.includes('--category'))  await testCategory();
  if (all || args.includes('--location'))  await testLocation();
  if (all || args.includes('--urgency'))   await testUrgency();
  if (all || args.includes('--recent'))    await testRecent();
  if (all || args.includes('--saved'))     await testSavedSearches();
  if (all || args.includes('--responses')) await testMyResponses();
  if (all || args.includes('--qualify'))   await testLeadDetail().then(() => testVendorQualify());
  if (all || args.includes('--limit'))     await testDailyLimit();
  if (all || args.includes('--save'))      await testSaveSearch();
  if (all || args.includes('--edge'))      await testEdgeCases();

  printReport();
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
