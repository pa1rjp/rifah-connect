#!/usr/bin/env node
/**
 * RIFAH Connect — Flow 4 Seed Data
 * Seeds sample resources (articles, videos) and events for Learn & Grow.
 *
 * Usage:
 *   node scripts/seed_flow4.js          — create all seed data
 *   node scripts/seed_flow4.js --clean  — delete all seed data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const erp = require('./erpnext');

const BASE = process.env.ERPNEXT_URL || 'http://localhost:8080';
const YEAR = new Date().getFullYear();

const c = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  blue:  s => `\x1b[34m${s}\x1b[0m`,
  grey:  s => `\x1b[90m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
};

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// ── ARTICLES ──────────────────────────────────────────────────────────────────
const ARTICLES = [
  // FREE articles (10)
  { resource_id: `RSRC-${YEAR}-0001`, title: 'Digital Marketing Basics for SMEs',        category: 'Marketing',   access_tier: 'FREE',    view_count: 245, rating: 4.5, tags: 'digital,marketing,sme', description: 'A practical guide to digital marketing for small and medium enterprises. Covers social media, SEO, and email marketing fundamentals.', content_url: 'https://rifah.in/resources/digital-marketing-basics', published_date: '2024-01-15' },
  { resource_id: `RSRC-${YEAR}-0002`, title: 'Cash Flow Management for Small Business',  category: 'Finance',     access_tier: 'FREE',    view_count: 198, rating: 4.3, tags: 'cash flow,finance,small business', description: 'Learn how to manage cash flow effectively to keep your business healthy. Includes free templates and real-world examples.', content_url: 'https://rifah.in/resources/cash-flow-management', published_date: '2024-01-20' },
  { resource_id: `RSRC-${YEAR}-0003`, title: 'Inventory Management 101',                 category: 'Operations',  access_tier: 'FREE',    view_count: 167, rating: 4.1, tags: 'inventory,operations,stock', description: 'Step-by-step guide to setting up basic inventory management for product-based businesses. Includes Excel templates.', content_url: 'https://rifah.in/resources/inventory-101', published_date: '2024-02-01' },
  { resource_id: `RSRC-${YEAR}-0004`, title: 'Hiring Your First Employee',               category: 'HR',          access_tier: 'FREE',    view_count: 142, rating: 4.6, tags: 'hiring,hr,employee', description: 'Everything you need to know before making your first hire — contracts, PF, ESI, and onboarding checklist.', content_url: 'https://rifah.in/resources/first-hire-guide', published_date: '2024-02-10' },
  { resource_id: `RSRC-${YEAR}-0005`, title: 'GST Filing Made Simple',                   category: 'Legal',       access_tier: 'FREE',    view_count: 312, rating: 4.7, tags: 'gst,tax,compliance', description: 'Plain-language guide to GST for small businesses. Covers registration, filing timelines, and common mistakes to avoid.', content_url: 'https://rifah.in/resources/gst-guide', published_date: '2024-02-15' },
  { resource_id: `RSRC-${YEAR}-0006`, title: 'Introduction to Business Technology',      category: 'Technology',  access_tier: 'FREE',    view_count: 128, rating: 4.0, tags: 'technology,software,tools', description: 'Overview of essential technology tools every small business should use — accounting, communication, and productivity.', content_url: 'https://rifah.in/resources/business-tech-intro', published_date: '2024-03-01' },
  { resource_id: `RSRC-${YEAR}-0007`, title: 'Building a Sales Pipeline',                category: 'Sales',       access_tier: 'FREE',    view_count: 189, rating: 4.4, tags: 'sales,pipeline,crm', description: 'How to build and manage a simple sales pipeline without expensive CRM software. Perfect for B2B businesses.', content_url: 'https://rifah.in/resources/sales-pipeline', published_date: '2024-03-10' },
  { resource_id: `RSRC-${YEAR}-0008`, title: 'WhatsApp Business for Entrepreneurs',      category: 'Marketing',   access_tier: 'FREE',    view_count: 276, rating: 4.5, tags: 'whatsapp,marketing,communication', description: 'How to use WhatsApp Business to grow your customer base and automate follow-ups without any coding.', content_url: 'https://rifah.in/resources/whatsapp-business', published_date: '2024-03-20' },
  { resource_id: `RSRC-${YEAR}-0009`, title: 'Vendor Negotiation Techniques',            category: 'Operations',  access_tier: 'FREE',    view_count: 156, rating: 4.2, tags: 'vendor,negotiation,procurement', description: 'Practical negotiation scripts and strategies for getting better rates from suppliers and vendors.', content_url: 'https://rifah.in/resources/vendor-negotiation', published_date: '2024-04-01' },
  { resource_id: `RSRC-${YEAR}-0010`, title: 'Understanding Business Credit Scores',     category: 'Finance',     access_tier: 'FREE',    view_count: 134, rating: 4.1, tags: 'credit,finance,loan', description: 'What is a business credit score, how is it calculated, and how to improve yours to get better loan terms.', content_url: 'https://rifah.in/resources/business-credit', published_date: '2024-04-10' },
  // PREMIUM articles (5)
  { resource_id: `RSRC-${YEAR}-0011`, title: 'Advanced Digital Advertising Strategies',  category: 'Marketing',   access_tier: 'PREMIUM', view_count: 89,  rating: 4.8, tags: 'advertising,google ads,meta ads', description: 'Advanced playbook for Google Ads and Meta Ads for B2B businesses. Includes audience targeting, bidding strategies, and ROAS optimisation.', content_url: 'https://rifah.in/resources/advanced-digital-ads', published_date: '2024-04-15' },
  { resource_id: `RSRC-${YEAR}-0012`, title: 'Financial Modelling for Business Growth',  category: 'Finance',     access_tier: 'PREMIUM', view_count: 72,  rating: 4.9, tags: 'financial model,growth,excel', description: 'Build a 3-year financial model for your business. Includes revenue projections, scenario analysis, and investor-ready templates.', content_url: 'https://rifah.in/resources/financial-modelling', published_date: '2024-05-01' },
  { resource_id: `RSRC-${YEAR}-0013`, title: 'ISO Certification Step-by-Step',           category: 'Operations',  access_tier: 'PREMIUM', view_count: 61,  rating: 4.6, tags: 'iso,certification,quality', description: 'Complete roadmap to getting ISO 9001 certified — from gap analysis to audit preparation. Includes document templates.', content_url: 'https://rifah.in/resources/iso-certification', published_date: '2024-05-10' },
  { resource_id: `RSRC-${YEAR}-0014`, title: 'Employment Law Essentials for MSMEs',      category: 'Legal',       access_tier: 'PREMIUM', view_count: 55,  rating: 4.5, tags: 'employment law,legal,hr', description: 'In-depth guide to Indian employment laws — Shops & Establishments Act, Labour Codes, PF, ESIC, and termination procedures.', content_url: 'https://rifah.in/resources/employment-law', published_date: '2024-05-20' },
  { resource_id: `RSRC-${YEAR}-0015`, title: 'Cloud Tools to Scale Your Business',       category: 'Technology',  access_tier: 'PREMIUM', view_count: 67,  rating: 4.7, tags: 'cloud,saas,technology,scale', description: 'Top 20 cloud tools for scaling SMEs — ERP, CRM, HR, and project management. Includes comparison matrix and implementation checklist.', content_url: 'https://rifah.in/resources/cloud-tools-scale', published_date: '2024-06-01' },
];

// ── VIDEOS ────────────────────────────────────────────────────────────────────
const VIDEOS = [
  // FREE videos (5)
  { resource_id: `RSRC-${YEAR}-0101`, title: 'Introduction to RIFAH Connect',            category: 'General',     access_tier: 'FREE',    view_count: 1245, rating: 4.8, duration_minutes: 5,  tags: 'intro,rifah,getting started', description: 'Get started with RIFAH Connect — how to register, share leads, and connect with buyers and vendors across India.', content_url: 'https://www.youtube.com/watch?v=rifah-intro', published_date: '2024-01-01' },
  { resource_id: `RSRC-${YEAR}-0102`, title: 'How to Create Your First Lead',            category: 'General',     access_tier: 'FREE',    view_count: 892,  rating: 4.7, duration_minutes: 8,  tags: 'lead,share,how to', description: 'Step-by-step walkthrough of creating and sharing a business lead on RIFAH Connect via WhatsApp.', content_url: 'https://www.youtube.com/watch?v=rifah-first-lead', published_date: '2024-01-05' },
  { resource_id: `RSRC-${YEAR}-0103`, title: 'WhatsApp for Business — Quick Tips',       category: 'Marketing',   access_tier: 'FREE',    view_count: 756,  rating: 4.6, duration_minutes: 12, tags: 'whatsapp,marketing,tips', description: '10 practical WhatsApp Business tips that every entrepreneur should know to grow their customer base fast.', content_url: 'https://www.youtube.com/watch?v=rifah-wa-tips', published_date: '2024-01-15' },
  { resource_id: `RSRC-${YEAR}-0104`, title: 'Basics of Business Finance',              category: 'Finance',     access_tier: 'FREE',    view_count: 634,  rating: 4.5, duration_minutes: 15, tags: 'finance,basics,accounting', description: 'Understand P&L, balance sheet, and cash flow in simple terms. No accounting background needed.', content_url: 'https://www.youtube.com/watch?v=rifah-finance-basics', published_date: '2024-01-20' },
  { resource_id: `RSRC-${YEAR}-0105`, title: 'Getting Started with GST',                category: 'Legal',       access_tier: 'FREE',    view_count: 598,  rating: 4.4, duration_minutes: 10, tags: 'gst,tax,compliance,beginner', description: 'Watch this before you file your first GST return. Covers GSTR-1, GSTR-3B, and input tax credit basics.', content_url: 'https://www.youtube.com/watch?v=rifah-gst-basics', published_date: '2024-02-01' },
  // PREMIUM videos (5)
  { resource_id: `RSRC-${YEAR}-0106`, title: 'Advanced Lead Generation Masterclass',    category: 'Sales',       access_tier: 'PREMIUM', view_count: 312,  rating: 4.9, duration_minutes: 45, tags: 'lead generation,advanced,sales', description: 'Deep-dive into B2B lead generation — LinkedIn outreach, cold email, RIFAH premium matching, and referral systems.', content_url: 'https://www.youtube.com/watch?v=rifah-lead-gen-adv', published_date: '2024-03-01' },
  { resource_id: `RSRC-${YEAR}-0107`, title: 'Digital Marketing Masterclass (Full)',    category: 'Marketing',   access_tier: 'PREMIUM', view_count: 287,  rating: 4.8, duration_minutes: 60, tags: 'digital marketing,masterclass,full course', description: 'Complete digital marketing course for Indian SMEs — Google, Meta, SEO, email, and WhatsApp marketing in one session.', content_url: 'https://www.youtube.com/watch?v=rifah-dm-masterclass', published_date: '2024-03-15' },
  { resource_id: `RSRC-${YEAR}-0108`, title: 'Financial Planning for Business Growth',  category: 'Finance',     access_tier: 'PREMIUM', view_count: 245,  rating: 4.7, duration_minutes: 55, tags: 'financial planning,growth,investment', description: 'Advanced financial planning workshop — building a 5-year plan, raising capital, and managing growth risks.', content_url: 'https://www.youtube.com/watch?v=rifah-fin-planning', published_date: '2024-04-01' },
  { resource_id: `RSRC-${YEAR}-0109`, title: 'Operations Excellence for MSMEs',         category: 'Operations',  access_tier: 'PREMIUM', view_count: 198,  rating: 4.6, duration_minutes: 40, tags: 'operations,efficiency,lean', description: 'Implement lean manufacturing and operations excellence in your factory or service business.', content_url: 'https://www.youtube.com/watch?v=rifah-ops-excellence', published_date: '2024-04-15' },
  { resource_id: `RSRC-${YEAR}-0110`, title: 'HR Best Practices for Growing Teams',     category: 'HR',          access_tier: 'PREMIUM', view_count: 167,  rating: 4.5, duration_minutes: 35, tags: 'hr,people management,team', description: 'Build a high-performing team from scratch — hiring, performance management, retention, and culture for Indian SMEs.', content_url: 'https://www.youtube.com/watch?v=rifah-hr-best', published_date: '2024-05-01' },
];

// ── EVENTS ────────────────────────────────────────────────────────────────────
const EVENTS = [
  {
    event_id: `EVENT-${YEAR}-0001`,
    event_name: 'RIFAH Monthly Networking Meetup',
    event_type: 'NETWORKING',
    access_tier: 'ALL',
    status: 'UPCOMING',
    event_date: futureDate(7),
    event_duration_hours: 2,
    location: 'Hotel Sheraton, Pune, Maharashtra',
    organizer: 'RIFAH Chamber of Commerce',
    cost: 0,
    registration_link: 'https://rifah.in/events/networking-mar',
    registration_deadline: futureDate(5),
    max_participants: 100,
    current_registrations: 42,
    description: 'Monthly in-person networking meetup for RIFAH members. Connect with buyers, vendors, and service providers across Pune and Maharashtra. Light refreshments provided. FREE for all members.',
    is_active: 1,
    created_at: futureDate(0),
  },
  {
    event_id: `EVENT-${YEAR}-0002`,
    event_name: 'Digital Marketing Webinar — Grow Your Business Online',
    event_type: 'WEBINAR',
    access_tier: 'PREMIUM',
    status: 'UPCOMING',
    event_date: futureDate(14),
    event_duration_hours: 1.5,
    location: 'Online (Zoom)',
    organizer: 'Amit Sharma — Digital Marketing Expert',
    cost: 0,
    registration_link: 'https://rifah.in/events/dm-webinar',
    registration_deadline: futureDate(13),
    max_participants: 200,
    current_registrations: 87,
    description: 'Live webinar on digital marketing strategies for Indian SMEs. Topics: Google Ads, Meta Ads, WhatsApp marketing, and SEO. Q&A session included. PREMIUM members only.',
    is_active: 1,
    created_at: futureDate(0),
  },
  {
    event_id: `EVENT-${YEAR}-0003`,
    event_name: 'Business Growth Workshop — Scale to ₹1 Crore',
    event_type: 'WORKSHOP',
    access_tier: 'ALL',
    status: 'UPCOMING',
    event_date: futureDate(21),
    event_duration_hours: 4,
    location: 'RIFAH Business Centre, Mumbai, Maharashtra',
    organizer: 'RIFAH Growth Team',
    cost: 999,
    registration_link: 'https://rifah.in/events/growth-workshop',
    registration_deadline: futureDate(18),
    max_participants: 50,
    current_registrations: 23,
    description: 'Full-day intensive workshop on scaling your MSME to ₹1 crore revenue. Covers sales systems, operations, finance, and team building. Includes workbook and 30-day follow-up plan. Open to all RIFAH members.',
    is_active: 1,
    created_at: futureDate(0),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createResource(rec) {
  const check = await erp.request(`${BASE}/api/resource/RIFAH Resource/${encodeURIComponent(rec.resource_id)}`, 'GET');
  if (check.status === 200 && check.body?.data) {
    console.log(c.grey(`    ⟳  ${rec.resource_id} already exists`));
    return true;
  }
  const r = await erp.request(`${BASE}/api/resource/RIFAH Resource`, 'POST', {
    ...rec,
    resource_type: rec.duration_minutes ? 'VIDEO' : 'ARTICLE',
  });
  if (r.status === 200 || r.status === 201) {
    console.log(c.green(`    ✓  ${rec.resource_id}  ${rec.title}`));
    return true;
  }
  console.log(c.red(`    ✗  ${rec.resource_id} — ${JSON.stringify(r.body).substring(0, 150)}`));
  return false;
}

async function createEvent(rec) {
  const check = await erp.request(`${BASE}/api/resource/RIFAH Event/${encodeURIComponent(rec.event_id)}`, 'GET');
  if (check.status === 200 && check.body?.data) {
    console.log(c.grey(`    ⟳  ${rec.event_id} already exists`));
    return true;
  }
  const r = await erp.request(`${BASE}/api/resource/RIFAH Event`, 'POST', rec);
  if (r.status === 200 || r.status === 201) {
    console.log(c.green(`    ✓  ${rec.event_id}  ${rec.event_name}`));
    return true;
  }
  console.log(c.red(`    ✗  ${rec.event_id} — ${JSON.stringify(r.body).substring(0, 150)}`));
  return false;
}

async function cleanAll() {
  console.log(c.bold('\n  Cleaning Flow 4 seed data...\n'));
  const allIds = [...ARTICLES, ...VIDEOS].map(r => r.resource_id);
  for (const id of allIds) {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Resource/${encodeURIComponent(id)}`, 'DELETE');
    r.status < 300 ? console.log(c.green(`  ✓  Deleted resource ${id}`)) : console.log(c.grey(`  -  ${id} not found`));
  }
  for (const ev of EVENTS) {
    const r = await erp.request(`${BASE}/api/resource/RIFAH Event/${encodeURIComponent(ev.event_id)}`, 'DELETE');
    r.status < 300 ? console.log(c.green(`  ✓  Deleted event ${ev.event_id}`)) : console.log(c.grey(`  -  ${ev.event_id} not found`));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (process.argv.includes('--clean')) {
    await cleanAll();
    return;
  }

  console.log(c.bold('\n══════════════════════════════════════════'));
  console.log(c.bold('  RIFAH Connect — Flow 4 Seed Data'));
  console.log(c.bold('══════════════════════════════════════════\n'));

  let passed = 0; let total = 0;

  console.log(c.bold('  📖 Articles (15)'));
  for (const a of ARTICLES) { total++; if (await createResource(a)) passed++; }

  console.log(c.bold('\n  📹 Videos (10)'));
  for (const v of VIDEOS) { total++; if (await createResource(v)) passed++; }

  console.log(c.bold('\n  📅 Events (3)'));
  for (const e of EVENTS) { total++; if (await createEvent(e)) passed++; }

  console.log(`\n  ${passed}/${total} records seeded`);
  console.log(c.bold('\n══════════════════════════════════════════\n'));
})();
