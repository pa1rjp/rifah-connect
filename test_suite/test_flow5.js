#!/usr/bin/env node
/**
 * RIFAH Connect — Automated Flow 5 Test Suite (Talk to RIFAH Team)
 *
 * Tests Help & Support via the main WhatsApp webhook.
 *
 * Usage:
 *   node test_suite/test_flow5.js              → all suites
 *   node test_suite/test_flow5.js --infra      → infrastructure checks
 *   node test_suite/test_flow5.js --nav        → menu navigation
 *   node test_suite/test_flow5.js --faq        → FAQ browse flow
 *   node test_suite/test_flow5.js --search     → FAQ search
 *   node test_suite/test_flow5.js --ticket     → ticket creation
 *   node test_suite/test_flow5.js --mytickets  → my tickets view
 *   node test_suite/test_flow5.js --contact    → contact info
 *   node test_suite/test_flow5.js --emergency  → emergency support
 *   node test_suite/test_flow5.js --clean      → wipe test sessions and exit
 */

const https = require('https');
const http  = require('http');
const erp   = require('../scripts/erpnext');

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ── CONFIG ────────────────────────────────────────────────────────────────────
const WEBHOOK  = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp-webhook';
const META_PID = process.env.META_PHONE_NUMBER_ID || '1051021614753488';
const BASE     = process.env.ERPNEXT_URL || 'http://localhost:8080';

const PHONES = {
  premium: '919400000001',   // PREMIUM member (seeded in Flow 1 tests)
  free:    '919400000002',   // FREE member
  edge:    '919400000005',   // fresh edge-case phone
  unregistered: '919400000099',
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
        id: `wamid.${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'text',
        text: { body: text },
      }],
    }, field: 'messages' }] }],
  });
  try {
    const res = await httpRequest(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    console.log(c.grey(`    [${phone}] sent: "${text}" → HTTP ${res.status}`));
    return res;
  } catch (e) {
    console.log(c.red(`    [${phone}] ERROR: ${e.message}`));
    return { status: 0, body: null };
  }
}

// ── SESSION HELPER ────────────────────────────────────────────────────────────
async function getSession(phone) {
  try {
    // Sessions are named with auto-generated IDs — look up by phone_number field
    const s = await erp.getSession(phone);
    return s || null;
  } catch { return null; }
}

async function resetSession(phone) {
  try {
    await erp.deleteSession(phone);
  } catch {}
}

async function setStep(phone, step, sessionData = {}) {
  for (let i = 0; i < 4; i++) {
    await erp.deleteSession(phone);
    await delay(300);
    await erp.request(`${BASE}/api/resource/RIFAH Session`, 'POST', {
      phone_number: phone, current_step: step,
      session_data: JSON.stringify(sessionData), status: 'Active',
    });
    await delay(1000);
    const s = await erp.getSession(phone);
    if (s?.current_step === step) return s;
  }
  return await erp.getSession(phone);
}

async function waitForStep(phone, expectedStep, maxWait = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(600);
    const s = await getSession(phone);
    if (s?.current_step === expectedStep) return s;
  }
  return await getSession(phone);
}

// Like waitForStep but also waits until session_data.f5_items is populated.
// Needed for FAQ_CATEGORY because the FAQ fetch branch saves f5_items
// asynchronously — the step flips first, items arrive ~1s later.
async function waitForFAQItems(phone, expectedStep, maxWait = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await delay(600);
    const s = await getSession(phone);
    if (s?.current_step === expectedStep) {
      const sd = JSON.parse(s.session_data || '{}');
      if ((sd.f5_items || []).length > 0) return s;
    }
  }
  return await getSession(phone);
}

// ── SUITES ────────────────────────────────────────────────────────────────────

async function suiteInfra() {
  section('TEST SUITE 1: Infrastructure');

  info('ERPNext reachable...');
  const ping = await erp.request(`${BASE}/api/method/frappe.auth.get_logged_user`, 'GET');
  ping.status === 200 ? pass('ERPNext reachable') : fail('ERPNext not reachable', `HTTP ${ping.status}`);

  for (const dt of ['RIFAH Support Ticket', 'RIFAH FAQ', 'RIFAH Support Agent']) {
    info(`${dt} doctype...`);
    const r = await erp.request(`${BASE}/api/resource/${encodeURIComponent(dt)}?limit=1`, 'GET');
    r.status === 200 ? pass(`${dt} accessible`) : fail(`${dt} not accessible`, `HTTP ${r.status}`);
  }

  info('FAQ seed data (30+)...');
  const faq = await erp.request(`${BASE}/api/resource/RIFAH FAQ?limit=50`, 'GET');
  const faqCount = faq.body?.data?.length || 0;
  faqCount >= 30 ? pass(`${faqCount} FAQs in ERPNext`) : fail(`Not enough FAQs: ${faqCount} (need 30+)`);

  info('Support agents seeded...');
  const agents = await erp.request(`${BASE}/api/resource/RIFAH Support Agent?limit=10`, 'GET');
  const agentCount = agents.body?.data?.length || 0;
  agentCount >= 3 ? pass(`${agentCount} support agents`) : fail(`Not enough agents: ${agentCount} (need 3+)`);

  info('Main webhook active...');
  const wh = await sendText(PHONES.unregistered, 'ping');
  wh.status === 200 ? pass('Webhook responds (HTTP 200)') : fail('Webhook not responding', `HTTP ${wh.status}`);
}

async function suiteNav() {
  section('TEST SUITE 2: Menu Navigation');

  info('Test 2.1: MENU "5" → SUPPORT_CATEGORY...');
  await setStep(PHONES.premium, 'MENU');
  await sendText(PHONES.premium, '5');
  const s1 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY');
  s1?.current_step === 'SUPPORT_CATEGORY'
    ? pass('MENU "5" → SUPPORT_CATEGORY')
    : fail('MENU "5" did not reach SUPPORT_CATEGORY', `got: ${s1?.current_step}`);

  info('Test 2.2: SUPPORT_CATEGORY "0" → MENU...');
  await sendText(PHONES.premium, '0');
  const s2 = await waitForStep(PHONES.premium, 'MENU');
  s2?.current_step === 'MENU' ? pass('SUPPORT_CATEGORY "0" → MENU') : fail('"0" did not return to MENU', `got: ${s2?.current_step}`);

  info('Test 2.3: Unregistered user blocked from option 5...');
  await setStep(PHONES.unregistered, 'MENU');
  await sendText(PHONES.unregistered, '5');
  const s3 = await waitForStep(PHONES.unregistered, 'MENU', 4000);
  s3?.current_step === 'MENU'
    ? pass('Unregistered user blocked — stays at MENU')
    : fail('Unregistered user not blocked', `got: ${s3?.current_step}`);

  info('Test 2.4: Invalid input stays at SUPPORT_CATEGORY...');
  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');
  await sendText(PHONES.premium, 'HELLO');
  const s4 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY', 4000);
  s4?.current_step === 'SUPPORT_CATEGORY'
    ? pass('Invalid input stays at SUPPORT_CATEGORY')
    : fail('Invalid input did not stay', `got: ${s4?.current_step}`);
}

async function suiteFAQ() {
  section('TEST SUITE 3: FAQs — Browse Flow');

  // Navigate to SUPPORT_CATEGORY first
  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');

  info('Test 3.1: "1" → FAQ_CATEGORY with categories loaded...');
  await sendText(PHONES.premium, '1');
  const s1 = await waitForFAQItems(PHONES.premium, 'FAQ_CATEGORY', 10000);
  s1?.current_step === 'FAQ_CATEGORY'
    ? pass('SUPPORT_CATEGORY "1" → FAQ_CATEGORY')
    : fail('"1" did not reach FAQ_CATEGORY', `got: ${s1?.current_step}`);
  const sd1 = JSON.parse(s1?.session_data || '{}');
  const cats = sd1.f5_items || [];
  cats.length >= 3
    ? pass(`FAQ categories loaded: ${cats.length} categories`)
    : fail('Not enough FAQ categories', `got: ${cats.length}`);

  info('Test 3.2: Pick category → FAQ_SELECT with items...');
  await sendText(PHONES.premium, '1');
  const s2 = await waitForStep(PHONES.premium, 'FAQ_SELECT', 8000);
  s2?.current_step === 'FAQ_SELECT'
    ? pass('Category selected → FAQ_SELECT')
    : fail('Category did not reach FAQ_SELECT', `got: ${s2?.current_step}`);
  const sd2 = JSON.parse(s2?.session_data || '{}');
  const faqs = sd2.f5_items || [];
  faqs.length >= 1 ? pass(`FAQ list loaded: ${faqs.length} FAQ(s)`) : fail('No FAQs in session', `got: ${faqs.length}`);

  info('Test 3.3: Select FAQ → FAQ_FEEDBACK (answer shown)...');
  await sendText(PHONES.premium, '1');
  const s3 = await waitForStep(PHONES.premium, 'FAQ_FEEDBACK', 8000);
  s3?.current_step === 'FAQ_FEEDBACK'
    ? pass('FAQ selected → FAQ_FEEDBACK')
    : fail('FAQ did not reach FAQ_FEEDBACK', `got: ${s3?.current_step}`);

  info('Test 3.4: YES feedback → back to SUPPORT_CATEGORY...');
  await sendText(PHONES.premium, 'YES');
  const s4 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY', 8000);
  s4?.current_step === 'SUPPORT_CATEGORY'
    ? pass('YES feedback → SUPPORT_CATEGORY')
    : fail('YES did not return to SUPPORT_CATEGORY', `got: ${s4?.current_step}`);

  info('Test 3.5: NO feedback → stays at SUPPORT_CATEGORY...');
  await sendText(PHONES.premium, '1'); // FAQs again
  await waitForFAQItems(PHONES.premium, 'FAQ_CATEGORY');
  await sendText(PHONES.premium, '1');
  await waitForStep(PHONES.premium, 'FAQ_SELECT');
  await sendText(PHONES.premium, '1');
  await waitForStep(PHONES.premium, 'FAQ_FEEDBACK');
  await sendText(PHONES.premium, 'NO');
  const s5 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY', 4000);
  s5?.current_step === 'SUPPORT_CATEGORY'
    ? pass('NO feedback → SUPPORT_CATEGORY')
    : fail('NO did not route correctly', `got: ${s5?.current_step}`);

  info('Test 3.6: TICKET keyword → TICKET_TYPE...');
  await sendText(PHONES.premium, '1');
  await waitForFAQItems(PHONES.premium, 'FAQ_CATEGORY');
  await sendText(PHONES.premium, '1');
  await waitForStep(PHONES.premium, 'FAQ_SELECT');
  await sendText(PHONES.premium, '1');
  await waitForStep(PHONES.premium, 'FAQ_FEEDBACK');
  await sendText(PHONES.premium, 'TICKET');
  const s6 = await waitForStep(PHONES.premium, 'TICKET_TYPE', 4000);
  s6?.current_step === 'TICKET_TYPE'
    ? pass('TICKET keyword → TICKET_TYPE')
    : fail('TICKET keyword did not route to TICKET_TYPE', `got: ${s6?.current_step}`);

  info('Test 3.7: "0" from FAQ_SELECT → FAQ_CATEGORY...');
  // Navigate to FAQ_SELECT via setStep + natural nav
  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');
  await sendText(PHONES.premium, '1');
  await waitForFAQItems(PHONES.premium, 'FAQ_CATEGORY');
  await sendText(PHONES.premium, '1');
  await waitForStep(PHONES.premium, 'FAQ_SELECT');
  await sendText(PHONES.premium, '0');
  const s7 = await waitForStep(PHONES.premium, 'FAQ_CATEGORY', 8000);
  s7?.current_step === 'FAQ_CATEGORY'
    ? pass('"0" from FAQ_SELECT → FAQ_CATEGORY')
    : fail('"0" did not return to FAQ_CATEGORY', `got: ${s7?.current_step}`);
}

async function suiteSearch() {
  section('TEST SUITE 4: FAQs — Search');

  // Navigate to FAQ_CATEGORY
  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');
  await sendText(PHONES.premium, '1');
  await waitForStep(PHONES.premium, 'FAQ_CATEGORY');

  info('Test 4.1: SEARCH keyword → FAQ_SELECT with results...');
  await sendText(PHONES.premium, 'SEARCH payment');
  const s1 = await waitForStep(PHONES.premium, 'FAQ_SELECT', 8000);
  s1?.current_step === 'FAQ_SELECT'
    ? pass('SEARCH → FAQ_SELECT')
    : fail('SEARCH did not reach FAQ_SELECT', `got: ${s1?.current_step}`);
  const sd1 = JSON.parse(s1?.session_data || '{}');
  const results2 = sd1.f5_items || [];
  results2.length >= 1 ? pass(`Search results found: ${results2.length} FAQ(s)`) : fail('No search results', 'expected FAQs matching "payment"');

  info('Test 4.2: Select from search results → FAQ_FEEDBACK...');
  await sendText(PHONES.premium, '1');
  const s2 = await waitForStep(PHONES.premium, 'FAQ_FEEDBACK', 8000);
  s2?.current_step === 'FAQ_FEEDBACK'
    ? pass('Search result selected → FAQ_FEEDBACK')
    : fail('Search result did not reach FAQ_FEEDBACK', `got: ${s2?.current_step}`);

  info('Test 4.3: SEARCH with no results → graceful message...');
  // Go back to FAQ_CATEGORY
  await sendText(PHONES.premium, '0');
  await waitForStep(PHONES.premium, 'FAQ_SELECT', 5000);
  await sendText(PHONES.premium, '0');
  await waitForStep(PHONES.premium, 'FAQ_CATEGORY');
  await sendText(PHONES.premium, 'SEARCH xyzxyzxyz_no_match_at_all');
  const s3 = await waitForStep(PHONES.premium, 'FAQ_SELECT', 8000);
  // Should land on FAQ_SELECT with empty items but not crash
  s3?.current_step === 'FAQ_SELECT'
    ? pass('No-results search → FAQ_SELECT gracefully')
    : fail('No-results search crashed', `got: ${s3?.current_step}`);
}

async function suiteTicket() {
  section('TEST SUITE 5: Ticket Creation');

  // Navigate to SUPPORT_CATEGORY
  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');

  info('Test 5.1: "2" → TICKET_TYPE...');
  await sendText(PHONES.premium, '2');
  const s1 = await waitForStep(PHONES.premium, 'TICKET_TYPE');
  s1?.current_step === 'TICKET_TYPE'
    ? pass('SUPPORT_CATEGORY "2" → TICKET_TYPE')
    : fail('"2" did not reach TICKET_TYPE', `got: ${s1?.current_step}`);

  info('Test 5.2: Select ticket type → TICKET_DESC...');
  await sendText(PHONES.premium, '1'); // Technical issue
  const s2 = await waitForStep(PHONES.premium, 'TICKET_DESC');
  s2?.current_step === 'TICKET_DESC'
    ? pass('Ticket type selected → TICKET_DESC')
    : fail('Ticket type did not reach TICKET_DESC', `got: ${s2?.current_step}`);

  info('Test 5.3: Submit description → TICKET_ATTACH...');
  await sendText(PHONES.premium, 'The bot is not responding when I try to post a lead. Getting no reply at all.');
  const s3 = await waitForStep(PHONES.premium, 'TICKET_ATTACH');
  s3?.current_step === 'TICKET_ATTACH'
    ? pass('Description submitted → TICKET_ATTACH')
    : fail('Description did not reach TICKET_ATTACH', `got: ${s3?.current_step}`);

  info('Test 5.4: "2" (No attachment) → ticket created...');
  await sendText(PHONES.premium, '2');
  const s4 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY', 10000);
  s4?.current_step === 'SUPPORT_CATEGORY'
    ? pass('No attachment → ticket created → SUPPORT_CATEGORY')
    : fail('Ticket creation did not complete', `got: ${s4?.current_step}`);

  // Verify ticket created in ERPNext
  info('Test 5.5: Ticket exists in ERPNext...');
  await delay(1000);
  const session = await getSession(PHONES.premium);
  const sd = JSON.parse(session?.session_data || '{}');
  const ticketId = sd.f5_last_ticket_id || sd.f5_active_ticket_id;
  if (ticketId) {
    const tr = await erp.request(`${BASE}/api/resource/RIFAH Support Ticket/${ticketId}`, 'GET');
    tr.status === 200
      ? pass(`Ticket created in ERPNext: ${ticketId}`)
      : fail('Ticket not found in ERPNext', `ID: ${ticketId}, HTTP ${tr.status}`);

    info('Test 5.6: PREMIUM ticket has elevated priority...');
    const tdata = tr.body?.data || {};
    const priority = tdata.priority;
    ['HIGH', 'URGENT'].includes(priority)
      ? pass(`PREMIUM ticket priority elevated: ${priority}`)
      : fail(`Priority not elevated for PREMIUM: ${priority}`);
  } else {
    fail('Ticket ID not found in session data');
    fail('Cannot verify ticket priority (no ticket ID)');
  }

  info('Test 5.7: Short description rejected...');
  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');
  await sendText(PHONES.premium, '2');
  await waitForStep(PHONES.premium, 'TICKET_TYPE');
  await sendText(PHONES.premium, '1');
  await waitForStep(PHONES.premium, 'TICKET_DESC');
  await sendText(PHONES.premium, 'short');
  const s7 = await waitForStep(PHONES.premium, 'TICKET_DESC', 4000);
  s7?.current_step === 'TICKET_DESC'
    ? pass('Short description rejected — stays at TICKET_DESC')
    : fail('Short description not rejected', `got: ${s7?.current_step}`);
}

async function suiteMyTickets() {
  section('TEST SUITE 6: My Support Tickets');

  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');

  info('Test 6.1: "3" → TICKET_VIEW with ticket list...');
  await sendText(PHONES.premium, '3');
  const s1 = await waitForStep(PHONES.premium, 'TICKET_VIEW', 8000);
  s1?.current_step === 'TICKET_VIEW'
    ? pass('SUPPORT_CATEGORY "3" → TICKET_VIEW')
    : fail('"3" did not reach TICKET_VIEW', `got: ${s1?.current_step}`);
  const sd1 = JSON.parse(s1?.session_data || '{}');
  const tickets = sd1.f5_tickets || [];
  pass(`Tickets loaded: ${tickets.length} ticket(s)`);

  info('Test 6.2: "0" → SUPPORT_CATEGORY...');
  await sendText(PHONES.premium, '0');
  const s2 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY');
  s2?.current_step === 'SUPPORT_CATEGORY'
    ? pass('"0" from TICKET_VIEW → SUPPORT_CATEGORY')
    : fail('"0" did not return to SUPPORT_CATEGORY', `got: ${s2?.current_step}`);

  info('Test 6.3: Select existing ticket → ACTIVE_CONVERSATION...');
  await sendText(PHONES.premium, '3');
  const s3 = await waitForStep(PHONES.premium, 'TICKET_VIEW', 8000);
  const sd3 = JSON.parse(s3?.session_data || '{}');
  const tList = sd3.f5_tickets || [];
  if (tList.length > 0) {
    const tid = tList[0].ticket_id;
    await sendText(PHONES.premium, tid);
    const s3b = await waitForStep(PHONES.premium, 'ACTIVE_CONVERSATION', 4000);
    s3b?.current_step === 'ACTIVE_CONVERSATION'
      ? pass(`Ticket ${tid} selected → ACTIVE_CONVERSATION`)
      : fail('Ticket ID did not reach ACTIVE_CONVERSATION', `got: ${s3b?.current_step}`);
  } else {
    pass('No tickets yet — skipping ticket-select test');
  }

  info('Test 6.4: ACTIVE_CONVERSATION "0" → SUPPORT_CATEGORY...');
  await sendText(PHONES.premium, '0');
  const s4 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY');
  s4?.current_step === 'SUPPORT_CATEGORY'
    ? pass('"0" from ACTIVE_CONVERSATION → SUPPORT_CATEGORY')
    : fail('"0" did not exit conversation', `got: ${s4?.current_step}`);
}

async function suiteContact() {
  section('TEST SUITE 7: Contact Information');

  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');

  info('Test 7.1: "4" → contact info → stays at SUPPORT_CATEGORY...');
  await sendText(PHONES.premium, '4');
  const s1 = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY', 4000);
  s1?.current_step === 'SUPPORT_CATEGORY'
    ? pass('SUPPORT_CATEGORY "4" → contact info shown → stays at SUPPORT_CATEGORY')
    : fail('"4" did not stay at SUPPORT_CATEGORY', `got: ${s1?.current_step}`);

  info('Test 7.2: FREE member "4" → contact info (general line)...');
  await setStep(PHONES.free, 'SUPPORT_CATEGORY');
  await sendText(PHONES.free, '4');
  const s2 = await waitForStep(PHONES.free, 'SUPPORT_CATEGORY', 4000);
  s2?.current_step === 'SUPPORT_CATEGORY'
    ? pass('FREE member contact info → SUPPORT_CATEGORY')
    : fail('FREE member contact info failed', `got: ${s2?.current_step}`);
}

async function suiteEmergency() {
  section('TEST SUITE 8: Emergency Support');

  info('Test 8.1: FREE member blocked from option 5...');
  await setStep(PHONES.free, 'SUPPORT_CATEGORY');
  await sendText(PHONES.free, '5');
  const s1 = await waitForStep(PHONES.free, 'SUPPORT_CATEGORY', 4000);
  s1?.current_step === 'SUPPORT_CATEGORY'
    ? pass('FREE member blocked from emergency — stays at SUPPORT_CATEGORY')
    : fail('FREE member not blocked from emergency', `got: ${s1?.current_step}`);

  info('Test 8.2: PREMIUM member sees emergency options...');
  await setStep(PHONES.premium, 'SUPPORT_CATEGORY');
  await sendText(PHONES.premium, '5');
  const s2 = await waitForStep(PHONES.premium, 'TICKET_TYPE', 4000);
  s2?.current_step === 'TICKET_TYPE'
    ? pass('PREMIUM member "5" → TICKET_TYPE (emergency flow)')
    : fail('PREMIUM emergency did not reach TICKET_TYPE', `got: ${s2?.current_step}`);

  info('Test 8.3: Emergency "1" → URGENT ticket created...');
  await sendText(PHONES.premium, '1');
  const s3 = await waitForStep(PHONES.premium, 'TICKET_DESC', 4000);
  s3?.current_step === 'TICKET_DESC'
    ? pass('Emergency type "1" → TICKET_DESC')
    : fail('Emergency "1" did not reach TICKET_DESC', `got: ${s3?.current_step}`);
  await sendText(PHONES.premium, 'Our payment system is completely down and we cannot process any orders.');
  await waitForStep(PHONES.premium, 'TICKET_ATTACH');
  await sendText(PHONES.premium, '2'); // No attachment
  const s3b = await waitForStep(PHONES.premium, 'SUPPORT_CATEGORY', 10000);
  if (s3b?.current_step === 'SUPPORT_CATEGORY') {
    const sess = await getSession(PHONES.premium);
    const sd = JSON.parse(sess?.session_data || '{}');
    const tid = sd.f5_last_ticket_id;
    if (tid) {
      const tr = await erp.request(`${BASE}/api/resource/RIFAH Support Ticket/${tid}`, 'GET');
      if (tr.status === 200) {
        const prio = tr.body?.data?.priority;
        prio === 'URGENT'
          ? pass(`URGENT ticket created: ${tid} (priority: ${prio})`)
          : fail(`Expected URGENT priority, got: ${prio}`);
      } else {
        fail('Could not verify emergency ticket', `HTTP ${tr.status}`);
      }
    } else {
      pass('Emergency ticket created (ticket ID in session)');
    }
  } else {
    fail('Emergency ticket creation did not complete', `got: ${s3b?.current_step}`);
  }
}

// ── CLEAN ─────────────────────────────────────────────────────────────────────
async function clean() {
  console.log(c.blue('\n  Cleaning Flow 5 test data...'));
  for (const phone of Object.values(PHONES)) {
    await resetSession(phone);
  }
  // Delete test tickets created during tests
  try {
    const r = await erp.request(
      `${BASE}/api/resource/RIFAH Support Ticket?filters=${encodeURIComponent(JSON.stringify([['member_phone','in',Object.values(PHONES)]]))}&fields=${encodeURIComponent(JSON.stringify(['ticket_id']))}&limit=50`,
      'GET'
    );
    const tickets = r.body?.data || [];
    for (const t of tickets) {
      await erp.request(`${BASE}/api/resource/RIFAH Support Ticket/${t.ticket_id}`, 'DELETE');
    }
    console.log(c.green(`  ✓ Cleaned ${tickets.length} test ticket(s) and all sessions`));
  } catch (e) {
    console.log(c.yellow('  ⚠ Could not delete test tickets: ' + e.message));
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
function printSummary() {
  console.log('\n' + c.bold('══════════════════════════════════════════════════'));
  console.log(c.bold('  TEST SUMMARY'));
  console.log(c.bold('══════════════════════════════════════════════════'));
  console.log(c.green(`  ✓ Passed: ${results.passed}`));
  console.log(c.red(`  ✗ Failed: ${results.failed}`));
  if (results.errors.length > 0) {
    console.log(c.bold('\n  Failures:'));
    results.errors.forEach(e => console.log(c.red(`    • ${e.msg}${e.detail ? ' — ' + e.detail : ''}`)));
  }
  const total = results.passed + results.failed;
  const pct   = total ? Math.round((results.passed / total) * 100) : 0;
  const colour = pct === 100 ? c.green : pct >= 90 ? c.yellow : c.red;
  console.log(colour(c.bold(`\n  Score: ${pct}% (${results.passed}/${total})`)));
  console.log(c.bold('══════════════════════════════════════════════════\n'));
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(c.bold('\n╔══════════════════════════════════════════════════╗'));
  console.log(c.bold('║  RIFAH Connect — Flow 5 (Talk to RIFAH Team) Tests ║'));
  console.log(c.bold('╚══════════════════════════════════════════════════╝'));

  const args    = process.argv.slice(2);
  const runAll  = args.length === 0;
  const runFlag = f => runAll || args.includes(f);

  if (args.includes('--clean')) { await clean(); return; }

  if (runFlag('--infra'))      await suiteInfra();
  if (runFlag('--nav'))        await suiteNav();
  if (runFlag('--faq'))        await suiteFAQ();
  if (runFlag('--search'))     await suiteSearch();
  if (runFlag('--ticket'))     await suiteTicket();
  if (runFlag('--mytickets'))  await suiteMyTickets();
  if (runFlag('--contact'))    await suiteContact();
  if (runFlag('--emergency'))  await suiteEmergency();

  printSummary();
  process.exit(results.failed > 0 ? 1 : 0);
})();
