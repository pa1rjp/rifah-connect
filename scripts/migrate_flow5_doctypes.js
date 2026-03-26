#!/usr/bin/env node
/**
 * RIFAH Connect — Flow 5 DocType Migration
 * Creates: RIFAH Support Ticket, RIFAH FAQ, RIFAH Support Agent
 *
 * Usage:
 *   node scripts/migrate_flow5_doctypes.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const erp = require('./erpnext');

const BASE = process.env.ERPNEXT_URL || 'http://localhost:8080';

const c = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  blue:  s => `\x1b[34m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
};

function field(fieldname, label, fieldtype, opts = {}) {
  return {
    fieldname, label, fieldtype,
    reqd:           opts.reqd         || 0,
    unique:         opts.unique       || 0,
    read_only:      opts.read_only    || 0,
    in_list_view:   opts.in_list_view || 0,
    default:        opts.default      !== undefined ? String(opts.default) : '',
    options:        opts.options      || '',
    length:         opts.length       || 0,
    doctype:        'DocField',
  };
}

function sectionBreak(label) {
  return field(label.toLowerCase().replace(/\s+/g, '_') + '_section', label, 'Section Break');
}

// ── DocType definitions ───────────────────────────────────────────────────────

const RIFAH_SUPPORT_TICKET = {
  doctype: 'DocType',
  name: 'RIFAH Support Ticket',
  module: 'Core',
  custom: 1,
  autoname: 'field:ticket_id',
  naming_rule: 'By fieldname',
  fields: [
    sectionBreak('Ticket Info'),
    field('ticket_id',           'Ticket ID',           'Data',     { reqd: 1, unique: 1, read_only: 1, in_list_view: 1 }),
    field('member_id',           'Member ID',           'Data',     { reqd: 1, in_list_view: 1 }),
    field('member_name',         'Member Name',         'Data',     { in_list_view: 1 }),
    field('member_phone',        'Member Phone',        'Data',     {}),
    field('member_tier',         'Member Tier',         'Select',   { options: '\nFREE\nPREMIUM', in_list_view: 1 }),
    sectionBreak('Classification'),
    field('ticket_type',         'Ticket Type',         'Select',   { reqd: 1, options: '\nTECHNICAL\nBILLING\nGENERAL\nCOMPLAINT\nFEATURE_REQUEST\nMEMBERSHIP', in_list_view: 1 }),
    field('priority',            'Priority',            'Select',   { reqd: 1, options: '\nLOW\nMEDIUM\nHIGH\nURGENT', default: 'MEDIUM', in_list_view: 1 }),
    field('status',              'Status',              'Select',   { reqd: 1, options: '\nOPEN\nIN_PROGRESS\nWAITING_USER\nRESOLVED\nCLOSED', default: 'OPEN', in_list_view: 1 }),
    field('assigned_to',         'Assigned To',         'Data',     {}),
    sectionBreak('Content'),
    field('subject',             'Subject',             'Data',     { length: 150 }),
    field('description',         'Description',         'Text',     {}),
    field('resolution_notes',    'Resolution Notes',    'Text',     {}),
    sectionBreak('Timeline'),
    field('created_at',          'Created At',          'Datetime', {}),
    field('first_response_at',   'First Response At',   'Datetime', {}),
    field('resolved_at',         'Resolved At',         'Datetime', {}),
    field('closed_at',           'Closed At',           'Datetime', {}),
    field('response_time_hours', 'Response Time (hrs)', 'Float',    { default: 0 }),
    sectionBreak('SLA Escalation'),
    field('sla_breached',        'SLA Breached',        'Check',    { default: 0 }),
    field('escalated',           'Escalated',           'Check',    { default: 0 }),
    field('escalation_reason',   'Escalation Reason',   'Text',     {}),
    sectionBreak('Feedback'),
    field('rating',              'Rating (1-5)',         'Int',      {}),
    field('feedback',            'Feedback',            'Text',     {}),
    sectionBreak('Conversation'),
    field('conversation_log',    'Conversation Log',    'Long Text', {}),
    field('attachments',         'Attachments',         'Text',     {}),
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
                { role: 'All', read: 1, write: 1, create: 1 }],
};

const RIFAH_FAQ = {
  doctype: 'DocType',
  name: 'RIFAH FAQ',
  module: 'Core',
  custom: 1,
  autoname: 'field:faq_id',
  naming_rule: 'By fieldname',
  fields: [
    sectionBreak('FAQ Info'),
    field('faq_id',         'FAQ ID',       'Data',     { reqd: 1, unique: 1, read_only: 1, in_list_view: 1 }),
    field('category',       'Category',     'Select',   { reqd: 1, in_list_view: 1, options: '\nREGISTRATION\nMEMBERSHIP\nLEADS\nPAYMENTS\nEVENTS\nTECHNICAL\nGENERAL' }),
    field('question',       'Question',     'Data',     { reqd: 1, in_list_view: 1, length: 200 }),
    sectionBreak('Content'),
    field('answer',         'Answer',       'Text',     { reqd: 1 }),
    field('keywords',       'Keywords',     'Small Text', {}),
    sectionBreak('Access'),
    field('language',       'Language',     'Select',   { options: '\nEnglish\nHindi\nMarathi\nTamil\nTelugu\nGujarati', default: 'English' }),
    field('access_tier',    'Access Tier',  'Select',   { options: '\nFREE\nPREMIUM\nALL', default: 'ALL' }),
    sectionBreak('Stats'),
    field('is_active',      'Is Active',    'Check',    { default: 1 }),
    field('view_count',     'View Count',   'Int',      { default: 0 }),
    field('helpful_count',  'Helpful Count','Int',      { default: 0 }),
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
                { role: 'All', read: 1 }],
};

const RIFAH_SUPPORT_AGENT = {
  doctype: 'DocType',
  name: 'RIFAH Support Agent',
  module: 'Core',
  custom: 1,
  autoname: 'field:agent_id',
  naming_rule: 'By fieldname',
  fields: [
    sectionBreak('Agent Info'),
    field('agent_id',                  'Agent ID',                'Data',   { reqd: 1, unique: 1, read_only: 1, in_list_view: 1 }),
    field('agent_name',                'Agent Name',              'Data',   { reqd: 1, in_list_view: 1 }),
    field('agent_phone',               'Agent Phone',             'Data',   {}),
    field('agent_email',               'Agent Email',             'Data',   {}),
    field('department',                'Department',              'Select', { reqd: 1, in_list_view: 1, options: '\nTECHNICAL\nBILLING\nGENERAL\nMEMBERSHIP' }),
    sectionBreak('Availability'),
    field('is_active',                 'Is Active',               'Check',  { default: 1 }),
    field('availability_status',       'Availability Status',     'Select', { options: '\nAVAILABLE\nBUSY\nOFFLINE', default: 'AVAILABLE', in_list_view: 1 }),
    field('languages',                 'Languages',               'Small Text', {}),
    sectionBreak('Capacity'),
    field('max_concurrent_tickets',    'Max Concurrent Tickets',  'Int',    { default: 5 }),
    field('current_ticket_count',      'Current Ticket Count',    'Int',    { default: 0 }),
    sectionBreak('Performance'),
    field('rating',                    'Rating',                  'Float',  { default: 0 }),
    field('total_tickets_resolved',    'Total Tickets Resolved',  'Int',    { default: 0 }),
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
                { role: 'All', read: 1 }],
};

// ── Create a doctype via REST API ─────────────────────────────────────────────
async function createDoctype(def) {
  const name = def.name;
  const check = await erp.request(`${BASE}/api/resource/DocType/${encodeURIComponent(name)}`, 'GET');
  if (check.status === 200 && check.body?.data) {
    console.log(c.blue(`  ⟳  ${name} already exists — skipping`));
    return true;
  }
  const r = await erp.request(`${BASE}/api/resource/DocType`, 'POST', def);
  if (r.status === 200 || r.status === 201) {
    console.log(c.green(`  ✓  ${name} created`));
    return true;
  } else {
    console.log(c.red(`  ✗  ${name} failed (HTTP ${r.status}): ${JSON.stringify(r.body).substring(0, 200)}`));
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(c.bold('\n══════════════════════════════════════════'));
  console.log(c.bold('  RIFAH Connect — Flow 5 DocType Migration'));
  console.log(c.bold('══════════════════════════════════════════\n'));

  const doctypes = [RIFAH_SUPPORT_TICKET, RIFAH_FAQ, RIFAH_SUPPORT_AGENT];

  let passed = 0;
  for (const dt of doctypes) {
    process.stdout.write(`  Creating ${dt.name}... `);
    const ok = await createDoctype(dt);
    if (ok) passed++;
  }

  console.log(`\n  ${passed}/${doctypes.length} doctypes ready\n`);

  console.log(c.bold('  Verifying via REST API...\n'));
  const names = ['RIFAH Support Ticket', 'RIFAH FAQ', 'RIFAH Support Agent'];
  for (const name of names) {
    const r = await erp.request(`${BASE}/api/resource/${encodeURIComponent(name)}?limit=1`, 'GET');
    r.status === 200
      ? console.log(c.green(`  ✓  GET /api/resource/${name} → 200`))
      : console.log(c.red(`  ✗  GET /api/resource/${name} → ${r.status}`));
  }

  console.log(c.bold('\n══════════════════════════════════════════\n'));
})();
