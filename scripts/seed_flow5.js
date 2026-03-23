#!/usr/bin/env node
/**
 * RIFAH Connect — Flow 5 Seed Data
 * Seeds: RIFAH FAQ (30+ entries), RIFAH Support Agent (3)
 *
 * Usage:
 *   node scripts/seed_flow5.js            → seed all
 *   node scripts/seed_flow5.js --clean    → delete seeded records then re-seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const erp = require('./erpnext');

const BASE = process.env.ERPNEXT_URL || 'http://localhost:8080';
const YEAR = new Date().getFullYear();

const c = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  blue:  s => `\x1b[34m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
  grey:  s => `\x1b[90m${s}\x1b[0m`,
};

// ── FAQ Data ──────────────────────────────────────────────────────────────────

const FAQS = [
  // REGISTRATION (5)
  {
    faq_id: 'FAQ-0001', category: 'REGISTRATION', access_tier: 'ALL',
    question: 'How do I register on RIFAH Connect?',
    answer: 'Send "Hi" to this WhatsApp number. Select option 1 (Register Business) from the main menu. Follow the prompts to enter your business details — name, city, industry, and years operating. Complete the process by selecting your membership tier (FREE or PREMIUM).',
    keywords: 'register, signup, join, new member, create account',
  },
  {
    faq_id: 'FAQ-0002', category: 'REGISTRATION', access_tier: 'ALL',
    question: 'How do I update my business profile?',
    answer: 'Send "Hi" and select option 1 from the main menu. The system will detect you\'re an existing member and show your current profile. You can update your business name, city, industry, and other details from there.',
    keywords: 'update profile, edit business, change details, modify account',
  },
  {
    faq_id: 'FAQ-0003', category: 'REGISTRATION', access_tier: 'ALL',
    question: 'Can I change my registered WhatsApp number?',
    answer: 'WhatsApp number changes require manual verification by our support team. Please create a support ticket (option 5 → Create Support Ticket) with your old and new number details, along with your Membership ID. Our team will update it within 24-48 hours.',
    keywords: 'change number, update phone, new whatsapp',
  },
  {
    faq_id: 'FAQ-0004', category: 'REGISTRATION', access_tier: 'ALL',
    question: 'What documents are required for registration?',
    answer: 'For FREE registration, no documents are required — just basic business details. For PREMIUM membership, you need to upload a business verification document (GST certificate, trade license, or incorporation certificate) as a PDF or image.',
    keywords: 'documents, verification, GST, trade license, incorporation',
  },
  {
    faq_id: 'FAQ-0005', category: 'REGISTRATION', access_tier: 'ALL',
    question: 'What is the difference between FREE and PREMIUM membership?',
    answer: 'FREE members can post 2 leads/month, browse basic resources, and get 24-48 hour support response. PREMIUM members get unlimited leads, AI-matched lead recommendations, full resource library access (articles, videos, training), priority 4-8 hour support, dedicated support manager, and access to exclusive events.',
    keywords: 'free vs premium, membership comparison, upgrade, benefits',
  },

  // MEMBERSHIP (5)
  {
    faq_id: 'FAQ-0006', category: 'MEMBERSHIP', access_tier: 'ALL',
    question: 'How do I upgrade from FREE to PREMIUM?',
    answer: 'From the main menu, select option 1 (Register/Update). When shown your profile, choose "Upgrade to Premium". You\'ll receive a payment link. After payment is confirmed, your tier will be upgraded immediately and you\'ll receive your RIFAH Dashboard access.',
    keywords: 'upgrade, premium, paid membership',
  },
  {
    faq_id: 'FAQ-0007', category: 'MEMBERSHIP', access_tier: 'ALL',
    question: 'What payment methods are accepted for Premium?',
    answer: 'We accept UPI (PhonePe, Google Pay, Paytm), net banking, and debit/credit cards via Razorpay. Payments are processed securely and membership is activated within 15 minutes of successful payment.',
    keywords: 'payment, UPI, Razorpay, credit card, debit card',
  },
  {
    faq_id: 'FAQ-0008', category: 'MEMBERSHIP', access_tier: 'ALL',
    question: 'How long does a Premium membership last?',
    answer: 'Premium membership is valid for 12 months from the date of activation. You\'ll receive a renewal reminder 30 days before expiry. Renewing before expiry ensures uninterrupted service.',
    keywords: 'membership validity, expiry, renewal, duration, 12 months',
  },
  {
    faq_id: 'FAQ-0009', category: 'MEMBERSHIP', access_tier: 'ALL',
    question: 'Can I get a refund on my Premium membership?',
    answer: 'Refunds are available within 7 days of purchase if you have not used any premium features. After 7 days or after using premium features, refunds are not available. For refund requests, create a support ticket with your transaction ID.',
    keywords: 'refund, cancellation, money back',
  },
  {
    faq_id: 'FAQ-0010', category: 'MEMBERSHIP', access_tier: 'PREMIUM',
    question: 'What is my RIFAH Dashboard and how do I access it?',
    answer: 'Your RIFAH Dashboard is a web portal to manage your business profile, leads, analytics, and resources. After Premium activation, you receive a dashboard URL and auto-generated password via WhatsApp. Access it from any browser. Contact support if you need to reset your password.',
    keywords: 'dashboard, portal, login, web access',
  },

  // LEADS (5)
  {
    faq_id: 'FAQ-0011', category: 'LEADS', access_tier: 'ALL',
    question: 'How do I post a new lead on RIFAH Connect?',
    answer: 'From the main menu, select option 2 (Share a Lead). Choose your lead type (buyer need, seller offer, or service). Describe your requirement clearly, add location and urgency level. For PREMIUM members, AI questions will help qualify your lead better and match it to the right vendors.',
    keywords: 'post lead, share lead, create requirement, new lead',
  },
  {
    faq_id: 'FAQ-0012', category: 'LEADS', access_tier: 'ALL',
    question: 'How many leads can I post per month?',
    answer: 'FREE members can post up to 2 leads per month. PREMIUM members have no monthly limit and can post unlimited leads. Lead count resets at the beginning of each calendar month.',
    keywords: 'lead limit, how many leads, monthly limit',
  },
  {
    faq_id: 'FAQ-0013', category: 'LEADS', access_tier: 'ALL',
    question: 'How long does it take for my lead to be approved?',
    answer: 'Leads are reviewed within 2-4 hours during business hours (9 AM - 6 PM, Mon-Sat). Leads posted outside business hours are reviewed the next morning. You\'ll receive a WhatsApp notification when your lead is approved and shared with relevant groups.',
    keywords: 'lead approval, review time, pending lead',
  },
  {
    faq_id: 'FAQ-0014', category: 'LEADS', access_tier: 'ALL',
    question: 'How do vendors respond to my lead?',
    answer: 'Vendors who see your lead in their WhatsApp group can express interest by selecting option 3 (Find a Lead) and submitting their qualification details. You\'ll receive a WhatsApp notification with each interested vendor\'s business details. PREMIUM members get AI-scored vendor matches.',
    keywords: 'vendor response, lead response, interested vendors',
  },
  {
    faq_id: 'FAQ-0015', category: 'LEADS', access_tier: 'ALL',
    question: 'Can I edit or delete a lead after posting?',
    answer: 'Once a lead is submitted, it goes through approval and cannot be edited. If you need changes, create a support ticket. To cancel/withdraw a lead, reply CANCEL to the confirmation message within 30 minutes of posting, or create a support ticket for older leads.',
    keywords: 'edit lead, delete lead, cancel lead, modify requirement',
  },

  // PAYMENTS (4)
  {
    faq_id: 'FAQ-0016', category: 'PAYMENTS', access_tier: 'ALL',
    question: 'I made a payment but my Premium is not activated. What should I do?',
    answer: 'Premium activation usually happens within 15 minutes of payment. If not activated after 30 minutes, take a screenshot of your payment confirmation and create a support ticket (option 5 → Create Support Ticket). Include your transaction ID and phone number. Our team will manually verify and activate within 2 hours.',
    keywords: 'payment not reflected, premium not activated, payment issue',
  },
  {
    faq_id: 'FAQ-0017', category: 'PAYMENTS', access_tier: 'ALL',
    question: 'How do I get my payment receipt or invoice?',
    answer: 'Payment receipts are sent automatically to your registered email address after successful payment. For GST invoices, create a support ticket with your GSTIN and billing address. Invoices are issued within 3 business days.',
    keywords: 'receipt, invoice, GST invoice, payment proof',
  },
  {
    faq_id: 'FAQ-0018', category: 'PAYMENTS', access_tier: 'ALL',
    question: 'My payment failed but amount was deducted. What happens?',
    answer: 'If a payment fails but amount is deducted, it will automatically be refunded to your original payment method within 5-7 business days by your bank or payment processor. This is a bank-level reversal and does not require any action from RIFAH. If not reversed after 7 days, contact your bank with the transaction reference.',
    keywords: 'failed payment, deducted, refund, bank reversal',
  },
  {
    faq_id: 'FAQ-0019', category: 'PAYMENTS', access_tier: 'ALL',
    question: 'Is my payment information stored securely?',
    answer: 'RIFAH Connect uses Razorpay for all payment processing. We do not store any payment card details. Razorpay is PCI DSS Level 1 compliant — the highest level of payment security certification. All transactions are encrypted with 256-bit SSL.',
    keywords: 'payment security, card data, PCI, secure payment',
  },

  // EVENTS (4)
  {
    faq_id: 'FAQ-0020', category: 'EVENTS', access_tier: 'ALL',
    question: 'How do I register for a RIFAH event or webinar?',
    answer: 'From the main menu, select option 4 (Learn & Grow), then choose option 3 (Events). Browse upcoming events, select one for details, then type REGISTER. For paid events, you\'ll receive a payment link. FREE events are confirmed immediately.',
    keywords: 'event registration, webinar, workshop, how to join',
  },
  {
    faq_id: 'FAQ-0021', category: 'EVENTS', access_tier: 'ALL',
    question: 'Can I cancel my event registration?',
    answer: 'Free event registrations can be cancelled anytime. For paid events, cancellations are accepted up to 48 hours before the event for a full refund, and up to 24 hours for a 50% refund. No refunds for cancellations within 24 hours of the event.',
    keywords: 'cancel event, event refund, unregister event',
  },
  {
    faq_id: 'FAQ-0022', category: 'EVENTS', access_tier: 'ALL',
    question: 'Will I receive a certificate for attending events?',
    answer: 'Participation certificates are issued for workshops, training programs, and webinars marked as "certificate events". Certificates are sent digitally to your WhatsApp within 3 business days after attending. PREMIUM members receive certificates for all events.',
    keywords: 'certificate, attendance certificate, training certificate',
  },
  {
    faq_id: 'FAQ-0023', category: 'EVENTS', access_tier: 'PREMIUM',
    question: 'Are there exclusive events for Premium members?',
    answer: 'Yes! Premium members get access to exclusive networking events, advanced training programs, and closed-door business roundtables. These events are marked PREMIUM in the event listing and are not visible to FREE members. Premium-only events typically have limited seating.',
    keywords: 'premium events, exclusive events, networking',
  },

  // TECHNICAL (4)
  {
    faq_id: 'FAQ-0024', category: 'TECHNICAL', access_tier: 'ALL',
    question: 'The RIFAH bot is not responding to my messages. What should I do?',
    answer: 'If the bot is not responding: 1) Wait 5 minutes and try again. 2) Send "Hi" to restart your session. 3) Check if the WhatsApp number is saved correctly in your contacts. 4) If the issue persists for more than 30 minutes, contact support at the office number. Our servers are monitored 24/7.',
    keywords: 'bot not responding, no reply, technical issue, down',
  },
  {
    faq_id: 'FAQ-0025', category: 'TECHNICAL', access_tier: 'ALL',
    question: 'I\'m getting an error when trying to complete registration. What should I do?',
    answer: 'Common registration errors: 1) "Number already registered" — you already have an account. Send "Hi" to access it. 2) "Invalid phone format" — ensure your number is in international format (91XXXXXXXXXX). 3) Stuck in middle of form — send "MENU" to restart. If none work, create a support ticket.',
    keywords: 'registration error, error message, cannot register, stuck',
  },
  {
    faq_id: 'FAQ-0026', category: 'TECHNICAL', access_tier: 'ALL',
    question: 'How do I reset or restart my WhatsApp bot session?',
    answer: 'To restart your session at any time, simply send the word "MENU" or "Hi". This will reset your conversation and take you back to the main menu. Your profile and data are safe — only the current conversation flow is reset.',
    keywords: 'reset, restart, session, stuck, MENU, go back',
  },
  {
    faq_id: 'FAQ-0027', category: 'TECHNICAL', access_tier: 'ALL',
    question: 'Why am I not receiving notifications for my leads?',
    answer: 'Ensure you have not blocked the RIFAH WhatsApp number. Check your WhatsApp notification settings — notifications may be muted. Make sure your WhatsApp is updated to the latest version. If still not receiving, check if your session is active by sending "Hi". For persistent issues, create a support ticket.',
    keywords: 'notifications, no notification, lead notification, alert',
  },

  // GENERAL (4)
  {
    faq_id: 'FAQ-0028', category: 'GENERAL', access_tier: 'ALL',
    question: 'What is RIFAH Connect and who can join?',
    answer: 'RIFAH Connect is a WhatsApp-based business networking platform for the RIFAH Chamber of Commerce. It connects 1 lakh+ SMEs across India for B2B lead sharing, networking, and business growth. Any registered business owner in India can join — manufacturers, traders, service providers, wholesalers, and retailers.',
    keywords: 'what is RIFAH, about, who can join, SME, chamber',
  },
  {
    faq_id: 'FAQ-0029', category: 'GENERAL', access_tier: 'ALL',
    question: 'How do I contact the RIFAH support team?',
    answer: 'You can reach us through: 1) This WhatsApp bot — select option 5 to create a support ticket. 2) Email: support@rifah.org (24-48 hour response). 3) Phone: 1800-XXX-XXXX (Mon-Sat, 9 AM - 6 PM). PREMIUM members can reach dedicated support at premium@rifah.org with 4-8 hour response.',
    keywords: 'contact, support, phone, email, help',
  },
  {
    faq_id: 'FAQ-0030', category: 'GENERAL', access_tier: 'ALL',
    question: 'Is my business data safe on RIFAH Connect?',
    answer: 'Your data is stored securely on encrypted servers in India, compliant with Indian data protection laws. We never sell your data to third parties. Lead information is only shared with relevant WhatsApp business groups within the RIFAH network. You can request data deletion by creating a support ticket.',
    keywords: 'data safety, privacy, secure, data protection',
  },
  {
    faq_id: 'FAQ-0031', category: 'GENERAL', access_tier: 'ALL',
    question: 'Does RIFAH Connect have a referral program?',
    answer: 'Yes! Refer a business to RIFAH Connect and earn referral credits. When your referred business registers and activates PREMIUM membership, you receive a 1-month FREE premium extension. Share your referral code (your RIFAH ID) with businesses. Track referrals in your dashboard (PREMIUM) or via support.',
    keywords: 'referral, refer a friend, referral code, earn rewards',
  },
];

// ── Support Agents ────────────────────────────────────────────────────────────

const AGENTS = [
  {
    agent_id: 'AGENT-001',
    agent_name: 'Rahul Kumar',
    agent_phone: '919111000001',
    agent_email: 'rahul@rifah.org',
    department: 'TECHNICAL',
    is_active: 1,
    max_concurrent_tickets: 5,
    current_ticket_count: 0,
    availability_status: 'AVAILABLE',
    languages: 'English, Hindi',
    rating: 4.8,
    total_tickets_resolved: 0,
  },
  {
    agent_id: 'AGENT-002',
    agent_name: 'Priya Sharma',
    agent_phone: '919111000002',
    agent_email: 'priya@rifah.org',
    department: 'BILLING',
    is_active: 1,
    max_concurrent_tickets: 5,
    current_ticket_count: 0,
    availability_status: 'AVAILABLE',
    languages: 'English, Hindi, Marathi',
    rating: 4.9,
    total_tickets_resolved: 0,
  },
  {
    agent_id: 'AGENT-003',
    agent_name: 'Ankit Patel',
    agent_phone: '919111000003',
    agent_email: 'ankit@rifah.org',
    department: 'MEMBERSHIP',
    is_active: 1,
    max_concurrent_tickets: 3,
    current_ticket_count: 0,
    availability_status: 'AVAILABLE',
    languages: 'English, Hindi, Gujarati',
    rating: 4.7,
    total_tickets_resolved: 0,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsert(doctype, idField, data) {
  const id = data[idField];
  const check = await erp.request(`${BASE}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(id)}`, 'GET');
  if (check.status === 200 && check.body?.data) {
    const r = await erp.request(`${BASE}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(id)}`, 'PUT', data);
    return r.status === 200;
  }
  const r = await erp.request(`${BASE}/api/resource/${encodeURIComponent(doctype)}`, 'POST', { doctype, ...data });
  return r.status === 200 || r.status === 201;
}

async function cleanDoctype(doctype, idField, ids) {
  for (const id of ids) {
    const r = await erp.request(`${BASE}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(id)}`, 'DELETE');
    if (r.status === 202) console.log(c.grey(`    Deleted ${doctype}: ${id}`));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const clean = process.argv.includes('--clean');

  console.log(c.bold('\n══════════════════════════════════════════'));
  console.log(c.bold('  RIFAH Connect — Flow 5 Seed Data'));
  console.log(c.bold('══════════════════════════════════════════\n'));

  if (clean) {
    console.log(c.blue('  Cleaning existing seed data...\n'));
    await cleanDoctype('RIFAH FAQ', 'faq_id', FAQS.map(f => f.faq_id));
    await cleanDoctype('RIFAH Support Agent', 'agent_id', AGENTS.map(a => a.agent_id));
    console.log(c.green('  ✓ Cleaned\n'));
  }

  // Seed FAQs
  console.log(c.bold('  Seeding FAQs...\n'));
  let faqOk = 0;
  for (const faq of FAQS) {
    const ok = await upsert('RIFAH FAQ', 'faq_id', faq);
    if (ok) { faqOk++; process.stdout.write(c.green('.')); }
    else     { process.stdout.write(c.red('✗')); }
  }
  console.log(`\n  ${faqOk}/${FAQS.length} FAQs ready\n`);

  // Seed Agents
  console.log(c.bold('  Seeding Support Agents...\n'));
  let agentOk = 0;
  for (const agent of AGENTS) {
    const ok = await upsert('RIFAH Support Agent', 'agent_id', agent);
    if (ok) { agentOk++; console.log(c.green(`  ✓  ${agent.agent_id}: ${agent.agent_name} (${agent.department})`)); }
    else    { console.log(c.red(`  ✗  ${agent.agent_id}: failed`)); }
  }
  console.log(`\n  ${agentOk}/${AGENTS.length} agents ready\n`);

  // Summary
  const byCategory = {};
  FAQS.forEach(f => { byCategory[f.category] = (byCategory[f.category] || 0) + 1; });
  console.log(c.bold('  FAQ breakdown by category:'));
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(c.grey(`    ${cat.padEnd(15)} ${count} FAQs`));
  });

  console.log(c.bold('\n══════════════════════════════════════════\n'));
})();
