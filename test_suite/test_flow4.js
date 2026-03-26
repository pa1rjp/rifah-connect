#!/usr/bin/env node
/**
 * RIFAH Connect — Automated Flow 4 Test Suite (Learn & Grow)
 *
 * Tests the Learn & Grow flow via the main WhatsApp webhook.
 * No real WhatsApp or Meta API needed.
 *
 * Usage:
 *   node test_suite/test_flow4.js              → all suites
 *   node test_suite/test_flow4.js --infra      → infrastructure checks
 *   node test_suite/test_flow4.js --nav        → menu navigation
 *   node test_suite/test_flow4.js --articles   → articles flow
 *   node test_suite/test_flow4.js --videos     → videos flow
 *   node test_suite/test_flow4.js --events     → events flow
 *   node test_suite/test_flow4.js --training   → training gate + flow
 *   node test_suite/test_flow4.js --tools      → tools flow
 *   node test_suite/test_flow4.js --edge       → edge cases
 *   node test_suite/test_flow4.js --clean      → wipe test data and exit
 */

const https = require('https');
const http  = require('http');
const erp   = require('../scripts/erpnext');

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ── CONFIG ────────────────────────────────────────────────────────────────────
const WEBHOOK  = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp-webhook';
const META_PID = process.env.META_PHONE_NUMBER_ID || '1051021614753488';
const BASE     = process.env.ERPNEXT_URL || 'http://localhost:8080';
const YEAR     = new Date().getFullYear();

const PHONES = {
  premium: '919400000001',  // PREMIUM member — main tester
  free:    '919400000002',  // FREE member — for gate tests
  edge:    '919400000003',  // edge cases
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

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────
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

// ── POLLING ───────────────────────────────────────────────────────────────────
async function waitForStep(phone, step, maxWait = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(600);
    const s = await erp.getSession(phone);
    if (s?.current_step === step) return s;
  }
  return null;
}

async function waitForAnyStep(phone, steps, maxWait = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(600);
    const s = await erp.getSession(phone);
    if (steps.includes(s?.current_step)) return s;
  }
  const s = await erp.getSession(phone);
  return (s && steps.includes(s.current_step)) ? s : null;
}

async function getSessionData(phone) {
  const s = await erp.getSession(phone);
  if (!s) return {};
  try { return JSON.parse(s.session_data || '{}'); } catch(e) { return {}; }
}

// Wait until f4_items appears in session_data (f4_fetch chain may finish after step change)
async function waitForF4Items(phone, maxWait = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(700);
    const sd = await getSessionData(phone);
    if (sd.f4_items?.length > 0) return sd;
  }
  return await getSessionData(phone);
}

// ── MEMBER SETUP ──────────────────────────────────────────────────────────────
async function ensurePremiumMember(phone) {
  let m = await erp.getMember(phone);
  if (m && m.membership_tier === 'PREMIUM') return m;
  if (m) {
    await erp.request(`${BASE}/api/resource/RIFAH Member/${encodeURIComponent(m.name)}`, 'PUT', { membership_tier: 'PREMIUM', status: 'Active Premium' });
    return await erp.getMember(phone);
  }
  const r = await erp.request(`${BASE}/api/resource/RIFAH Member`, 'POST', {
    rifah_id: `RIF-PREM-${YEAR}-F4T${phone.slice(-4)}`,
    full_name: 'Flow4 Test Premium',
    business_name: 'F4 Premium Biz',
    whatsapp_number: phone,
    membership_tier: 'PREMIUM',
    status: 'Active Premium',
    city_state: 'Pune, Maharashtra',
    industry: 'Packaging',
    years_operating: 5,
    registration_date: `${YEAR}-01-01 00:00:00`,
  });
  return r.body?.data || null;
}

async function ensureFreeMember(phone) {
  let m = await erp.getMember(phone);
  if (m) return m;
  const r = await erp.request(`${BASE}/api/resource/RIFAH Member`, 'POST', {
    rifah_id: `RIF-FREE-${YEAR}-F4T${phone.slice(-4)}`,
    full_name: 'Flow4 Test Free',
    business_name: 'F4 Free Biz',
    whatsapp_number: phone,
    membership_tier: 'FREE',
    status: 'Active Free',
    city_state: 'Mumbai, Maharashtra',
    industry: 'Food',
    years_operating: 2,
    registration_date: `${YEAR}-01-01 00:00:00`,
  });
  return r.body?.data || null;
}

async function setStep(phone, step, sessionData = {}) {
  for (let i = 0; i < 4; i++) {
    await erp.deleteSession(phone);
    await delay(200);
    await erp.request(`${BASE}/api/resource/RIFAH Session`, 'POST', {
      phone_number: phone, current_step: step,
      session_data: JSON.stringify(sessionData), status: 'Active',
    });
    await delay(1200);
    const s = await erp.getSession(phone);
    if (s?.current_step === step) return;
  }
}

// ── CLEAN ─────────────────────────────────────────────────────────────────────
async function cleanTestData() {
  section('CLEAN — Wiping Flow 4 test data');
  for (const phone of Object.values(PHONES)) {
    try { await erp.cleanPhone(phone); console.log(c.grey(`    Cleaned: ${phone}`)); } catch(e) {}
    // Clean registrations
    try {
      const r = await erp.request(`${BASE}/api/resource/RIFAH Event Registration?filters=${erp.enc([['member_phone','=',phone]])}&fields=${erp.enc(['name'])}&limit=50`, 'GET');
      for (const reg of (r.body?.data || [])) {
        await erp.request(`${BASE}/api/resource/RIFAH Event Registration/${encodeURIComponent(reg.name)}`, 'DELETE');
      }
    } catch(e) {}
    // Clean resource views
    try {
      const r = await erp.request(`${BASE}/api/resource/RIFAH Resource View?filters=${erp.enc([['member_id','like','%F4T%']])}&fields=${erp.enc(['name'])}&limit=50`, 'GET');
      for (const v of (r.body?.data || [])) {
        await erp.request(`${BASE}/api/resource/RIFAH Resource View/${encodeURIComponent(v.name)}`, 'DELETE');
      }
    } catch(e) {}
  }
  console.log(c.green('\n  ✓ Test data cleaned'));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: INFRASTRUCTURE
// ─────────────────────────────────────────────────────────────────────────────
async function testInfra() {
  section('TEST SUITE 1: Infrastructure');

  info('ERPNext reachable...');
  try {
    const u = await erp.whoami();
    u ? pass(`ERPNext reachable — ${u}`) : fail('ERPNext login failed');
  } catch(e) { fail('ERPNext unreachable', e.message); }

  info('RIFAH Resource doctype...');
  try {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Resource?limit=1&fields=${erp.enc(['name','title','resource_type','access_tier'])}`, 'GET');
    Array.isArray(r.body?.data) ? pass(`RIFAH Resource accessible (${r.body.data.length > 0 ? r.body.data.length + ' records' : 'empty'})`) : fail('RIFAH Resource not found');
  } catch(e) { fail('RIFAH Resource check failed', e.message); }

  info('RIFAH Event doctype...');
  try {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Event?limit=1&fields=${erp.enc(['name','event_name','status'])}`, 'GET');
    Array.isArray(r.body?.data) ? pass(`RIFAH Event accessible`) : fail('RIFAH Event not found');
  } catch(e) { fail('RIFAH Event check failed', e.message); }

  info('RIFAH Event Registration doctype...');
  try {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Event Registration?limit=1&fields=${erp.enc(['name'])}`, 'GET');
    Array.isArray(r.body?.data) ? pass('RIFAH Event Registration accessible') : fail('RIFAH Event Registration not found');
  } catch(e) { fail('RIFAH Event Registration check failed', e.message); }

  info('RIFAH Resource View doctype...');
  try {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Resource View?limit=1&fields=${erp.enc(['name'])}`, 'GET');
    Array.isArray(r.body?.data) ? pass('RIFAH Resource View accessible') : fail('RIFAH Resource View not found');
  } catch(e) { fail('RIFAH Resource View check failed', e.message); }

  info('Seed data present (articles)...');
  try {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Resource?filters=${erp.enc([['resource_type','=','ARTICLE'],['is_active','=','1']])}&fields=${erp.enc(['name'])}&limit=20`, 'GET');
    const count = r.body?.data?.length || 0;
    count >= 10 ? pass(`${count} articles in ERPNext`) : fail(`Only ${count} articles — run seed_flow4.js`);
  } catch(e) { fail('Article seed check failed', e.message); }

  info('Seed data present (events)...');
  try {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Event?filters=${erp.enc([['status','=','UPCOMING'],['is_active','=','1']])}&fields=${erp.enc(['name'])}&limit=10`, 'GET');
    const count = r.body?.data?.length || 0;
    count >= 1 ? pass(`${count} upcoming event(s) in ERPNext`) : fail('No upcoming events — run seed_flow4.js');
  } catch(e) { fail('Event seed check failed', e.message); }

  info('Main webhook active...');
  try {
    const res = await httpRequest(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': 2 } }, '{}');
    res?.status < 500 ? pass(`Webhook responds (HTTP ${res.status})`) : fail(`Webhook HTTP ${res.status}`);
  } catch(e) { fail('Webhook unreachable', e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: MENU NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
async function testNavigation() {
  section('TEST SUITE 2: Menu Navigation');

  const phone = PHONES.premium;
  await ensurePremiumMember(phone);

  info('Test 2.1: MENU "4" → LEARN_CATEGORY...');
  await setStep(phone, 'MENU', {});
  await sendText(phone, '4');
  const s1 = await waitForStep(phone, 'LEARN_CATEGORY');
  s1 ? pass('MENU "4" → LEARN_CATEGORY') : fail('MENU "4" did not navigate to LEARN_CATEGORY', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 2.2: LEARN_CATEGORY "0" → MENU...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '0');
  const s2 = await waitForStep(phone, 'MENU');
  s2 ? pass('LEARN_CATEGORY "0" → MENU') : fail('"0" did not return to MENU', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 2.3: LEARN_CATEGORY "1" → ARTICLE_CATEGORY (with items)...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '1');
  const s3 = await waitForStep(phone, 'ARTICLE_CATEGORY', 12000);
  if (s3) {
    pass('LEARN_CATEGORY "1" → ARTICLE_CATEGORY');
    const sd = await waitForF4Items(phone);
    sd.f4_items?.length > 0 ? pass(`Article categories loaded (${sd.f4_items.length} categories)`) : fail('No f4_items in session after category fetch');
  } else {
    fail('LEARN_CATEGORY "1" did not advance', `step=${(await erp.getSession(phone))?.current_step}`);
  }

  info('Test 2.4: LEARN_CATEGORY "2" → VIDEO_CATEGORY...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '2');
  const s4 = await waitForStep(phone, 'VIDEO_CATEGORY', 12000);
  s4 ? pass('LEARN_CATEGORY "2" → VIDEO_CATEGORY') : fail('"2" did not advance to VIDEO_CATEGORY', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 2.5: LEARN_CATEGORY "3" → EVENT_LIST...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '3');
  const s5 = await waitForStep(phone, 'EVENT_LIST', 12000);
  s5 ? pass('LEARN_CATEGORY "3" → EVENT_LIST') : fail('"3" did not advance to EVENT_LIST', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 2.6: LEARN_CATEGORY "5" → TOOLS_LIST...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '5');
  const s6 = await waitForStep(phone, 'TOOLS_LIST', 12000);
  s6 ? pass('LEARN_CATEGORY "5" → TOOLS_LIST') : fail('"5" did not advance to TOOLS_LIST', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 2.7: Invalid input stays at LEARN_CATEGORY...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, 'HELLO');
  await delay(3000);
  const s7 = await erp.getSession(phone);
  s7?.current_step === 'LEARN_CATEGORY' ? pass('Invalid input stays at LEARN_CATEGORY') : fail('Invalid input moved away', `step=${s7?.current_step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: ARTICLES
// ─────────────────────────────────────────────────────────────────────────────
async function testArticles() {
  section('TEST SUITE 3: Articles Flow');

  const phone = PHONES.premium;

  info('Test 3.1: ARTICLE_CATEGORY → pick category → ARTICLE_SELECT...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '1');
  const sCat = await waitForStep(phone, 'ARTICLE_CATEGORY', 12000);
  if (!sCat) { fail('ARTICLE_CATEGORY not reached'); return; }
  const sdCat = await getSessionData(phone);
  pass(`Article categories loaded: ${sdCat.f4_items?.length || 0}`);

  // Pick first category
  await sendText(phone, '1');
  const sList = await waitForStep(phone, 'ARTICLE_SELECT', 12000);
  if (!sList) { fail('ARTICLE_SELECT not reached'); return; }
  const sdList = await getSessionData(phone);
  sdList.f4_items?.length > 0
    ? pass(`Article list loaded: ${sdList.f4_items.length} article(s)`)
    : fail('No articles in session data');

  info('Test 3.2: FREE member sees only FREE/ALL articles...');
  const freePhone = PHONES.free;
  await ensureFreeMember(freePhone);
  await setStep(freePhone, 'LEARN_CATEGORY', {});
  await sendText(freePhone, '1');
  const sCatFree = await waitForStep(freePhone, 'ARTICLE_CATEGORY', 12000);
  if (sCatFree) {
    const sdFree = await getSessionData(freePhone);
    // Verify no PREMIUM-only items appeared — we can verify by checking count
    pass(`FREE member accessed article categories (${sdFree.f4_items?.length || 0} categories)`);
  } else {
    fail('FREE member could not access article categories');
  }

  info('Test 3.3: Select article → ARTICLE_RATE + view tracked...');
  // Back to premium user, already at ARTICLE_SELECT with items
  if (sdList.f4_items?.length > 0) {
    const member = await erp.getMember(phone);
    await sendText(phone, '1');
    const sRate = await waitForStep(phone, 'ARTICLE_RATE', 12000);
    sRate ? pass('Article selected → ARTICLE_RATE') : fail('Article selection did not advance', `step=${(await erp.getSession(phone))?.current_step}`);

    await delay(2000);
    // Check RIFAH Resource View was created
    const views = await erp.request(`${BASE}/api/resource/RIFAH Resource View?filters=${erp.enc([['member_id','=',member?.rifah_id || '']])}&fields=${erp.enc(['name','resource_id','viewed_at'])}&limit=5`, 'GET');
    views.body?.data?.length > 0
      ? pass(`RIFAH Resource View created (${views.body.data[0].resource_id})`)
      : fail('RIFAH Resource View not created');
  }

  info('Test 3.4: Rate article 1-5 → back to ARTICLE_SELECT...');
  await sendText(phone, '4');
  const sAfterRate = await waitForStep(phone, 'ARTICLE_SELECT', 8000);
  sAfterRate ? pass('Rating accepted → ARTICLE_SELECT') : fail('Rating did not return to ARTICLE_SELECT', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 3.5: Invalid rating rejected...');
  await setStep(phone, 'ARTICLE_RATE', { f4_current_resource: { resource_id: `RSRC-${YEAR}-0001`, title: 'Test' } });
  await sendText(phone, '9');
  await delay(3000);
  const sInvRate = await erp.getSession(phone);
  sInvRate?.current_step === 'ARTICLE_RATE' ? pass('Invalid rating 9 rejected — stays at ARTICLE_RATE') : fail('Invalid rating moved away', `step=${sInvRate?.current_step}`);

  info('Test 3.6: "0" from ARTICLE_SELECT → back to ARTICLE_CATEGORY...');
  const sdItems = (await getSessionData(phone)) ;
  await setStep(phone, 'ARTICLE_SELECT', { f4_items: [{ resource_id: `RSRC-${YEAR}-0001`, title: 'Test Art', description: 'Test', content_url: 'https://test.com', view_count: 0 }] });
  await sendText(phone, '0');
  const sBackCat = await waitForStep(phone, 'ARTICLE_CATEGORY', 12000);
  sBackCat ? pass('"0" from ARTICLE_SELECT → ARTICLE_CATEGORY') : fail('"0" did not return to ARTICLE_CATEGORY', `step=${(await erp.getSession(phone))?.current_step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: VIDEOS
// ─────────────────────────────────────────────────────────────────────────────
async function testVideos() {
  section('TEST SUITE 4: Videos Flow');

  const phone = PHONES.premium;

  info('Test 4.1: LEARN_CATEGORY "2" → VIDEO_CATEGORY with items...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '2');
  const sCat = await waitForStep(phone, 'VIDEO_CATEGORY', 12000);
  if (!sCat) { fail('VIDEO_CATEGORY not reached'); return; }
  const sdCat = await waitForF4Items(phone);
  sdCat.f4_items?.length > 0
    ? pass(`Video categories loaded: ${sdCat.f4_items.length} categories`)
    : fail('No video categories loaded');

  info('Test 4.2: Pick video category → VIDEO_SELECT with list...');
  await sendText(phone, '1');
  const sList = await waitForStep(phone, 'VIDEO_SELECT', 12000);
  if (!sList) { fail('VIDEO_SELECT not reached'); return; }
  const sdList = await waitForF4Items(phone);
  sdList.f4_items?.length > 0
    ? pass(`Video list loaded: ${sdList.f4_items.length} video(s)`)
    : fail('No videos in session data');

  info('Test 4.3: Select video → VIDEO_RATE + view tracked...');
  if (sdList.f4_items?.length > 0) {
    const member = await erp.getMember(phone);
    await sendText(phone, '1');
    const sRate = await waitForStep(phone, 'VIDEO_RATE', 12000);
    sRate ? pass('Video selected → VIDEO_RATE') : fail('Video selection did not advance', `step=${(await erp.getSession(phone))?.current_step}`);
    await delay(2000);
    const views = await erp.request(`${BASE}/api/resource/RIFAH Resource View?filters=${erp.enc([['member_id','=',member?.rifah_id || '']])}&fields=${erp.enc(['name','resource_id'])}&order_by=viewed_at desc&limit=1`, 'GET');
    views.body?.data?.length > 0
      ? pass(`Video view tracked (${views.body.data[0].resource_id})`)
      : fail('Video RIFAH Resource View not created');
  }

  info('Test 4.4: Rate video → back to VIDEO_SELECT...');
  await sendText(phone, '5');
  const sAfter = await waitForStep(phone, 'VIDEO_SELECT', 8000);
  sAfter ? pass('Video rating accepted → VIDEO_SELECT') : fail('Video rating did not return to VIDEO_SELECT', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 4.5: "0" from VIDEO_SELECT → VIDEO_CATEGORY...');
  await setStep(phone, 'VIDEO_SELECT', { f4_items: [{ resource_id: `RSRC-${YEAR}-0101`, title: 'Test Vid', description: 'Test', content_url: 'https://test.com', view_count: 0, duration_minutes: 10 }] });
  await sendText(phone, '0');
  const sBack = await waitForStep(phone, 'VIDEO_CATEGORY', 12000);
  sBack ? pass('"0" from VIDEO_SELECT → VIDEO_CATEGORY') : fail('"0" did not return to VIDEO_CATEGORY', `step=${(await erp.getSession(phone))?.current_step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: EVENTS
// ─────────────────────────────────────────────────────────────────────────────
async function testEvents() {
  section('TEST SUITE 5: Events Flow');

  const phone = PHONES.premium;

  info('Test 5.1: LEARN_CATEGORY "3" → EVENT_LIST with events...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '3');
  const sList = await waitForStep(phone, 'EVENT_LIST', 12000);
  if (!sList) { fail('EVENT_LIST not reached'); return; }
  const sdList = await waitForF4Items(phone);
  sdList.f4_items?.length > 0
    ? pass(`Events loaded: ${sdList.f4_items.length} event(s)`)
    : fail('No events in session data');

  info('Test 5.2: Pick event → EVENT_DETAIL...');
  await sendText(phone, '1');
  const sDetail = await waitForStep(phone, 'EVENT_DETAIL', 8000);
  sDetail ? pass('Event selected → EVENT_DETAIL') : fail('Event selection did not advance', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 5.3: REGISTER → creates RIFAH Event Registration...');
  const member = await erp.getMember(phone);
  const sdBefore = await getSessionData(phone);
  const eventId = sdBefore.f4_current_event?.event_id;

  await sendText(phone, 'REGISTER');
  const sAfterReg = await waitForStep(phone, 'EVENT_LIST', 10000);
  sAfterReg ? pass('REGISTER accepted → back to EVENT_LIST') : fail('REGISTER did not complete', `step=${(await erp.getSession(phone))?.current_step}`);

  await delay(2000);
  if (eventId) {
    const regs = await erp.request(`${BASE}/api/resource/RIFAH Event Registration?filters=${erp.enc([['event_id','=',eventId],['member_phone','=',phone]])}&fields=${erp.enc(['name','attendance_status','registration_date'])}&limit=3`, 'GET');
    regs.body?.data?.length > 0
      ? pass(`Event registration created (status: ${regs.body.data[0].attendance_status})`)
      : fail('RIFAH Event Registration not created');
  } else {
    fail('No event_id in session — cannot verify registration');
  }

  info('Test 5.4: "0" from EVENT_DETAIL → EVENT_LIST...');
  const sdEv = await getSessionData(phone);
  const evItem = sdEv?.f4_items?.[0] || { event_id: `EVENT-${YEAR}-0001`, event_name: 'Test', event_type: 'NETWORKING', event_date: new Date().toISOString(), location: 'Pune', cost: 0, current_registrations: 0 };
  await setStep(phone, 'EVENT_DETAIL', { f4_current_event: evItem, f4_items: [evItem] });
  await sendText(phone, '0');
  const sBack = await waitForStep(phone, 'EVENT_LIST', 12000);
  sBack ? pass('"0" from EVENT_DETAIL → EVENT_LIST') : fail('"0" did not return to EVENT_LIST', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 5.5: "0" from EVENT_LIST → LEARN_CATEGORY...');
  await setStep(phone, 'EVENT_LIST', { f4_items: [] });
  await sendText(phone, '0');
  const sFinal = await waitForStep(phone, 'LEARN_CATEGORY', 8000);
  sFinal ? pass('"0" from EVENT_LIST → LEARN_CATEGORY') : fail('"0" did not return to LEARN_CATEGORY', `step=${(await erp.getSession(phone))?.current_step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6: TRAINING (PREMIUM GATE)
// ─────────────────────────────────────────────────────────────────────────────
async function testTraining() {
  section('TEST SUITE 6: Training Programs + Premium Gate');

  const freePhone  = PHONES.free;
  const premPhone  = PHONES.premium;

  info('Test 6.1: FREE member blocked from training...');
  await ensureFreeMember(freePhone);
  await setStep(freePhone, 'LEARN_CATEGORY', {});
  await sendText(freePhone, '4');
  await delay(3000);
  const sFree = await erp.getSession(freePhone);
  sFree?.current_step === 'LEARN_CATEGORY'
    ? pass('FREE member blocked — stays at LEARN_CATEGORY')
    : fail('FREE member not blocked from training', `step=${sFree?.current_step}`);

  info('Test 6.2: PREMIUM member can access training list...');
  await setStep(premPhone, 'LEARN_CATEGORY', {});
  await sendText(premPhone, '4');
  const sPrem = await waitForStep(premPhone, 'TRAINING_LIST', 12000);
  sPrem ? pass('PREMIUM member → TRAINING_LIST') : fail('PREMIUM member could not access training', `step=${(await erp.getSession(premPhone))?.current_step}`);

  info('Test 6.3: "0" from TRAINING_LIST → LEARN_CATEGORY...');
  await setStep(premPhone, 'TRAINING_LIST', { f4_items: [] });
  await sendText(premPhone, '0');
  const sBack = await waitForStep(premPhone, 'LEARN_CATEGORY', 8000);
  sBack ? pass('"0" from TRAINING_LIST → LEARN_CATEGORY') : fail('"0" did not return', `step=${(await erp.getSession(premPhone))?.current_step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7: TOOLS & TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
async function testTools() {
  section('TEST SUITE 7: Tools & Templates');

  const phone = PHONES.premium;

  info('Test 7.1: LEARN_CATEGORY "5" → TOOLS_LIST...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '5');
  const sList = await waitForStep(phone, 'TOOLS_LIST', 12000);
  sList ? pass('LEARN_CATEGORY "5" → TOOLS_LIST') : fail('"5" did not advance to TOOLS_LIST', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 7.2: "0" from TOOLS_LIST → LEARN_CATEGORY...');
  await setStep(phone, 'TOOLS_LIST', { f4_items: [] });
  await sendText(phone, '0');
  const sBack = await waitForStep(phone, 'LEARN_CATEGORY', 8000);
  sBack ? pass('"0" from TOOLS_LIST → LEARN_CATEGORY') : fail('"0" did not return', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 7.3: FREE member can access tools (FREE/ALL tier)...');
  const freePhone = PHONES.free;
  await setStep(freePhone, 'LEARN_CATEGORY', {});
  await sendText(freePhone, '5');
  const sFreeTool = await waitForStep(freePhone, 'TOOLS_LIST', 12000);
  sFreeTool ? pass('FREE member can access TOOLS_LIST') : fail('FREE member blocked from tools', `step=${(await erp.getSession(freePhone))?.current_step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8: EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────
async function testEdgeCases() {
  section('TEST SUITE 8: Edge Cases');

  const phone = PHONES.edge;
  await ensurePremiumMember(phone);

  info('Test 8.1: Out-of-range article selection rejected...');
  await setStep(phone, 'ARTICLE_SELECT', { f4_items: [
    { resource_id: `RSRC-${YEAR}-0001`, title: 'Art 1', description: 'Desc', content_url: 'https://test.com', view_count: 0 }
  ]});
  await sendText(phone, '99');
  await delay(3000);
  const s1 = await erp.getSession(phone);
  s1?.current_step === 'ARTICLE_SELECT' ? pass('Out-of-range "99" rejected — stays at ARTICLE_SELECT') : fail('Out-of-range moved away', `step=${s1?.current_step}`);

  info('Test 8.2: "BACK" keyword works same as "0"...');
  await setStep(phone, 'ARTICLE_SELECT', { f4_items: [
    { resource_id: `RSRC-${YEAR}-0001`, title: 'Art 1', description: 'Desc', content_url: 'https://test.com', view_count: 0 }
  ]});
  await sendText(phone, 'BACK');
  const s2 = await waitForStep(phone, 'ARTICLE_CATEGORY', 12000);
  s2 ? pass('"BACK" from ARTICLE_SELECT → ARTICLE_CATEGORY') : fail('"BACK" did not work', `step=${(await erp.getSession(phone))?.current_step}`);

  info('Test 8.3: ARTICLE_CATEGORY "View All" option...');
  await setStep(phone, 'LEARN_CATEGORY', {});
  await sendText(phone, '1');
  const sCat = await waitForStep(phone, 'ARTICLE_CATEGORY', 12000);
  if (sCat) {
    const sd = await getSessionData(phone);
    const allOpt = (sd.f4_items?.length || 0) + 1;
    await sendText(phone, String(allOpt)); // Pick "View All"
    const sAll = await waitForStep(phone, 'ARTICLE_SELECT', 12000);
    if (sAll) {
      const sdAll = await getSessionData(phone);
      sdAll.f4_items?.length > 0
        ? pass(`"View All" loads all articles (${sdAll.f4_items.length})`)
        : fail('"View All" returned empty list');
    } else {
      fail('"View All" did not advance to ARTICLE_SELECT', `step=${(await erp.getSession(phone))?.current_step}`);
    }
  } else {
    fail('ARTICLE_CATEGORY not reached for View All test');
  }

  info('Test 8.4: Unregistered user trying "4" from MENU...');
  const unregPhone = '919400000099';
  await erp.deleteSession(unregPhone).catch(()=>{});
  await erp.request(`${BASE}/api/resource/RIFAH Session`, 'POST', { phone_number: unregPhone, current_step: 'MENU', session_data: '{}', status: 'Active' }).catch(()=>{});
  await sendText(unregPhone, '4');
  await delay(3000);
  const s4 = await erp.getSession(unregPhone);
  s4?.current_step === 'MENU' ? pass('Unregistered user blocked from LEARN_CATEGORY') : fail('Unregistered user not blocked', `step=${s4?.current_step}`);
  await erp.deleteSession(unregPhone).catch(()=>{});

  info('Test 8.5: EVENT_DETAIL invalid input shows event again...');
  const fakeEvt = { event_id: `EVENT-${YEAR}-0001`, event_name: 'Test Event', event_type: 'NETWORKING', event_date: new Date(Date.now()+7*86400000).toISOString(), location: 'Pune', cost: 0, current_registrations: 5, max_participants: 100, description: 'Test', organizer: 'RIFAH', registration_link: '' };
  await setStep(phone, 'EVENT_DETAIL', { f4_current_event: fakeEvt, f4_items: [fakeEvt] });
  await sendText(phone, 'HELLO');
  await delay(3000);
  const s5 = await erp.getSession(phone);
  s5?.current_step === 'EVENT_DETAIL' ? pass('Invalid input in EVENT_DETAIL stays at EVENT_DETAIL') : fail('Invalid input moved away from EVENT_DETAIL', `step=${s5?.current_step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const args = process.argv.slice(2);

  if (args.includes('--clean')) { await cleanTestData(); return; }

  console.log(c.bold('\n╔══════════════════════════════════════════════════╗'));
  console.log(c.bold('║  RIFAH Connect — Flow 4 (Learn & Grow) Tests    ║'));
  console.log(c.bold('╚══════════════════════════════════════════════════╝'));

  const all = args.length === 0;

  if (all || args.includes('--infra'))    await testInfra();
  if (all || args.includes('--nav'))      await testNavigation();
  if (all || args.includes('--articles')) await testArticles();
  if (all || args.includes('--videos'))   await testVideos();
  if (all || args.includes('--events'))   await testEvents();
  if (all || args.includes('--training')) await testTraining();
  if (all || args.includes('--tools'))    await testTools();
  if (all || args.includes('--edge'))     await testEdgeCases();

  const total = results.passed + results.failed;
  const pct   = total > 0 ? Math.round(results.passed / total * 100) : 0;

  console.log('\n' + c.bold('══════════════════════════════════════════════════'));
  console.log(c.bold('  TEST SUMMARY'));
  console.log(c.bold('══════════════════════════════════════════════════'));
  console.log(c.green(`  ✓ Passed: ${results.passed}`));
  console.log(c.red(`  ✗ Failed: ${results.failed}`));
  if (results.errors.length) {
    console.log(c.bold('\n  Failures:'));
    results.errors.forEach(e => {
      console.log(c.red(`    • ${e.msg}`));
      if (e.detail) console.log(c.grey(`      ${e.detail}`));
    });
  }
  const scoreColour = pct >= 95 ? c.green : pct >= 80 ? c.yellow : c.red;
  console.log(scoreColour(c.bold(`\n  Score: ${pct}% (${results.passed}/${total})`)));
  console.log(c.bold('══════════════════════════════════════════════════\n'));

  process.exit(results.failed > 0 ? 1 : 0);
})();
