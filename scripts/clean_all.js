#!/usr/bin/env node
/**
 * RIFAH Connect — Full ERPNext Data Wipe
 *
 * Deletes ALL records from every RIFAH doctype.
 * Does NOT touch seed data (RIFAH FAQ, RIFAH Support Agent, RIFAH WhatsApp Group).
 *
 * Usage:
 *   node scripts/clean_all.js            → wipe Sessions, Members, Leads, Support Tickets
 *   node scripts/clean_all.js --seed     → also wipe FAQ + Support Agents (seed data)
 *   node scripts/clean_all.js --dry-run  → list what would be deleted, no actual deletes
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { BASE, HEADERS, enc } = require('./erpnext');
const http  = require('http');
const https = require('https');

const DRY_RUN   = process.argv.includes('--dry-run');
const WIPE_SEED = process.argv.includes('--seed');

// ── colours ───────────────────────────────────────────────────────────────────
const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  grey:   s => `\x1b[90m${s}\x1b[0m`,
};

// ── core request (identical to erpnext.js) ────────────────────────────────────
function req(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const data   = body ? JSON.stringify(body) : null;
    const r = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port,
      path:     parsed.pathname + (parsed.search || ''),
      method,
      headers: { ...HEADERS, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    r.setTimeout(15000, () => { r.destroy(); reject(new Error('Timeout')); });
    if (data) r.write(data);
    r.end();
  });
}

// ── fetch all names from a doctype (pages through 500 at a time) ──────────────
async function fetchAllNames(doctype) {
  const names = [];
  let start   = 0;
  const limit = 500;
  while (true) {
    const fields = enc(['name']);
    const url    = `${BASE}/api/resource/${encodeURIComponent(doctype)}?fields=${fields}&limit=${limit}&limit_start=${start}`;
    const r      = await req(url);
    const page   = r.body?.data || [];
    if (!page.length) break;
    names.push(...page.map(d => d.name));
    if (page.length < limit) break;
    start += limit;
  }
  return names;
}

// ── delete one record by name ─────────────────────────────────────────────────
async function deleteRecord(doctype, name) {
  const url = `${BASE}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
  const r   = await req(url, 'DELETE');
  return r.status === 202 || r.status === 200;
}

// ── wipe all records in a doctype ─────────────────────────────────────────────
async function wipeDoctype(doctype) {
  process.stdout.write(`  ${c.yellow(doctype)} — fetching records... `);
  const names = await fetchAllNames(doctype);
  console.log(`found ${c.bold(names.length)}`);

  if (names.length === 0) return { deleted: 0, failed: 0 };

  if (DRY_RUN) {
    names.forEach(n => console.log(c.grey(`    [dry-run] would delete: ${n}`)));
    return { deleted: 0, failed: 0 };
  }

  let deleted = 0;
  let failed  = 0;
  for (const name of names) {
    const ok = await deleteRecord(doctype, name);
    if (ok) {
      deleted++;
      process.stdout.write(c.green('.'));
    } else {
      failed++;
      process.stdout.write(c.red('✗'));
    }
  }
  console.log(`  → ${c.green(`${deleted} deleted`)}${failed ? c.red(` | ${failed} failed`) : ''}`);
  return { deleted, failed };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log(c.bold('╔══════════════════════════════════════════════╗'));
  console.log(c.bold('║   RIFAH Connect — Full ERPNext Data Wipe     ║'));
  console.log(c.bold('╚══════════════════════════════════════════════╝'));
  if (DRY_RUN) console.log(c.yellow('\n  ⚠  DRY RUN — nothing will actually be deleted\n'));
  console.log('');

  // Always wiped
  const doctypes = [
    'RIFAH Session',
    'RIFAH Member',
    'RIFAH Lead',
    'RIFAH Support Ticket',
  ];

  // Only with --seed flag
  if (WIPE_SEED) {
    doctypes.push('RIFAH FAQ', 'RIFAH Support Agent');
    console.log(c.yellow('  ⚠  --seed flag set: FAQ and Support Agents will also be wiped\n'));
  }

  let totalDeleted = 0;
  let totalFailed  = 0;

  for (const dt of doctypes) {
    const { deleted, failed } = await wipeDoctype(dt);
    totalDeleted += deleted;
    totalFailed  += failed;
    console.log('');
  }

  console.log(c.bold('══════════════════════════════════════════════'));
  if (DRY_RUN) {
    console.log(c.yellow('  Dry run complete — no records were deleted'));
  } else {
    console.log(c.green(`  ✓ Total deleted : ${totalDeleted}`));
    if (totalFailed) console.log(c.red(`  ✗ Total failed  : ${totalFailed}`));
    else             console.log(c.grey('  ✗ Total failed  : 0'));
  }
  console.log(c.bold('══════════════════════════════════════════════\n'));

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(e => { console.error(c.red(`\nFatal: ${e.message}`)); process.exit(1); });
