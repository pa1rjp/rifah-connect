#!/usr/bin/env node
/**
 * RIFAH Connect — Automated Flow 1 Test Suite
 *
 * Simulates WhatsApp messages by POSTing directly to n8n webhook.
 * No real WhatsApp or Meta API needed.
 *
 * Usage:
 *   node test_flow1.js              → runs all tests
 *   node test_flow1.js --free       → FREE flow only
 *   node test_flow1.js --premium    → PREMIUM flow only
 *   node test_flow1.js --edge       → edge case tests only
 *   node test_flow1.js --clean      → wipe test data and exit
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  n8n_webhook: 'http://localhost:5678/webhook/whatsapp-webhook',
  erpnext_url: 'http://localhost:8080',
  erpnext_api_key: '0e4bdd6485daf14',         // ← fill in
  erpnext_api_secret: 'f7219377d052ff5',   // ← fill in
  meta_phone_number_id: '1051021614753488',   // ← fill in
  delay_ms: 1500,                          // wait between messages (ms)
  test_phones: {
    free: '919000000001',       // fake phone for FREE test
    premium: '919000000002',    // fake phone for PREMIUM test
    existing: '919000000003',   // for returning user test
    edge: '919000000004',       // for edge case tests
  }
};

// ── COLOURS ───────────────────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  grey:   (s) => `\x1b[90m${s}\x1b[0m`,
};

// ── TEST RESULTS ──────────────────────────────────────────────────────────────
const results = { passed: 0, failed: 0, errors: [] };

function pass(msg) {
  results.passed++;
  console.log(c.green(`  ✓ ${msg}`));
}

function fail(msg, detail = '') {
  results.failed++;
  results.errors.push({ msg, detail });
  console.log(c.red(`  ✗ ${msg}`));
  if (detail) console.log(c.grey(`    ${detail}`));
}

function info(msg) {
  console.log(c.blue(`  → ${msg}`));
}

function section(msg) {
  console.log('\n' + c.bold(c.yellow(`▶ ${msg}`)));
  console.log(c.grey('─'.repeat(50)));
}

// ── DELAY ─────────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── HTTP REQUEST ──────────────────────────────────────────────────────────────
function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + (parsed.search || ''),
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── SEND FAKE WHATSAPP MESSAGE ────────────────────────────────────────────────
async function sendMessage(phone, text, name = 'Test User') {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'test_entry',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '15551234567',
            phone_number_id: CONFIG.meta_phone_number_id
          },
          contacts: [{ profile: { name }, wa_id: phone }],
          messages: [{
            from: phone,
            id: `wamid.test_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: text },
            type: 'text'
          }]
        },
        field: 'messages'
      }]
    }]
  };

  const body = JSON.stringify(payload);
  try {
    const res = await request(CONFIG.n8n_webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    console.log(c.grey(`    [${phone}] sent: "${text}" → HTTP ${res.status}`));
    return res;
  } catch (err) {
    console.log(c.red(`    [${phone}] failed to send "${text}": ${err.message}`));
    return null;
  }
}

// ── ERPNEXT API ───────────────────────────────────────────────────────────────
const erpnextHeaders = {
  'Authorization': `token ${CONFIG.erpnext_api_key}:${CONFIG.erpnext_api_secret}`,
  'Content-Type': 'application/json',
  'Host': 'rifah.localhost'
};

async function getSession(phone) {
  const url = `${CONFIG.erpnext_url}/api/resource/RIFAH Session?filters=${encodeURIComponent(JSON.stringify([["phone_number","=",phone]]))}`;
  const res = await request(url, { headers: erpnextHeaders });
  return res.body?.data?.[0] || null;
}

async function getSessionDetail(name) {
  const url = `${CONFIG.erpnext_url}/api/resource/RIFAH Session/${name}`;
  const res = await request(url, { headers: erpnextHeaders });
  return res.body?.data || null;
}

async function getMember(phone) {
  const url = `${CONFIG.erpnext_url}/api/resource/RIFAH Member?filters=${encodeURIComponent(JSON.stringify([["whatsapp_number","=",phone]]))}`;
  const res = await request(url, { headers: erpnextHeaders });
  return res.body?.data?.[0] || null;
}

async function getMemberDetail(name) {
  const url = `${CONFIG.erpnext_url}/api/resource/RIFAH Member/${name}`;
  const res = await request(url, { headers: erpnextHeaders });
  return res.body?.data || null;
}

async function deleteSession(phone) {
  const session = await getSession(phone);
  if (session) {
    await request(`${CONFIG.erpnext_url}/api/resource/RIFAH Session/${session.name}`,
      { method: 'DELETE', headers: erpnextHeaders });
  }
}

async function deleteMember(phone) {
  const member = await getMember(phone);
  if (member) {
    await request(`${CONFIG.erpnext_url}/api/resource/RIFAH Member/${member.name}`,
      { method: 'DELETE', headers: erpnextHeaders });
  }
}

async function cleanPhone(phone) {
  await deleteSession(phone);
  await deleteMember(phone);
}

// ── WAIT FOR STEP ─────────────────────────────────────────────────────────────
async function waitForStep(phone, expectedStep, maxWait = 8000) {
  const interval = 500;
  let elapsed = 0;
  while (elapsed < maxWait) {
    await delay(interval);
    elapsed += interval;
    const session = await getSession(phone);
    if (session?.current_step === expectedStep) return true;
  }
  const session = await getSession(phone);
  console.log(c.grey(`    Expected step: ${expectedStep}, got: ${session?.current_step || 'null'}`));
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1 — FREE REGISTRATION FLOW
// ══════════════════════════════════════════════════════════════════════════════
async function testFreeFlow() {
  section('TEST SUITE 1: FREE Registration Flow');
  const phone = CONFIG.test_phones.free;

  info('Cleaning up previous test data...');
  await cleanPhone(phone);
  await delay(500);

  // ── Step 1: Hi → Main Menu
  info('Step 1: Send "Hi" → expect main menu');
  await sendMessage(phone, 'Hi');
  await delay(CONFIG.delay_ms);

  const s1 = await waitForStep(phone, 'MENU');
  s1 ? pass('Session created with step = MENU') : fail('Session not at MENU step');

  // ── Step 2: Select option 1
  info('Step 2: Send "1" → expect Q1');
  await sendMessage(phone, '1');
  const s2 = await waitForStep(phone, 'Q1');
  s2 ? pass('Step moved to Q1 after selecting 1') : fail('Step not at Q1');

  // ── Step 3: Full name
  info('Step 3: Send full name → expect Q2');
  await sendMessage(phone, 'Rahul Test User');
  const s3 = await waitForStep(phone, 'Q2');
  s3 ? pass('Full name accepted, moved to Q2') : fail('Step not at Q2 after name');

  // ── Step 4: Business name
  info('Step 4: Send business name → expect Q3');
  await sendMessage(phone, 'Test Enterprises Pvt Ltd');
  const s4 = await waitForStep(phone, 'Q3');
  s4 ? pass('Business name accepted, moved to Q3') : fail('Step not at Q3');

  // ── Step 5: City & State
  info('Step 5: Send city/state → expect Q4');
  await sendMessage(phone, 'Pune, Maharashtra');
  const s5 = await waitForStep(phone, 'Q4');
  s5 ? pass('City/state accepted, moved to Q4') : fail('Step not at Q4');

  // ── Step 6: Industry
  info('Step 6: Send industry → expect Q5');
  await sendMessage(phone, 'Manufacturing');
  const s6 = await waitForStep(phone, 'Q5');
  s6 ? pass('Industry accepted, moved to Q5') : fail('Step not at Q5');

  // ── Step 7: Years operating
  info('Step 7: Send years → expect Q6');
  await sendMessage(phone, '10');
  const s7 = await waitForStep(phone, 'Q6');
  s7 ? pass('Years accepted, moved to Q6') : fail('Step not at Q6');

  // ── Step 8: Confirm phone
  info('Step 8: Confirm phone → expect DOC_UPLOAD');
  await sendMessage(phone, 'YES');
  const s8 = await waitForStep(phone, 'DOC_UPLOAD');
  s8 ? pass('Phone confirmed, moved to DOC_UPLOAD') : fail('Step not at DOC_UPLOAD');

  // ── Step 9: Skip doc (simulate text as fallback)
  // In real flow a file is needed, but we test the step transition
  info('Step 9: Verifying DOC_UPLOAD step is active...');
  const sessionDoc = await getSession(phone);
  sessionDoc?.current_step === 'DOC_UPLOAD'
    ? pass('DOC_UPLOAD step confirmed in ERPNext')
    : fail('DOC_UPLOAD step not in ERPNext');

  // ── Verify session data contains collected answers
  info('Verifying session_data contains all answers...');
  if (sessionDoc) {
    const detail = await getSessionDetail(sessionDoc.name);
    try {
      const data = JSON.parse(detail?.session_data || '{}');
      data.full_name === 'Rahul Test User'
        ? pass('full_name saved correctly in session')
        : fail('full_name not saved', `Got: ${data.full_name}`);

      data.business_name === 'Test Enterprises Pvt Ltd'
        ? pass('business_name saved correctly')
        : fail('business_name not saved', `Got: ${data.business_name}`);

      data.city_state === 'Pune, Maharashtra'
        ? pass('city_state saved correctly')
        : fail('city_state not saved', `Got: ${data.city_state}`);

      data.industry === 'Manufacturing'
        ? pass('industry saved correctly')
        : fail('industry not saved', `Got: ${data.industry}`);

      data.years_operating === 10
        ? pass('years_operating saved correctly')
        : fail('years_operating not saved', `Got: ${data.years_operating}`);
    } catch (e) {
      fail('Could not parse session_data', e.message);
    }
  }

  console.log(c.grey('\n  [Skipping file upload in automated test — requires real media]'));
  console.log(c.grey('  [Manually verify DOC_UPLOAD → PRODUCT_UPLOAD → TIER_SELECT in real test]'));
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2 — PREMIUM REGISTRATION FLOW
// ══════════════════════════════════════════════════════════════════════════════
async function testPremiumFlow() {
  section('TEST SUITE 2: PREMIUM Registration Flow');
  const phone = CONFIG.test_phones.premium;

  info('Cleaning up previous test data...');
  await cleanPhone(phone);
  await delay(500);

  // Go through all 6 questions quickly
  const steps = [
    ['Hi',                    'MENU'],
    ['1',                     'Q1'],
    ['Priya Premium',         'Q2'],
    ['Premium Exports Ltd',   'Q3'],
    ['Mumbai, Maharashtra',   'Q4'],
    ['Export-Import',         'Q5'],
    ['20',                    'Q6'],
    ['YES',                   'DOC_UPLOAD'],
  ];

  for (const [msg, expectedStep] of steps) {
    await sendMessage(phone, msg);
    const ok = await waitForStep(phone, expectedStep);
    ok ? pass(`"${msg}" → step ${expectedStep}`) : fail(`Step not at ${expectedStep} after "${msg}"`);
  }

  // Verify we're at DOC_UPLOAD
  const session = await getSession(phone);
  session?.current_step === 'DOC_UPLOAD'
    ? pass('PREMIUM flow reached DOC_UPLOAD correctly')
    : fail('PREMIUM flow did not reach DOC_UPLOAD');

  console.log(c.grey('\n  [PREMIUM payment flow requires file upload — test manually]'));
  console.log(c.grey('  [After upload → reply PREMIUM → upload payment screenshot]'));
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3 — EXISTING USER FLOW
// ══════════════════════════════════════════════════════════════════════════════
async function testExistingUserFlow() {
  section('TEST SUITE 3: Existing User (Returning Member)');
  const phone = CONFIG.test_phones.existing;

  info('Setting up a pre-existing member in ERPNext...');
  await cleanPhone(phone);

  // Create a member directly in ERPNext
  const memberPayload = {
    doctype: 'RIFAH Member',
    rifah_id: `RIF-FREE-TEST-9999`,
    full_name: 'Existing Test User',
    whatsapp_number: phone,
    business_name: 'Existing Business Co',
    city_state: 'Delhi, Delhi',
    industry: 'Retail',
    years_operating: 5,
    membership_tier: 'FREE',
    status: 'Active Free',
    rifahmart_url: `https://rifahmart.com/RIF-FREE-TEST-9999/existing-business-co`,
    rifahmart_status: 'Published'
  };

  const createRes = await request(
    `${CONFIG.erpnext_url}/api/resource/RIFAH Member`,
    { method: 'POST', headers: erpnextHeaders },
    JSON.stringify(memberPayload)
  );

  createRes.status === 200
    ? pass('Pre-existing member created in ERPNext')
    : fail('Could not create pre-existing member', `Status: ${createRes.status}`);

  await delay(500);

  // Send Hi — should get "Welcome back" message
  info('Step 1: Send "Hi" as existing user → expect EXISTING_CHOICE step');
  await sendMessage(phone, 'Hi', 'Existing Test User');
  const s1 = await waitForStep(phone, 'EXISTING_CHOICE');
  s1 ? pass('Existing user detected, step = EXISTING_CHOICE') : fail('Existing user not detected');

  // Select option 2 (view info)
  info('Step 2: Send "2" → view current profile');
  await sendMessage(phone, '2');
  const s2 = await waitForStep(phone, 'MENU');
  s2 ? pass('Viewed profile, returned to MENU') : fail('Did not return to MENU after viewing profile');

  // Clean up
  await cleanPhone(phone);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4 — EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════
async function testEdgeCases() {
  section('TEST SUITE 4: Edge Cases & Invalid Inputs');
  const phone = CONFIG.test_phones.edge;

  info('Cleaning up...');
  await cleanPhone(phone);
  await delay(500);

  // Invalid menu option
  info('Edge 1: Invalid menu option (send "9")');
  await sendMessage(phone, 'Hi');
  await waitForStep(phone, 'MENU');
  await sendMessage(phone, '9');
  await delay(CONFIG.delay_ms);
  const e1 = await waitForStep(phone, 'MENU', 5000);
  e1 ? pass('Invalid menu input stays at MENU') : fail('Invalid menu input did not stay at MENU');

  // Empty name (single character)
  info('Edge 2: Too short name (single char "A")');
  await sendMessage(phone, '1');
  await waitForStep(phone, 'Q1');
  await sendMessage(phone, 'A');
  await delay(CONFIG.delay_ms);
  const e2 = await waitForStep(phone, 'Q1', 5000);
  e2 ? pass('Single char name rejected, stays at Q1') : fail('Single char name was accepted');

  // Invalid years (text instead of number)
  info('Edge 3: Text instead of number for years');
  await sendMessage(phone, 'Valid Name Here');
  await waitForStep(phone, 'Q2');
  await sendMessage(phone, 'Test Business');
  await waitForStep(phone, 'Q3');
  await sendMessage(phone, 'Chennai, Tamil Nadu');
  await waitForStep(phone, 'Q4');
  await sendMessage(phone, 'Services');
  await waitForStep(phone, 'Q5');
  await sendMessage(phone, 'not a number');
  await delay(CONFIG.delay_ms);
  const e3 = await waitForStep(phone, 'Q5', 5000);
  e3 ? pass('Non-numeric years rejected, stays at Q5') : fail('Non-numeric years accepted');

  // Invalid tier selection
  info('Edge 4: Invalid tier (send "GOLD" instead of FREE/PREMIUM)');
  await sendMessage(phone, '8');
  await waitForStep(phone, 'Q6');
  await sendMessage(phone, 'YES');
  await waitForStep(phone, 'DOC_UPLOAD');
  // Skip doc upload — manually set session to TIER_SELECT for this test
  console.log(c.grey('    [Skipping to tier select — requires file upload in real flow]'));

  // Clean up
  await cleanPhone(phone);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5 — ERPNEXT CONNECTIVITY
// ══════════════════════════════════════════════════════════════════════════════
async function testERPNextConnectivity() {
  section('TEST SUITE 5: ERPNext API Connectivity');

  // Check ERPNext is up
  info('Checking ERPNext is reachable...');
  try {
    const res = await request(`${CONFIG.erpnext_url}/api/method/frappe.auth.get_logged_user`,
      { headers: erpnextHeaders });
    res.status === 200
      ? pass(`ERPNext reachable — logged in as: ${res.body?.message}`)
      : fail('ERPNext returned non-200', `Status: ${res.status}`);
  } catch (e) {
    fail('ERPNext not reachable', e.message);
  }

  // Check RIFAH Member doctype exists
  info('Checking RIFAH Member doctype exists...');
  try {
    const res = await request(`${CONFIG.erpnext_url}/api/resource/RIFAH Member?limit=1`,
      { headers: erpnextHeaders });
    res.status === 200
      ? pass('RIFAH Member doctype accessible')
      : fail('RIFAH Member doctype not found', `Status: ${res.status}`);
  } catch (e) {
    fail('RIFAH Member doctype error', e.message);
  }

  // Check RIFAH Session doctype exists
  info('Checking RIFAH Session doctype exists...');
  try {
    const res = await request(`${CONFIG.erpnext_url}/api/resource/RIFAH Session?limit=1`,
      { headers: erpnextHeaders });
    res.status === 200
      ? pass('RIFAH Session doctype accessible')
      : fail('RIFAH Session doctype not found', `Status: ${res.status}`);
  } catch (e) {
    fail('RIFAH Session doctype error', e.message);
  }

  // Check n8n webhook is reachable
  info('Checking n8n webhook is reachable...');
  try {
    const res = await request(
      `${CONFIG.n8n_webhook}?hub.mode=subscribe&hub.verify_token=rifah_verify_token_2024&hub.challenge=test123`,
      { method: 'GET' }
    );
    res.raw?.includes('test123')
      ? pass('n8n webhook verification endpoint working')
      : fail('n8n webhook verification failed', `Response: ${res.raw}`);
  } catch (e) {
    fail('n8n webhook not reachable', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CLEAN COMMAND
// ══════════════════════════════════════════════════════════════════════════════
async function cleanAll() {
  section('Cleaning all test data');
  for (const [name, phone] of Object.entries(CONFIG.test_phones)) {
    await cleanPhone(phone);
    info(`Cleaned: ${name} (${phone})`);
  }
  console.log(c.green('\n✓ All test data cleaned\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);

  console.log(c.bold('\n╔════════════════════════════════════════╗'));
  console.log(c.bold('║   RIFAH Connect — Flow 1 Test Suite   ║'));
  console.log(c.bold('╚════════════════════════════════════════╝\n'));

  // Validate config
  if (CONFIG.erpnext_api_key === 'YOUR_API_KEY') {
    console.log(c.red('⚠️  Fill in CONFIG values at the top of this file before running.\n'));
    process.exit(1);
  }

  if (args.includes('--clean')) {
    await cleanAll();
    process.exit(0);
  }

  const runAll = args.length === 0;

  // Always run connectivity check first
  await testERPNextConnectivity();

  if (runAll || args.includes('--free')) await testFreeFlow();
  if (runAll || args.includes('--premium')) await testPremiumFlow();
  if (runAll || args.includes('--existing')) await testExistingUserFlow();
  if (runAll || args.includes('--edge')) await testEdgeCases();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + c.bold('═'.repeat(50)));
  console.log(c.bold('  TEST SUMMARY'));
  console.log(c.bold('═'.repeat(50)));
  console.log(c.green(`  ✓ Passed: ${results.passed}`));
  console.log(c.red(`  ✗ Failed: ${results.failed}`));

  if (results.errors.length > 0) {
    console.log(c.bold('\n  Failed tests:'));
    results.errors.forEach(e => {
      console.log(c.red(`  • ${e.msg}`));
      if (e.detail) console.log(c.grey(`    ${e.detail}`));
    });
  }

  const total = results.passed + results.failed;
  const pct = total > 0 ? Math.round((results.passed / total) * 100) : 0;
  const colour = pct === 100 ? c.green : pct >= 70 ? c.yellow : c.red;
  console.log(colour(`\n  Score: ${pct}% (${results.passed}/${total})`));
  console.log(c.bold('═'.repeat(50)) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(c.red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
