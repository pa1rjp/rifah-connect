#!/usr/bin/env node
/**
 * RIFAH Connect — Automated Flow 2A Test Suite (Share Lead - Free User)
 *
 * Tests the lead sharing flow via Flow 2A's dedicated webhook.
 * No real WhatsApp or Meta API needed.
 *
 * Usage:
 *   node test_flow2a.js              → runs all test suites
 *   node test_flow2a.js --buyer      → buyer lead flow only
 *   node test_flow2a.js --vendor     → vendor response flow only
 *   node test_flow2a.js --edge       → edge cases only
 *   node test_flow2a.js --infra      → ERPNext/n8n connectivity only
 *   node test_flow2a.js --clean      → wipe test data and exit
 */

const https = require('https');
const http  = require('http');
const erp   = require('../scripts/erpnext');

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ── CONFIG ────────────────────────────────────────────────────────────────────
const WEBHOOK = process.env.N8N_FLOW2A_WEBHOOK_URL || 'http://localhost:5678/webhook/flow2a-webhook';
const META_PID = process.env.META_PHONE_NUMBER_ID || '1051021614753488';

const CONFIG = {
  webhook: WEBHOOK,
  delay_ms: 1500,
  phones: {
    buyer:   '919100000001',
    vendor:  '919100000002',
    edge:    '919100000003',
  },
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

// ── HTTP ─────────────────────────────────────────────────────────────────────
function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: options.method || 'GET',
      headers: options.headers || {},
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch { resolve({ status: res.statusCode, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── SEND MESSAGE ─────────────────────────────────────────────────────────────
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
    const res = await request(CONFIG.webhook, {
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

// ── WAIT FOR SESSION STEP ─────────────────────────────────────────────────────
async function waitForStep(phone, step, maxWait = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(500);
    const s = await erp.getSession(phone);
    if (s?.current_step === step) return s;
  }
  const s = await erp.getSession(phone);
  return s?.current_step === step ? s : null;
}

// ── WAIT FOR AI STEP (AI_Q1..AI_Q6) ──────────────────────────────────────────
async function waitForAIStep(phone, maxWait = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(600);
    const s = await erp.getSession(phone);
    if (s?.current_step?.startsWith('AI_Q')) return s;
  }
  return null;
}

// ── WAIT FOR VENDOR STEP ─────────────────────────────────────────────────────
async function waitForVendorStep(phone, step, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(500);
    const s = await erp.getSession(phone);
    if (s?.current_step === step) return s;
  }
  return null;
}

// ── SETUP FREE MEMBER ─────────────────────────────────────────────────────────
async function ensureFreeMember(phone, name = 'Test Buyer User', bizName = 'Test Buyer Business') {
  let m = await erp.getMember(phone);
  if (m) return m;
  const year = new Date().getFullYear();
  const r = await erp.createMember({
    rifah_id: `RIF-FREE-${year}-T${phone.slice(-4)}`,
    full_name: name,
    business_name: bizName,
    whatsapp_number: phone,
    membership_tier: 'FREE',
    status: 'Active Free',
    city_state: 'Pune, Maharashtra',
    industry: 'Packaging',
    years_operating: 5,
    registration_date: new Date().toISOString().replace('T',' ').substring(0,19)
  });
  return r.body?.data || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 1: INFRA — ERPNext + n8n connectivity
// ─────────────────────────────────────────────────────────────────────────────
async function testInfra() {
  section('TEST SUITE 1: Infrastructure & Connectivity');

  info('Checking ERPNext is reachable...');
  try {
    const user = await erp.whoami();
    user ? pass(`ERPNext reachable — logged in as: ${user}`) : fail('ERPNext login failed');
  } catch (e) { fail('ERPNext unreachable', e.message); }

  info('Checking RIFAH Lead doctype exists...');
  try {
    const r = await erp.request(`${erp.BASE}/api/resource/RIFAH Lead?limit=1&fields=${erp.enc(['name'])}`, 'GET');
    Array.isArray(r.body?.data) ? pass('RIFAH Lead doctype accessible') : fail('RIFAH Lead doctype not found', JSON.stringify(r.body).substring(0,200));
  } catch (e) { fail('RIFAH Lead doctype error', e.message); }

  info('Checking RIFAH WhatsApp Group doctype + sample data...');
  try {
    const groups = await erp.listGroups();
    groups.length >= 5
      ? pass(`RIFAH WhatsApp Group accessible — ${groups.length} groups found`)
      : fail(`Not enough groups — expected ≥5, got ${groups.length}`);
  } catch (e) { fail('RIFAH WhatsApp Group error', e.message); }

  info('Checking Flow 2A webhook is active...');
  try {
    const res = await sendText('919199999999', 'test-ping');
    res?.status === 200 ? pass('Flow 2A webhook responds HTTP 200') : fail(`Webhook returned ${res?.status}`);
  } catch (e) { fail('Flow 2A webhook unreachable', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 2: BUYER LEAD FLOW (Happy Path)
// ─────────────────────────────────────────────────────────────────────────────
async function testBuyerFlow() {
  section('TEST SUITE 2: Buyer Lead Flow (Happy Path)');
  const phone = CONFIG.phones.buyer;

  info('Cleaning up previous test data...');
  await erp.cleanPhone(phone);
  await delay(500);

  info('Setting up FREE member in ERPNext...');
  const member = await ensureFreeMember(phone);
  member ? pass('FREE member exists in ERPNext') : fail('Failed to create test FREE member');

  // ── Simulate session at LEAD_TYPE step (as if user selected "2" from Flow 1 MENU)
  info('Setting session to LEAD_TYPE (simulating menu option 2 routing)...');
  const ts = new Date().toISOString().replace('T',' ').substring(0,19);
  await erp.request(`${erp.BASE}/api/resource/RIFAH Session`, 'POST', {
    doctype: 'RIFAH Session',
    phone_number: phone,
    current_step: 'LEAD_TYPE',
    session_data: JSON.stringify({ phone }),
    status: 'Active',
    last_activity: ts
  });
  const initSession = await erp.getSession(phone);
  initSession?.current_step === 'LEAD_TYPE'
    ? pass('Session initialised at LEAD_TYPE')
    : fail('Session not at LEAD_TYPE', `Got: ${initSession?.current_step}`);

  // Step 1: Lead type
  info('Step 1: Send "BUY" → expect LEAD_DESC');
  await sendText(phone, 'BUY');
  const s1 = await waitForStep(phone, 'LEAD_DESC');
  s1 ? pass('BUY accepted, moved to LEAD_DESC') : fail('Step not at LEAD_DESC');

  // Step 2: Description (min 10 words)
  info('Step 2: Send description (too short) → stays at LEAD_DESC');
  await sendText(phone, 'Need bottles');
  await delay(2000);
  const s2short = await erp.getSession(phone);
  s2short?.current_step === 'LEAD_DESC'
    ? pass('Short description rejected, stays at LEAD_DESC')
    : fail('Short description was wrongly accepted', `Step: ${s2short?.current_step}`);

  info('Step 2: Send valid description (≥10 words) → expect LEAD_LOC');
  await sendText(phone, 'Need 5000 plastic bottles 500ml food-grade PET material for juice packaging business in Pune');
  const s2 = await waitForStep(phone, 'LEAD_LOC');
  s2 ? pass('Valid description accepted, moved to LEAD_LOC') : fail('Step not at LEAD_LOC');

  // Step 3: Location
  info('Step 3: Send location → expect LEAD_URGENCY');
  await sendText(phone, 'Pune, Maharashtra');
  const s3 = await waitForStep(phone, 'LEAD_URGENCY');
  s3 ? pass('Location accepted, moved to LEAD_URGENCY') : fail('Step not at LEAD_URGENCY');

  // Step 4: Urgency via number
  info('Step 4: Send "2" (THIS WEEK) → expect LEAD_BUDGET');
  await sendText(phone, '2');
  const s4 = await waitForStep(phone, 'LEAD_BUDGET');
  s4 ? pass('Urgency "2" accepted, moved to LEAD_BUDGET') : fail('Step not at LEAD_BUDGET');

  // Step 5: Budget (skip)
  info('Step 5: Send "SKIP" → expect AI_Q1 (OpenAI call)');
  await sendText(phone, 'SKIP');
  const s5 = await waitForAIStep(phone, 20000);
  s5 ? pass(`Budget skipped, AI questions triggered, at ${s5.current_step}`) : fail('Did not reach AI_Q1 after SKIP');

  // Step 6: Check session has ai_questions stored
  info('Step 6: Verify ai_questions stored in session...');
  await delay(1000);
  const s6detail = await erp.getSession(phone);
  let aiQuestions = [];
  try {
    const sd = JSON.parse(s6detail?.session_data || '{}');
    aiQuestions = sd.ai_questions || [];
  } catch(e) {}
  aiQuestions.length > 0
    ? pass(`${aiQuestions.length} AI questions stored in session`)
    : fail('ai_questions not stored in session (OpenAI may have failed — fallback expected)');

  // Step 7: Answer AI questions (answer all until LEAD_CREATE)
  info('Step 7: Answering AI questions...');
  const s7 = await erp.getSession(phone);
  let sessionNow = s7;
  let answeredCount = 0;
  for (let i = 0; i < 6 && sessionNow?.current_step?.startsWith('AI_Q'); i++) {
    await sendText(phone, `Test answer for question ${i + 1}`);
    await delay(1500);
    sessionNow = await erp.getSession(phone);
    answeredCount++;
  }
  pass(`Answered ${answeredCount} AI question(s)`);

  // Step 8: Wait for LEAD_CREATE
  info('Step 8: Wait for LEAD_CREATE (lead being saved)...');
  const s8 = await waitForStep(phone, 'LEAD_CREATE', 10000);
  s8 ? pass('Session moved to LEAD_CREATE') : fail('Session never reached LEAD_CREATE', `Current: ${sessionNow?.current_step}`);

  // Step 9: Verify RIFAH Lead created in ERPNext
  info('Step 9: Verifying RIFAH Lead created in ERPNext...');
  await delay(2000);
  const lead = await erp.getLeadByPhone(phone);
  lead ? pass(`Lead created: ${lead.lead_id}`) : fail('No RIFAH Lead found after creation');

  if (lead) {
    const leadDetail = await erp.getLead(lead.lead_id || lead.name);
    leadDetail?.lead_type === 'BUY'
      ? pass('lead_type = BUY')
      : fail('lead_type incorrect', `Got: ${leadDetail?.lead_type}`);

    leadDetail?.tier === 'FREE'
      ? pass('tier = FREE')
      : fail('tier incorrect', `Got: ${leadDetail?.tier}`);

    leadDetail?.status === 'Pending Review'
      ? pass('status = Pending Review')
      : fail('status incorrect', `Got: ${leadDetail?.status}`);

    leadDetail?.location === 'Pune, Maharashtra'
      ? pass('location stored correctly')
      : fail('location incorrect', `Got: ${leadDetail?.location}`);

    const aiQ = leadDetail?.ai_qualification;
    let hasAI = false;
    try { const parsed = JSON.parse(aiQ); hasAI = Object.keys(parsed).length > 0; } catch(e) {}
    hasAI ? pass('ai_qualification stored in lead') : fail('ai_qualification empty or invalid');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 3: BUYER FLOW — Number shortcuts + SELL type
// ─────────────────────────────────────────────────────────────────────────────
async function testBuyerFlowVariants() {
  section('TEST SUITE 3: Buyer Flow Variants (SELL + number shortcuts)');
  const phone = CONFIG.phones.edge;

  info('Cleaning up...');
  await erp.cleanPhone(phone);
  await delay(300);
  await ensureFreeMember(phone, 'Test Edge User', 'Edge Business Ltd');

  const ts = new Date().toISOString().replace('T',' ').substring(0,19);
  await erp.request(`${erp.BASE}/api/resource/RIFAH Session`, 'POST', {
    doctype: 'RIFAH Session', phone_number: phone, current_step: 'LEAD_TYPE',
    session_data: JSON.stringify({ phone }), status: 'Active', last_activity: ts
  });

  // Test: numeric 2 = SELL
  info('Edge 1: Send "2" at LEAD_TYPE → SELL');
  await sendText(phone, '2');
  const e1 = await waitForStep(phone, 'LEAD_DESC');
  e1 ? pass('"2" mapped to SELL, moved to LEAD_DESC') : fail('"2" not accepted for SELL');

  // Send valid description
  await sendText(phone, 'I have 500ml food grade plastic bottles in bulk quantity for juice manufacturers in Pune');
  await waitForStep(phone, 'LEAD_LOC');

  // Send location
  await sendText(phone, 'Mumbai');
  await waitForStep(phone, 'LEAD_URGENCY');

  // Test: URGENT via number 1
  info('Edge 2: Send "1" at LEAD_URGENCY → URGENT');
  await sendText(phone, '1');
  const e2 = await waitForStep(phone, 'LEAD_BUDGET');
  e2 ? pass('"1" mapped to URGENT, moved to LEAD_BUDGET') : fail('"1" not accepted at LEAD_URGENCY');

  // Test: Budget text (not SKIP)
  info('Edge 3: Send budget text → moves to AI_Q1');
  await sendText(phone, '₹50,000 - ₹1,00,000');
  const e3 = await waitForAIStep(phone, 20000);
  e3 ? pass('Budget text accepted, AI questions triggered') : fail('Budget text not accepted');

  // Test: Invalid urgency input
  const phone2 = '919100000010';
  await erp.cleanPhone(phone2);
  const ts2 = new Date().toISOString().replace('T',' ').substring(0,19);
  await erp.request(`${erp.BASE}/api/resource/RIFAH Session`, 'POST', {
    doctype: 'RIFAH Session', phone_number: phone2, current_step: 'LEAD_URGENCY',
    session_data: JSON.stringify({ phone: phone2, lead_type: 'BUY', lead_description: 'test desc', lead_location: 'Pune' }),
    status: 'Active', last_activity: ts2
  });
  info('Edge 4: Invalid urgency "TOMORROW" → stays at LEAD_URGENCY');
  await sendText(phone2, 'TOMORROW');
  await delay(2000);
  const e4 = await erp.getSession(phone2);
  e4?.current_step === 'LEAD_URGENCY'
    ? pass('Invalid urgency rejected, stays at LEAD_URGENCY')
    : fail('Invalid urgency was accepted', `Step: ${e4?.current_step}`);
  await erp.cleanPhone(phone2);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 4: VENDOR RESPONSE FLOW
// ─────────────────────────────────────────────────────────────────────────────
async function testVendorFlow() {
  section('TEST SUITE 4: Vendor Response Flow');
  const vendorPhone = CONFIG.phones.vendor;
  const buyerPhone  = CONFIG.phones.buyer;

  // Ensure vendor is registered
  info('Setting up vendor as FREE member...');
  await erp.deleteMember(vendorPhone);
  await erp.deleteSession(vendorPhone);
  const vendor = await ensureFreeMember(vendorPhone, 'Test Vendor User', 'Test Vendor Business');
  vendor ? pass('Vendor FREE member created') : fail('Failed to create vendor member');

  // Get lead ID from buyer's lead (created in Suite 2)
  info('Finding lead created in Suite 2...');
  const lead = await erp.getLeadByPhone(buyerPhone);
  if (!lead) { fail('No lead found from buyer flow — run Suite 2 first'); return; }
  const leadId = lead.lead_id || lead.name;
  pass(`Found lead: ${leadId}`);

  // Simulate vendor clicking lead link (sends lead ID as message)
  info(`Step 1: Vendor sends "${leadId}" → expect VENDOR_INTRO`);
  await sendText(vendorPhone, leadId);
  const v1 = await waitForStep(vendorPhone, 'VENDOR_INTRO', 10000);
  v1 ? pass('Vendor lead lookup successful, session at VENDOR_INTRO') : fail('Session not at VENDOR_INTRO', `Got: ${(await erp.getSession(vendorPhone))?.current_step}`);

  // Vendor says YES
  info('Step 2: Vendor sends "YES" → expect VENDOR_Q1 (OpenAI call)');
  await sendText(vendorPhone, 'YES');
  const v2 = await waitForVendorStep(vendorPhone, 'VENDOR_Q1', 20000);
  v2 ? pass('YES accepted, vendor AI questions generated, at VENDOR_Q1')
     : fail('Session not at VENDOR_Q1', `Got: ${(await erp.getSession(vendorPhone))?.current_step}`);

  // Answer all 6 vendor questions
  info('Steps 3-8: Answer vendor qualification questions...');
  const vendorAnswers = ['YES', 'YES', '7 days', '₹9 per bottle', 'YES', 'YES'];
  let vSession = await erp.getSession(vendorPhone);
  for (let i = 0; i < 6 && vSession?.current_step?.startsWith('VENDOR_Q'); i++) {
    await sendText(vendorPhone, vendorAnswers[i] || 'YES');
    await delay(1500);
    vSession = await erp.getSession(vendorPhone);
  }

  // Wait for VENDOR_SCORE
  const v3 = await waitForVendorStep(vendorPhone, 'VENDOR_SCORE', 10000);
  v3 ? pass('Answered all questions, session at VENDOR_SCORE') : fail('Session not at VENDOR_SCORE', `Got: ${vSession?.current_step}`);

  // Check score in session
  info('Step 9: Verify compatibility score calculated...');
  const vSessionDetail = await erp.getSession(vendorPhone);
  let score = 0;
  try { score = JSON.parse(vSessionDetail?.session_data || '{}').compatibility_score || 0; } catch(e) {}
  score > 0 ? pass(`Compatibility score calculated: ${score}/100`) : fail('Compatibility score not found in session');

  // Vendor submits interest
  info('Step 10: Vendor sends "SUBMIT" → expect VENDOR_SUBMIT');
  await sendText(vendorPhone, 'SUBMIT');
  const v4 = await waitForVendorStep(vendorPhone, 'VENDOR_SUBMIT', 8000);
  v4 ? pass('SUBMIT accepted, moved to VENDOR_SUBMIT') : fail('Session not at VENDOR_SUBMIT');

  // Verify lead updated with vendor interest
  info('Step 11: Verifying interested_vendors updated in RIFAH Lead...');
  await delay(3000);
  const updatedLead = await erp.getLead(leadId);
  let vendorInterests = [];
  try { vendorInterests = JSON.parse(updatedLead?.interested_vendors || '[]'); } catch(e) {}
  vendorInterests.length > 0
    ? pass(`interested_vendors has ${vendorInterests.length} entry/entries`)
    : fail('interested_vendors not updated in RIFAH Lead');

  if (vendorInterests.length > 0) {
    const vi = vendorInterests[0];
    vi.vendor_id ? pass('vendor_id stored in interest record') : fail('vendor_id missing from interest');
    vi.compatibility_score >= 0 ? pass(`compatibility_score stored: ${vi.compatibility_score}`) : fail('compatibility_score missing');
  }

  // Check lead status updated
  const leadStatus = updatedLead?.status;
  (leadStatus === 'Has Interested Vendors' || leadStatus === 'Pending Review')
    ? pass(`Lead status: ${leadStatus}`)
    : fail('Lead status not updated', `Got: ${leadStatus}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 5: EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────
async function testEdgeCases() {
  section('TEST SUITE 5: Edge Cases');

  // Edge: Non-flow-2 session → skip
  info('Edge 1: Session at MENU (Flow 1 step) → Flow 2A should skip');
  const phone = '919100099001';
  await erp.cleanPhone(phone);
  const ts = new Date().toISOString().replace('T',' ').substring(0,19);
  await erp.request(`${erp.BASE}/api/resource/RIFAH Session`, 'POST', {
    doctype: 'RIFAH Session', phone_number: phone, current_step: 'MENU',
    session_data: JSON.stringify({ phone }), status: 'Active', last_activity: ts
  });
  await sendText(phone, 'BUY');
  await delay(2000);
  const e1 = await erp.getSession(phone);
  e1?.current_step === 'MENU'
    ? pass('Flow 2A skips MENU sessions (handled by Flow 1)')
    : fail('Flow 2A wrongly handled a MENU session', `Step now: ${e1?.current_step}`);
  await erp.cleanPhone(phone);

  // Edge: Invalid lead ID pattern
  info('Edge 2: Send invalid lead ID "LEAD-INVALID" → no session change');
  const phone2 = '919100099002';
  await erp.cleanPhone(phone2);
  await sendText(phone2, 'LEAD-INVALID');
  await delay(2000);
  const e2 = await erp.getSession(phone2);
  // Session should either not exist or not be at VENDOR_INTRO
  (!e2 || e2.current_step !== 'VENDOR_INTRO')
    ? pass('Invalid lead ID pattern ignored correctly')
    : fail('Invalid lead ID wrongly triggered vendor flow');
  await erp.cleanPhone(phone2);

  // Edge: Vendor sends CANCEL at VENDOR_SCORE
  info('Edge 3: Vendor sends "CANCEL" at VENDOR_SCORE → session goes IDLE');
  const phone3 = '919100099003';
  await erp.cleanPhone(phone3);
  const ts3 = new Date().toISOString().replace('T',' ').substring(0,19);
  await erp.request(`${erp.BASE}/api/resource/RIFAH Session`, 'POST', {
    doctype: 'RIFAH Session', phone_number: phone3, current_step: 'VENDOR_SCORE',
    session_data: JSON.stringify({ phone: phone3, lead_id: 'LEAD-FREE-2026-0001', compatibility_score: 70 }),
    status: 'Active', last_activity: ts3
  });
  await sendText(phone3, 'CANCEL');
  await delay(2000);
  const e3 = await erp.getSession(phone3);
  (e3?.current_step === 'IDLE' || !e3)
    ? pass('CANCEL at VENDOR_SCORE moves to IDLE')
    : fail('CANCEL not handled correctly', `Step: ${e3?.current_step}`);
  await erp.cleanPhone(phone3);

  // Edge: WhatsApp group data integrity check
  info('Edge 4: Verify all 8 sample groups exist with correct data...');
  const groups = await erp.listGroups();
  const activeGroups = groups.filter(g => g.is_active);
  activeGroups.length >= 8
    ? pass(`${activeGroups.length} active WhatsApp groups found`)
    : fail(`Expected ≥8 active groups, got ${activeGroups.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(c.bold('\n╔════════════════════════════════════════╗'));
  console.log(c.bold('║  RIFAH Connect — Flow 2A Test Suite    ║'));
  console.log(c.bold('╚════════════════════════════════════════╝\n'));
  console.log(c.grey(`  Webhook: ${CONFIG.webhook}`));

  const args = process.argv.slice(2);
  const runAll    = args.length === 0;
  const runBuyer  = args.includes('--buyer')  || runAll;
  const runVendor = args.includes('--vendor') || runAll;
  const runEdge   = args.includes('--edge')   || runAll;
  const runInfra  = args.includes('--infra')  || runAll;

  if (args.includes('--clean')) {
    console.log('\nCleaning test data...');
    for (const phone of Object.values(CONFIG.phones)) await erp.cleanPhone(phone);
    await erp.cleanPhone('919100099001');
    await erp.cleanPhone('919100099002');
    await erp.cleanPhone('919100099003');
    await erp.cleanPhone('919100000010');
    console.log('Done.');
    return;
  }

  if (runInfra)  await testInfra();
  if (runBuyer)  await testBuyerFlow();
  if (runBuyer)  await testBuyerFlowVariants();
  if (runVendor) await testVendorFlow();
  if (runEdge)   await testEdgeCases();

  // Summary
  const total = results.passed + results.failed;
  console.log('\n' + c.bold('══════════════════════════════════════════════════'));
  console.log(c.bold('  TEST SUMMARY'));
  console.log(c.bold('══════════════════════════════════════════════════'));
  console.log(c.green(`  ✓ Passed: ${results.passed}`));
  console.log(c.red(`  ✗ Failed: ${results.failed}`));
  if (results.errors.length) {
    console.log(c.bold('\n  Failed tests:'));
    results.errors.forEach(e => {
      console.log(c.red(`  • ${e.msg}`));
      if (e.detail) console.log(c.grey(`    ${e.detail}`));
    });
  }
  const pct = total > 0 ? Math.round((results.passed / total) * 100) : 0;
  console.log(c.yellow(`\n  Score: ${pct}% (${results.passed}/${total})`));
  console.log(c.bold('══════════════════════════════════════════════════\n'));

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
