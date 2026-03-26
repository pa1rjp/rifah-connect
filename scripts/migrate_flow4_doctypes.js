#!/usr/bin/env node
/**
 * RIFAH Connect — Flow 4 DocType Migration
 * Creates: RIFAH Resource, RIFAH Event, RIFAH Event Registration, RIFAH Resource View
 *
 * Usage:
 *   node scripts/migrate_flow4_doctypes.js
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

// ── Helper: build a minimal DocField object ───────────────────────────────────
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

const RIFAH_RESOURCE = {
  doctype: 'DocType',
  name: 'RIFAH Resource',
  module: 'Core',
  custom: 1,
  autoname: 'field:resource_id',
  naming_rule: 'By fieldname',
  fields: [
    sectionBreak('Resource Info'),
    field('resource_id',       'Resource ID',       'Data',     { reqd: 1, unique: 1, read_only: 1, in_list_view: 1 }),
    field('title',             'Title',             'Data',     { reqd: 1, in_list_view: 1, length: 150 }),
    field('resource_type',     'Resource Type',     'Select',   { reqd: 1, in_list_view: 1, options: '\nARTICLE\nVIDEO\nPDF\nWEBINAR\nEVENT\nTRAINING\nTOOL' }),
    field('category',          'Category',          'Select',   { reqd: 1, options: '\nMarketing\nFinance\nOperations\nHR\nLegal\nTechnology\nSales\nGeneral' }),
    field('access_tier',       'Access Tier',       'Select',   { reqd: 1, in_list_view: 1, options: '\nFREE\nPREMIUM\nALL', default: 'ALL' }),
    sectionBreak('Content'),
    field('description',       'Description',       'Text',     {}),
    field('content_url',       'Content URL',       'Data',     {}),
    field('thumbnail_url',     'Thumbnail URL',     'Data',     {}),
    sectionBreak('Details'),
    field('language',          'Language',          'Select',   { options: '\nEnglish\nHindi\nMarathi\nTamil\nTelugu\nGujarati', default: 'English' }),
    field('duration_minutes',  'Duration (min)',     'Int',      {}),
    field('published_date',    'Published Date',    'Date',     {}),
    field('tags',              'Tags',              'Small Text', {}),
    sectionBreak('Stats'),
    field('is_active',         'Is Active',         'Check',    { default: 1 }),
    field('view_count',        'View Count',        'Int',      { default: 0 }),
    field('rating',            'Rating',            'Float',    { default: 0 }),
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
                { role: 'All', read: 1 }],
};

const RIFAH_EVENT = {
  doctype: 'DocType',
  name: 'RIFAH Event',
  module: 'Core',
  custom: 1,
  autoname: 'field:event_id',
  naming_rule: 'By fieldname',
  fields: [
    sectionBreak('Event Info'),
    field('event_id',              'Event ID',              'Data',     { reqd: 1, unique: 1, read_only: 1, in_list_view: 1 }),
    field('event_name',            'Event Name',            'Data',     { reqd: 1, in_list_view: 1, length: 150 }),
    field('event_type',            'Event Type',            'Select',   { reqd: 1, options: '\nWEBINAR\nWORKSHOP\nCONFERENCE\nNETWORKING\nSEMINAR' }),
    field('access_tier',           'Access Tier',           'Select',   { reqd: 1, in_list_view: 1, options: '\nFREE\nPREMIUM\nALL', default: 'ALL' }),
    field('status',                'Status',                'Select',   { reqd: 1, in_list_view: 1, options: '\nUPCOMING\nONGOING\nCOMPLETED\nCANCELLED', default: 'UPCOMING' }),
    sectionBreak('Schedule'),
    field('event_date',            'Event Date',            'Datetime', { reqd: 1 }),
    field('event_duration_hours',  'Duration (hours)',      'Float',    {}),
    field('registration_deadline', 'Registration Deadline', 'Date',     {}),
    sectionBreak('Details'),
    field('description',           'Description',           'Text',     {}),
    field('location',              'Location',              'Data',     {}),
    field('organizer',             'Organizer',             'Data',     {}),
    field('cost',                  'Cost (₹)',               'Currency', { default: 0 }),
    field('registration_link',     'Registration Link',     'Data',     {}),
    field('thumbnail_url',         'Thumbnail URL',         'Data',     {}),
    sectionBreak('Capacity'),
    field('max_participants',      'Max Participants',      'Int',      {}),
    field('current_registrations', 'Current Registrations', 'Int',      { default: 0 }),
    field('is_active',             'Is Active',             'Check',    { default: 1 }),
    field('created_at',            'Created At',            'Datetime', {}),
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
                { role: 'All', read: 1 }],
};

const RIFAH_EVENT_REGISTRATION = {
  doctype: 'DocType',
  name: 'RIFAH Event Registration',
  module: 'Core',
  custom: 1,
  autoname: 'field:registration_id',
  naming_rule: 'By fieldname',
  fields: [
    sectionBreak('Registration Info'),
    field('registration_id',    'Registration ID',    'Data',     { reqd: 1, unique: 1, read_only: 1, in_list_view: 1 }),
    field('event_id',           'Event ID',           'Data',     { reqd: 1, in_list_view: 1 }),
    field('member_id',          'Member ID',          'Data',     { reqd: 1, in_list_view: 1 }),
    field('member_name',        'Member Name',        'Data',     { in_list_view: 1 }),
    field('member_phone',       'Member Phone',       'Data',     {}),
    field('registration_date',  'Registration Date',  'Datetime', {}),
    sectionBreak('Status'),
    field('attendance_status',  'Attendance Status',  'Select',   { options: '\nREGISTERED\nATTENDED\nNO_SHOW\nCANCELLED', default: 'REGISTERED', in_list_view: 1 }),
    field('payment_status',     'Payment Status',     'Select',   { options: '\nNA\nPENDING\nPAID\nREFUNDED', default: 'NA' }),
    field('payment_amount',     'Payment Amount (₹)', 'Currency', { default: 0 }),
    field('certificate_issued', 'Certificate Issued', 'Check',    { default: 0 }),
    sectionBreak('Feedback'),
    field('feedback_rating',    'Feedback Rating',    'Int',      {}),
    field('feedback_comments',  'Feedback Comments',  'Text',     {}),
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
                { role: 'All', read: 1, write: 1, create: 1 }],
};

const RIFAH_RESOURCE_VIEW = {
  doctype: 'DocType',
  name: 'RIFAH Resource View',
  module: 'Core',
  custom: 1,
  autoname: 'field:view_id',
  naming_rule: 'By fieldname',
  fields: [
    sectionBreak('View Info'),
    field('view_id',                'View ID',               'Data',     { reqd: 1, unique: 1, read_only: 1, in_list_view: 1 }),
    field('resource_id',           'Resource ID',           'Data',     { reqd: 1, in_list_view: 1 }),
    field('member_id',             'Member ID',             'Data',     { reqd: 1, in_list_view: 1 }),
    field('viewed_at',             'Viewed At',             'Datetime', { in_list_view: 1 }),
    sectionBreak('Engagement'),
    field('view_duration_seconds', 'Duration (seconds)',    'Int',      {}),
    field('completed',             'Completed',             'Check',    { default: 0 }),
    field('rating',                'Rating',                'Int',      {}),
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, create: 1, delete: 1 },
                { role: 'All', read: 1, write: 1, create: 1 }],
};

// ── Create a doctype via REST API ─────────────────────────────────────────────
async function createDoctype(def) {
  const name = def.name;

  // Check if already exists
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
  console.log(c.bold('  RIFAH Connect — Flow 4 DocType Migration'));
  console.log(c.bold('══════════════════════════════════════════\n'));

  const doctypes = [
    RIFAH_RESOURCE,
    RIFAH_EVENT,
    RIFAH_EVENT_REGISTRATION,
    RIFAH_RESOURCE_VIEW,
  ];

  let passed = 0;
  for (const dt of doctypes) {
    process.stdout.write(`  Creating ${dt.name}... `);
    const ok = await createDoctype(dt);
    if (ok) passed++;
  }

  console.log(`\n  ${passed}/${doctypes.length} doctypes ready\n`);

  // Verify all are accessible via API
  console.log(c.bold('  Verifying via REST API...\n'));
  const names = ['RIFAH Resource', 'RIFAH Event', 'RIFAH Event Registration', 'RIFAH Resource View'];
  for (const name of names) {
    const r = await erp.request(`${BASE}/api/resource/${encodeURIComponent(name)}?limit=1`, 'GET');
    r.status === 200
      ? console.log(c.green(`  ✓  GET /api/resource/${name} → 200`))
      : console.log(c.red(`  ✗  GET /api/resource/${name} → ${r.status}`));
  }

  console.log(c.bold('\n══════════════════════════════════════════\n'));
})();
