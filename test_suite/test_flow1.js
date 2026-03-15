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
 *   node test_flow1.js --existing   → existing user test
 *   node test_flow1.js --edge       → edge case tests only
 *   node test_flow1.js --product    → product upload tests only
 *   node test_flow1.js --clean      → wipe test data and exit
 */

const https = require('https');
const http = require('http');

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  n8n_webhook: 'http://localhost:5678/webhook/whatsapp-webhook',
  erpnext_url: 'http://localhost:8080',
  erpnext_api_key: '0e4bdd6485daf14',
  erpnext_api_secret: 'f7219377d052ff5',
  meta_phone_number_id: '1051021614753488',
  delay_ms: 1500,
  test_phones: {
    free:     '919000000001',
    premium:  '919000000002',
    existing: '919000000003',
    edge:     '919000000004',
    product:  '919000000005',
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

// ── SEND FAKE WHATSAPP TEXT MESSAGE ──────────────────────────────────────────
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

// ── SEND FAKE WHATSAPP MEDIA MESSAGE ─────────────────────────────────────────
async function sendMediaMessage(phone, mediaType, mediaId, filename, mimeType, name = 'Test User') {
  const mediaField = mediaType === 'image'
    ? { image: { id: mediaId, mime_type: mimeType || 'image/jpeg' } }
    : { document: { id: mediaId, filename: filename || 'test_doc.pdf', mime_type: mimeType || 'application/pdf' } };

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
            type: mediaType,
            ...mediaField
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
    console.log(c.grey(`    [${phone}] sent media (${mediaType}, id=${mediaId}) → HTTP ${res.status}`));
    return res;
  } catch (err) {
    console.log(c.red(`    [${phone}] failed to send media: ${err.message}`));
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

// ── HELPER: Walk through Q1–Q6 to DOC_UPLOAD ─────────────────────────────────
async function walkToDocUpload(phone) {
  const steps = [
    ['Hi',                    'MENU'],
    ['1',                     'Q1'],
    ['Rahul Test User',       'Q2'],
    ['Test Enterprises Ltd',  'Q3'],
    ['Pune, Maharashtra',     'Q4'],
    ['Manufacturing',         'Q5'],
    ['10',                    'Q6'],
    ['YES',                   'DOC_UPLOAD'],
  ];
  for (const [msg, step] of steps) {
    await sendMessage(phone, msg);
    const ok = await waitForStep(phone, step);
    if (!ok) return false;
  }
  return true;
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

  // ── Steps 1–8: Hi → through Q1–Q6 → DOC_UPLOAD
  info('Step 1: Send "Hi" → expect main menu');
  await sendMessage(phone, 'Hi');
  await delay(CONFIG.delay_ms);
  const s1 = await waitForStep(phone, 'MENU');
  s1 ? pass('Session created with step = MENU') : fail('Session not at MENU step');

  info('Step 2: Send "1" → expect Q1');
  await sendMessage(phone, '1');
  const s2 = await waitForStep(phone, 'Q1');
  s2 ? pass('Step moved to Q1 after selecting 1') : fail('Step not at Q1');

  info('Step 3: Send full name → expect Q2');
  await sendMessage(phone, 'Rahul Test User');
  const s3 = await waitForStep(phone, 'Q2');
  s3 ? pass('Full name accepted, moved to Q2') : fail('Step not at Q2 after name');

  info('Step 4: Send business name → expect Q3');
  await sendMessage(phone, 'Test Enterprises Pvt Ltd');
  const s4 = await waitForStep(phone, 'Q3');
  s4 ? pass('Business name accepted, moved to Q3') : fail('Step not at Q3');

  info('Step 5: Send city/state → expect Q4');
  await sendMessage(phone, 'Pune, Maharashtra');
  const s5 = await waitForStep(phone, 'Q4');
  s5 ? pass('City/state accepted, moved to Q4') : fail('Step not at Q4');

  info('Step 6: Send industry → expect Q5');
  await sendMessage(phone, 'Manufacturing');
  const s6 = await waitForStep(phone, 'Q5');
  s6 ? pass('Industry accepted, moved to Q5') : fail('Step not at Q5');

  info('Step 7: Send years → expect Q6');
  await sendMessage(phone, '10');
  const s7 = await waitForStep(phone, 'Q6');
  s7 ? pass('Years accepted, moved to Q6') : fail('Step not at Q6');

  info('Step 8: Confirm phone → expect DOC_UPLOAD');
  await sendMessage(phone, 'YES');
  const s8 = await waitForStep(phone, 'DOC_UPLOAD');
  s8 ? pass('Phone confirmed, moved to DOC_UPLOAD') : fail('Step not at DOC_UPLOAD');

  // ── Verify session_data contains all collected answers
  info('Verifying session_data contains all answers...');
  const sessionDoc = await getSession(phone);
  sessionDoc?.current_step === 'DOC_UPLOAD'
    ? pass('DOC_UPLOAD step confirmed in ERPNext')
    : fail('DOC_UPLOAD step not in ERPNext');

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

  // ── Step 9: Send fake doc media → PRODUCT_UPLOAD (tests download_doc action)
  info('Step 9: Send fake document → expect PRODUCT_UPLOAD');
  await sendMediaMessage(phone, 'document', 'fake_doc_media_id_001', 'udyam_cert.pdf', 'application/pdf');
  const s9 = await waitForStep(phone, 'PRODUCT_UPLOAD', 10000);
  s9 ? pass('Document accepted, moved to PRODUCT_UPLOAD') : fail('Step not at PRODUCT_UPLOAD after doc upload');

  // ── Step 10: SKIP product upload → TIER_SELECT
  info('Step 10: Send "SKIP" → expect TIER_SELECT');
  await sendMessage(phone, 'SKIP');
  const s10 = await waitForStep(phone, 'TIER_SELECT');
  s10 ? pass('Skipped product upload, moved to TIER_SELECT') : fail('Step not at TIER_SELECT after SKIP');

  // ── Step 11: Select FREE → PROCESSING (interim message now sent)
  info('Step 11: Send "FREE" → expect PROCESSING (interim "Processing..." message sent)');
  await sendMessage(phone, 'FREE');
  const s11 = await waitForStep(phone, 'PROCESSING', 5000);
  s11 ? pass('FREE selected, session moved to PROCESSING') : fail('Session not at PROCESSING after FREE');

  // ── Step 12: Wait for ERPNext member creation + session COMPLETED
  info('Step 12: Wait for ERPNext creation and session reset to COMPLETED...');
  const s12 = await waitForStep(phone, 'COMPLETED', 15000);
  s12 ? pass('Session reset to COMPLETED after member creation') : fail('Session did not reach COMPLETED');

  // ── Step 13: Verify ERPNext member was created with correct data
  info('Step 13: Verifying RIFAH Member created in ERPNext...');
  const member = await getMember(phone);
  member
    ? pass(`Member created: ${member.rifah_id || member.name}`)
    : fail('No RIFAH Member found in ERPNext after FREE registration');

  if (member) {
    const detail = await getMemberDetail(member.name);
    detail?.membership_tier === 'FREE'
      ? pass('membership_tier = FREE')
      : fail('membership_tier incorrect', `Got: ${detail?.membership_tier}`);

    detail?.full_name === 'Rahul Test User'
      ? pass('full_name correct on member doc')
      : fail('full_name incorrect on member', `Got: ${detail?.full_name}`);

    (detail?.rifah_id || '').startsWith('RIF-FREE-')
      ? pass(`RIFAH ID has correct prefix: ${detail.rifah_id}`)
      : fail('RIFAH ID prefix incorrect', `Got: ${detail?.rifah_id}`);

    (detail?.rifahmart_url || '').includes('rifahmart.com')
      ? pass('RifahMart URL generated')
      : fail('RifahMart URL missing', `Got: ${detail?.rifahmart_url}`);
  }

  // ── Step 14: Returning user after COMPLETED → EXISTING_CHOICE
  info('Step 14: Send "Hi" again after COMPLETED → expect EXISTING_CHOICE');
  await sendMessage(phone, 'Hi');
  const s14 = await waitForStep(phone, 'EXISTING_CHOICE', 8000);
  s14 ? pass('Returning user after COMPLETED gets EXISTING_CHOICE') : fail('Returning user flow broken after COMPLETED');
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

  // Go through all 6 questions
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

  // Simulate doc upload → PRODUCT_UPLOAD
  info('Sending fake business doc → expect PRODUCT_UPLOAD');
  await sendMediaMessage(phone, 'document', 'fake_doc_media_id_002', 'gst_cert.pdf', 'application/pdf');
  const sDoc = await waitForStep(phone, 'PRODUCT_UPLOAD', 10000);
  sDoc ? pass('Doc accepted, moved to PRODUCT_UPLOAD (PREMIUM)') : fail('Step not at PRODUCT_UPLOAD (PREMIUM)');

  // Skip product upload → TIER_SELECT
  await sendMessage(phone, 'SKIP');
  const sTier = await waitForStep(phone, 'TIER_SELECT');
  sTier ? pass('Skipped product upload, at TIER_SELECT') : fail('Not at TIER_SELECT');

  // Select PREMIUM → PAYMENT_WAIT
  info('Send "PREMIUM" → expect PAYMENT_WAIT');
  await sendMessage(phone, 'PREMIUM');
  const sPay = await waitForStep(phone, 'PAYMENT_WAIT');
  sPay ? pass('PREMIUM selected, moved to PAYMENT_WAIT') : fail('Step not at PAYMENT_WAIT');

  // Send fake transaction ID → PAYMENT_PENDING
  info('Send fake UTR → expect PAYMENT_PENDING');
  await sendMessage(phone, 'UTR123456789');
  const sPending = await waitForStep(phone, 'PAYMENT_PENDING', 10000);
  sPending ? pass('Transaction ID accepted, moved to PAYMENT_PENDING') : fail('Step not at PAYMENT_PENDING');

  // Verify ERPNext premium member created
  info('Verifying PREMIUM member created in ERPNext...');
  await delay(2000);
  const member = await getMember(phone);
  member
    ? pass(`PREMIUM member created: ${member.rifah_id || member.name}`)
    : fail('No RIFAH Member found after PREMIUM registration');

  if (member) {
    const detail = await getMemberDetail(member.name);
    detail?.membership_tier === 'PREMIUM'
      ? pass('membership_tier = PREMIUM')
      : fail('membership_tier incorrect', `Got: ${detail?.membership_tier}`);

    detail?.status === 'Payment Uploaded'
      ? pass('status = Payment Uploaded')
      : fail('status incorrect', `Got: ${detail?.status}`);

    (detail?.rifah_id || '').startsWith('RIF-PREM-')
      ? pass(`RIFAH ID has correct prefix: ${detail.rifah_id}`)
      : fail('RIFAH ID prefix incorrect', `Got: ${detail?.rifah_id}`);

    // Verify password uses crypto hex (6 hex chars = 3 bytes)
    const pwd = detail?.dashboard_password || '';
    const hexSuffix = pwd.replace(/^RIFAH/, '');
    /^[0-9A-F]{6}$/.test(hexSuffix)
      ? pass('dashboard_password uses crypto hex (not Math.random)')
      : fail('dashboard_password format unexpected', `Got suffix: ${hexSuffix}`);
  }

  // PREMIUM session should stay at PAYMENT_PENDING (correct - not reset to COMPLETED)
  const finalSession = await getSession(phone);
  finalSession?.current_step === 'PAYMENT_PENDING'
    ? pass('PREMIUM session correctly stays at PAYMENT_PENDING (awaiting admin)')
    : fail('PREMIUM session at unexpected step', `Got: ${finalSession?.current_step}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3 — PRODUCT UPLOAD FLOW
// ══════════════════════════════════════════════════════════════════════════════
async function testProductUploadFlow() {
  section('TEST SUITE 3: Product Upload Flow');
  const phone = CONFIG.test_phones.product;

  info('Cleaning up previous test data...');
  await cleanPhone(phone);
  await delay(500);

  // Walk to DOC_UPLOAD
  info('Walking through Q1–Q6 to DOC_UPLOAD...');
  const reached = await walkToDocUpload(phone);
  reached ? pass('Reached DOC_UPLOAD step') : fail('Could not reach DOC_UPLOAD step');
  if (!reached) return;

  // Upload business doc → PRODUCT_UPLOAD
  info('Uploading business doc → expect PRODUCT_UPLOAD');
  await sendMediaMessage(phone, 'document', 'fake_biz_doc_001', 'udyam.pdf', 'application/pdf');
  const s1 = await waitForStep(phone, 'PRODUCT_UPLOAD', 10000);
  s1 ? pass('Business doc accepted, moved to PRODUCT_UPLOAD') : fail('Step not at PRODUCT_UPLOAD');

  // Verify doc_media_id saved in session_data
  info('Verifying doc_media_id saved in session...');
  const sess1 = await getSession(phone);
  if (sess1) {
    const detail = await getSessionDetail(sess1.name);
    const data = JSON.parse(detail?.session_data || '{}');
    data.doc_media_id === 'fake_biz_doc_001'
      ? pass('doc_media_id saved correctly in session')
      : fail('doc_media_id not saved', `Got: ${data.doc_media_id}`);
  }

  // Upload first product image → stays at PRODUCT_UPLOAD (uses download_doc action now)
  info('Uploading product image 1 → expect stay at PRODUCT_UPLOAD');
  await sendMediaMessage(phone, 'image', 'fake_prod_img_001', null, 'image/jpeg');
  const s2 = await waitForStep(phone, 'PRODUCT_UPLOAD', 10000);
  s2 ? pass('Product file 1 accepted, stays at PRODUCT_UPLOAD') : fail('Unexpected step after product file 1');

  // Verify product_materials accumulated
  info('Verifying product_materials[0] saved...');
  const sess2 = await getSession(phone);
  if (sess2) {
    const detail = await getSessionDetail(sess2.name);
    const data = JSON.parse(detail?.session_data || '{}');
    Array.isArray(data.product_materials) && data.product_materials.length === 1
      ? pass('product_materials has 1 entry after first upload')
      : fail('product_materials not saved correctly', `Got: ${JSON.stringify(data.product_materials)}`);

    data.product_materials?.[0]?.media_id === 'fake_prod_img_001'
      ? pass('product_materials[0].media_id correct')
      : fail('product_materials[0].media_id wrong', `Got: ${data.product_materials?.[0]?.media_id}`);
  }

  // Upload second product file → still PRODUCT_UPLOAD
  info('Uploading product file 2 → expect stay at PRODUCT_UPLOAD');
  await sendMediaMessage(phone, 'document', 'fake_prod_doc_002', 'catalog.pdf', 'application/pdf');
  const s3 = await waitForStep(phone, 'PRODUCT_UPLOAD', 10000);
  s3 ? pass('Product file 2 accepted, stays at PRODUCT_UPLOAD') : fail('Unexpected step after product file 2');

  // Verify 2 materials accumulated
  const sess3 = await getSession(phone);
  if (sess3) {
    const detail = await getSessionDetail(sess3.name);
    const data = JSON.parse(detail?.session_data || '{}');
    data.product_materials?.length === 2
      ? pass('product_materials has 2 entries after second upload')
      : fail('Expected 2 product_materials', `Got: ${data.product_materials?.length}`);
  }

  // Send DONE → TIER_SELECT
  info('Send "DONE" → expect TIER_SELECT');
  await sendMessage(phone, 'DONE');
  const s4 = await waitForStep(phone, 'TIER_SELECT');
  s4 ? pass('DONE accepted, moved to TIER_SELECT') : fail('Step not at TIER_SELECT after DONE');

  // Send invalid tier → stays at TIER_SELECT
  info('Send invalid tier "GOLD" → expect stay at TIER_SELECT');
  await sendMessage(phone, 'GOLD');
  await delay(CONFIG.delay_ms);
  const s5 = await waitForStep(phone, 'TIER_SELECT', 5000);
  s5 ? pass('Invalid tier "GOLD" rejected, stays at TIER_SELECT') : fail('GOLD tier was accepted');

  // Clean up
  await cleanPhone(phone);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4 — EXISTING USER FLOW
// ══════════════════════════════════════════════════════════════════════════════
async function testExistingUserFlow() {
  section('TEST SUITE 4: Existing User (Returning Member)');
  const phone = CONFIG.test_phones.existing;

  info('Setting up a pre-existing member in ERPNext...');
  await cleanPhone(phone);

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

  // Send Hi → EXISTING_CHOICE
  info('Step 1: Send "Hi" as existing user → expect EXISTING_CHOICE');
  await sendMessage(phone, 'Hi', 'Existing Test User');
  const s1 = await waitForStep(phone, 'EXISTING_CHOICE');
  s1 ? pass('Existing user detected, step = EXISTING_CHOICE') : fail('Existing user not detected');

  // Select option 2 (view info) → MENU
  info('Step 2: Send "2" → view profile → MENU');
  await sendMessage(phone, '2');
  const s2 = await waitForStep(phone, 'MENU');
  s2 ? pass('Viewed profile, returned to MENU') : fail('Did not return to MENU after viewing profile');

  // Send Hi again → EXISTING_CHOICE (member still exists)
  info('Step 3: Send "Hi" again → expect EXISTING_CHOICE again');
  await sendMessage(phone, 'Hi');
  const s3 = await waitForStep(phone, 'EXISTING_CHOICE');
  s3 ? pass('Second "Hi" correctly shows EXISTING_CHOICE') : fail('Second "Hi" did not return EXISTING_CHOICE');

  // Select option 1 (update) → Q1
  info('Step 4: Send "1" → start profile update → Q1');
  await sendMessage(phone, '1');
  const s4 = await waitForStep(phone, 'Q1');
  s4 ? pass('Update flow started, moved to Q1') : fail('Update flow did not move to Q1');

  // Verify is_update flag
  info('Verifying is_update flag set in session_data...');
  const sess = await getSession(phone);
  if (sess) {
    const detail = await getSessionDetail(sess.name);
    const data = JSON.parse(detail?.session_data || '{}');
    data.is_update === true
      ? pass('is_update flag set correctly')
      : fail('is_update flag not set', `Got: ${data.is_update}`);
  }

  // Invalid option at EXISTING_CHOICE
  info('Step 5: Send invalid option "9" at EXISTING_CHOICE');
  await sendMessage(phone, 'Hi');
  await waitForStep(phone, 'EXISTING_CHOICE');
  await sendMessage(phone, '9');
  await delay(CONFIG.delay_ms);
  const s5 = await waitForStep(phone, 'EXISTING_CHOICE', 5000);
  s5 ? pass('Invalid option stays at EXISTING_CHOICE') : fail('Invalid option moved away from EXISTING_CHOICE');

  // Clean up
  await cleanPhone(phone);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5 — EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════
async function testEdgeCases() {
  section('TEST SUITE 5: Edge Cases & Invalid Inputs');
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

  // Single character name
  info('Edge 2: Too short name (single char "A")');
  await sendMessage(phone, '1');
  await waitForStep(phone, 'Q1');
  await sendMessage(phone, 'A');
  await delay(CONFIG.delay_ms);
  const e2 = await waitForStep(phone, 'Q1', 5000);
  e2 ? pass('Single char name rejected, stays at Q1') : fail('Single char name was accepted');

  // Text instead of number for years
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

  // Out-of-range years (999)
  info('Edge 4: Out-of-range years (999)');
  await sendMessage(phone, '999');
  await delay(CONFIG.delay_ms);
  const e4 = await waitForStep(phone, 'Q5', 5000);
  e4 ? pass('Out-of-range years (999) rejected, stays at Q5') : fail('Out-of-range years (999) accepted');

  // Valid years → Q6
  await sendMessage(phone, '8');
  await waitForStep(phone, 'Q6');

  // Invalid phone confirmation
  info('Edge 5: Invalid phone confirmation (random text)');
  await sendMessage(phone, 'nope');
  await delay(CONFIG.delay_ms);
  const e5 = await waitForStep(phone, 'Q6', 5000);
  e5 ? pass('Invalid phone confirmation rejected, stays at Q6') : fail('Invalid phone confirmation accepted');

  // YES → DOC_UPLOAD
  await sendMessage(phone, 'YES');
  await waitForStep(phone, 'DOC_UPLOAD');

  // Text message at DOC_UPLOAD (no media) → stays at DOC_UPLOAD
  info('Edge 6: Text at DOC_UPLOAD (no media) → stays at DOC_UPLOAD');
  await sendMessage(phone, 'here is my doc');
  await delay(CONFIG.delay_ms);
  const e6 = await waitForStep(phone, 'DOC_UPLOAD', 5000);
  e6 ? pass('Text at DOC_UPLOAD rejected, stays at DOC_UPLOAD') : fail('Text at DOC_UPLOAD moved to wrong step');

  // Clean up
  await cleanPhone(phone);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6 — ERPNEXT CONNECTIVITY
// ══════════════════════════════════════════════════════════════════════════════
async function testERPNextConnectivity() {
  section('TEST SUITE 6: ERPNext API Connectivity');

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

  // Verify token uses env var fallback
  info('Checking n8n webhook verification endpoint (tests env var fallback token)...');
  try {
    const res = await request(
      `${CONFIG.n8n_webhook}?hub.mode=subscribe&hub.verify_token=rifah_verify_token_2024&hub.challenge=test123`,
      { method: 'GET' }
    );
    res.raw?.includes('test123')
      ? pass('n8n webhook verification endpoint working (env var fallback token OK)')
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

  if (runAll || args.includes('--free'))     await testFreeFlow();
  if (runAll || args.includes('--premium'))  await testPremiumFlow();
  if (runAll || args.includes('--product'))  await testProductUploadFlow();
  if (runAll || args.includes('--existing')) await testExistingUserFlow();
  if (runAll || args.includes('--edge'))     await testEdgeCases();

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
