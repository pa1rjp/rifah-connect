#!/usr/bin/env node
/**
 * RIFAH Connect — Populate Test Leads for Flow 3
 *
 * Creates sample RIFAH Lead records in ERPNext so Flow 3 search paths
 * (Browse by Category, Location, Urgency, View Recent) can be tested.
 *
 * Usage:
 *   node scripts/populate_test_leads.js           # create all test leads
 *   node scripts/populate_test_leads.js --clean   # delete all test leads first, then create
 *   node scripts/populate_test_leads.js --delete  # delete test leads only
 *   node scripts/populate_test_leads.js --list    # list existing leads
 */

const http  = require('http');
const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE    = process.env.ERPNEXT_URL        || 'http://localhost:8080';
const API_KEY = process.env.ERPNEXT_API_KEY    || '';
const API_SEC = process.env.ERPNEXT_API_SECRET || '';
const SITE    = process.env.ERPNEXT_SITE       || 'rifah.localhost';

const HEADERS = {
  'Authorization': `token ${API_KEY}:${API_SEC}`,
  'Content-Type': 'application/json',
  'Host': SITE,
};

// ── Core request ──────────────────────────────────────────────────────────────
function request(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const data   = body ? JSON.stringify(body) : null;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port,
      path:     parsed.pathname + (parsed.search || ''),
      method,
      headers:  { ...HEADERS, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const enc = v => encodeURIComponent(JSON.stringify(v));

// ── Test lead data ────────────────────────────────────────────────────────────
// 20 leads covering all types, urgencies, and locations

const TEST_LEADS = [
  // BUY leads
  {
    title: 'Plastic Bottles 500ml Food Grade - Bulk Order',
    description: 'Need 10,000 units of 500ml food-grade plastic bottles. HDPE or PET material. Preferably BPA-free with tamper-evident cap.',
    lead_type: 'BUY',
    location: 'Pune, Maharashtra',
    urgency: 'URGENT',
    budget: '50000',
    industry: 'Packaging',
    member_name: 'Test Buyer 1',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Cotton T-Shirts Bulk - 500 pcs Assorted Sizes',
    description: 'Corporate gifting requirement. 500 pieces of round-neck cotton t-shirts (S/M/L/XL). Single colour with chest print possible.',
    lead_type: 'BUY',
    location: 'Mumbai, Maharashtra',
    urgency: 'THIS WEEK',
    budget: '75000',
    industry: 'Textile',
    member_name: 'Test Buyer 2',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Industrial Packaging Material - Corrugated Boxes',
    description: 'Monthly requirement of corrugated boxes in sizes 12x10x8 and 18x14x10 inches. Need approx 5,000 units/month.',
    lead_type: 'BUY',
    location: 'All India',
    urgency: 'THIS MONTH',
    budget: '120000',
    industry: 'Packaging',
    member_name: 'Test Buyer 3',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'PREM',
  },
  {
    title: 'Electronic Components - Resistors and Capacitors',
    description: 'Procurement of standard electronic components: 10K resistors (qty: 50,000), 100uF capacitors (qty: 20,000). SMD preferred.',
    lead_type: 'BUY',
    location: 'Bengaluru, Karnataka',
    urgency: 'FLEXIBLE',
    budget: '200000',
    industry: 'Electronics',
    member_name: 'Test Buyer 4',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'PREM',
  },
  {
    title: 'Steel Pipes 2 inch - 500 meters',
    description: 'MS steel pipes 2-inch diameter, 3mm wall thickness, in 6-meter lengths. Total 500 meters needed for construction project.',
    lead_type: 'BUY',
    location: 'Hyderabad, Telangana',
    urgency: 'THIS WEEK',
    budget: '180000',
    industry: 'Construction',
    member_name: 'Test Buyer 5',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },

  // SELL leads
  {
    title: 'Premium Grade A Basmati Rice - 100 MT Available',
    description: 'Direct from mill. Premium Grade A Basmati rice, freshly milled. Available 100 metric tons immediately. Bulk buyers preferred.',
    lead_type: 'SELL',
    location: 'Amritsar, Punjab',
    urgency: 'URGENT',
    budget: '4500000',
    industry: 'Food & Agriculture',
    member_name: 'Test Seller 1',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'PREM',
  },
  {
    title: 'Refurbished Laptops Dell/HP - 50 units',
    description: 'Certified refurbished laptops, Core i5 8th Gen, 8GB RAM, 256GB SSD. All units tested and with 6-month warranty.',
    lead_type: 'SELL',
    location: 'Delhi, NCR',
    urgency: 'THIS MONTH',
    budget: '1250000',
    industry: 'IT & Electronics',
    member_name: 'Test Seller 2',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Stainless Steel Scrap - Grade 304',
    description: 'SS 304 grade scrap material, approximately 5 tons available. Good quality, minimal contamination. Suitable for remelting.',
    lead_type: 'SELL',
    location: 'Surat, Gujarat',
    urgency: 'THIS WEEK',
    budget: '350000',
    industry: 'Manufacturing',
    member_name: 'Test Seller 3',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },

  // SERVICE NEED leads
  {
    title: 'Digital Marketing Agency for E-commerce Brand',
    description: 'Looking for experienced digital marketing agency for our ethnic wear e-commerce brand. Services needed: Meta Ads, Google Ads, SEO, and WhatsApp marketing. Monthly budget: 1-1.5 lakh.',
    lead_type: 'SERVICE NEED',
    location: 'Mumbai, Maharashtra',
    urgency: 'THIS MONTH',
    budget: '150000',
    industry: 'Marketing',
    member_name: 'Test Buyer 6',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'PREM',
  },
  {
    title: 'Web Development - B2B Marketplace Portal',
    description: 'Need experienced web developer / agency to build a B2B marketplace portal. Tech stack: React + Node.js or similar. Timeline: 3 months. Must have portfolio of similar projects.',
    lead_type: 'SERVICE NEED',
    location: 'Bengaluru, Karnataka',
    urgency: 'THIS MONTH',
    budget: '500000',
    industry: 'IT',
    member_name: 'Test Buyer 7',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'PREM',
  },
  {
    title: 'Chartered Accountant for GST Filing and Compliance',
    description: 'Small manufacturing business needs CA for monthly GST filing, annual returns, and compliance advisory. Prefer CA with manufacturing industry experience.',
    lead_type: 'SERVICE NEED',
    location: 'Pune, Maharashtra',
    urgency: 'URGENT',
    budget: '15000',
    industry: 'Finance',
    member_name: 'Test Buyer 8',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Courier & Logistics Partner - Pan India',
    description: 'Established e-commerce seller looking for reliable courier partner. Volume: 200-300 shipments/day. Need competitive rates for surface and air modes.',
    lead_type: 'SERVICE NEED',
    location: 'All India',
    urgency: 'THIS WEEK',
    budget: '0',
    industry: 'Logistics',
    member_name: 'Test Buyer 9',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Interior Designer for 3000 sq ft Office',
    description: 'Corporate office interior design and execution for 3000 sq ft space in a commercial building. Looking for complete turnkey solution including furniture.',
    lead_type: 'SERVICE NEED',
    location: 'Hyderabad, Telangana',
    urgency: 'FLEXIBLE',
    budget: '2500000',
    industry: 'Interior Design',
    member_name: 'Test Buyer 10',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'PREM',
  },

  // SERVICE OFFER leads
  {
    title: 'GST Registration & Compliance Services - Affordable',
    description: 'Offering GST registration, monthly filing, and annual compliance services for MSMEs. 10+ years experience. Special rates for startups and new businesses.',
    lead_type: 'SERVICE OFFER',
    location: 'All India',
    urgency: 'FLEXIBLE',
    budget: '5000',
    industry: 'Finance',
    member_name: 'Test Seller 4',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Freight Forwarding & Customs Clearance - Import/Export',
    description: 'Full-service freight forwarding: air freight, sea freight, customs clearance, and door-to-door delivery. 15 years in trade logistics. Licensed customs broker.',
    lead_type: 'SERVICE OFFER',
    location: 'Mumbai, Maharashtra',
    urgency: 'THIS MONTH',
    budget: '0',
    industry: 'Logistics',
    member_name: 'Test Seller 5',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'PREM',
  },
  {
    title: 'Android & iOS App Development - React Native',
    description: 'Experienced React Native developer offering end-to-end mobile app development. Portfolio includes 20+ apps on Play Store/App Store. Also handle backend API development.',
    lead_type: 'SERVICE OFFER',
    location: 'Chennai, Tamil Nadu',
    urgency: 'THIS WEEK',
    budget: '300000',
    industry: 'IT',
    member_name: 'Test Seller 6',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Social Media Management - Instagram & Facebook',
    description: 'Complete social media management for brands: content creation, posting schedule, community management, and monthly analytics report. Clients in fashion, food, and real estate.',
    lead_type: 'SERVICE OFFER',
    location: 'Delhi, NCR',
    urgency: 'FLEXIBLE',
    budget: '25000',
    industry: 'Marketing',
    member_name: 'Test Seller 7',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Machine Maintenance & AMC - Industrial Equipment',
    description: 'Preventive maintenance and AMC contracts for industrial machinery: CNC machines, hydraulic presses, conveyor systems. Available pan Maharashtra.',
    lead_type: 'SERVICE OFFER',
    location: 'Pune, Maharashtra',
    urgency: 'THIS MONTH',
    budget: '0',
    industry: 'Manufacturing',
    member_name: 'Test Seller 8',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
  {
    title: 'Photography & Videography - Product Shoots',
    description: 'Professional product photography and videography studio. Specialise in e-commerce product shoots, catalogue shoots, and promotional videos. Quick turnaround.',
    lead_type: 'SERVICE OFFER',
    location: 'Mumbai, Maharashtra',
    urgency: 'THIS WEEK',
    budget: '15000',
    industry: 'Media',
    member_name: 'Test Seller 9',
    member_phone: '919000000099',
    member_id: 'TEST-BUYER-001',
    tier: 'FREE',
  },
];

// ── ERPNext operations ────────────────────────────────────────────────────────
async function getLeadCount() {
  const r = await request(`${BASE}/api/resource/RIFAH Lead?limit=1&fields=${enc(['name'])}`);
  return r.body?.data?.length ?? 0;
}

async function listLeads(limit = 50) {
  const fields = enc(['name', 'lead_id', 'lead_type', 'title', 'location', 'urgency', 'status']);
  const r = await request(`${BASE}/api/resource/RIFAH Lead?limit=${limit}&fields=${fields}&order_by=creation+desc`);
  return r.body?.data || [];
}

async function createLead(lead, index) {
  // Generate a lead_id similar to how Flow 2A/2B does it
  const tier  = lead.tier === 'PREM' || lead.tier === 'PREMIUM' ? 'PREM' : 'FREE';
  const year  = new Date().getFullYear();
  const num   = String(index + 1).padStart(4, '0');
  const leadId = `LEAD-${tier}-TEST-${num}`;

  const payload = {
    lead_id:          leadId,
    lead_type:        lead.lead_type,
    title:            lead.title,
    description:      lead.description,
    location:         lead.location,
    urgency:          lead.urgency,
    budget:           lead.budget || '',
    member_name:      lead.member_name,
    member_phone:     lead.member_phone,
    member_id:        lead.member_id,
    tier:             (lead.tier === 'PREM') ? 'PREMIUM' : lead.tier,
    status:           'Posted to Groups',
    is_active:        1,
    interested_vendors: '[]',
  };

  const r = await request(`${BASE}/api/resource/RIFAH Lead`, 'POST', payload);
  if (r.body?.data) {
    return { ok: true, leadId, name: r.body.data.name };
  }
  return { ok: false, error: r.body?.exception || r.body?.message || JSON.stringify(r.body) };
}

async function deleteTestLeads() {
  const leads = await listLeads(200);
  const testLeads = leads.filter(l => l.lead_id && l.lead_id.includes('TEST'));
  if (testLeads.length === 0) {
    console.log('No test leads found.');
    return;
  }
  console.log(`Deleting ${testLeads.length} test leads...`);
  for (const lead of testLeads) {
    const r = await request(`${BASE}/api/resource/RIFAH Lead/${lead.name}`, 'DELETE');
    const ok = r.status < 300;
    console.log(` ${ok ? '✓' : '✗'} Deleted: ${lead.lead_id} (${lead.name})`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args   = process.argv.slice(2);
  const clean  = args.includes('--clean');
  const del    = args.includes('--delete');
  const list   = args.includes('--list');

  console.log(`\n📋 RIFAH Connect — Test Lead Population Script`);
  console.log(`🔗 ERPNext: ${BASE}\n`);

  if (list) {
    const leads = await listLeads(50);
    if (leads.length === 0) {
      console.log('No leads found.');
    } else {
      console.log(`Found ${leads.length} leads:\n`);
      leads.forEach(l => {
        console.log(`  ${l.lead_id || l.name}  [${l.lead_type}]  ${l.urgency}  📍${l.location}  (${l.status})`);
      });
    }
    return;
  }

  if (del || clean) {
    await deleteTestLeads();
    if (del) return;
    console.log('');
  }

  console.log(`Creating ${TEST_LEADS.length} test leads...\n`);

  let created = 0, failed = 0;
  for (let i = 0; i < TEST_LEADS.length; i++) {
    const lead = TEST_LEADS[i];
    process.stdout.write(`  [${i+1}/${TEST_LEADS.length}] ${lead.lead_type} — ${lead.title.substring(0, 50)}...`);
    const result = await createLead(lead, i);
    if (result.ok) {
      process.stdout.write(` ✓ ${result.leadId}\n`);
      created++;
    } else {
      process.stdout.write(` ✗ FAILED: ${result.error}\n`);
      failed++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Created: ${created}  ❌ Failed: ${failed}`);
  console.log(`\nBreakdown:`);
  const types = ['BUY','SELL','SERVICE NEED','SERVICE OFFER'];
  types.forEach(t => {
    const count = TEST_LEADS.filter(l => l.lead_type === t).length;
    console.log(`  ${t}: ${count} leads`);
  });
  const urgencies = ['URGENT','THIS WEEK','THIS MONTH','FLEXIBLE'];
  urgencies.forEach(u => {
    const count = TEST_LEADS.filter(l => l.urgency === u).length;
    console.log(`  ${u}: ${count} leads`);
  });
  console.log(`\nRun "node scripts/populate_test_leads.js --list" to verify.`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
