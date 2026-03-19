# RIFAH Connect — Master Prompt: Flow 4 Learn & Grow

## CONTEXT FOR CLAUDE CODE

You are building Flow 4 (Learn & Grow) for RIFAH Connect — a WhatsApp Business automation platform 
for a chamber of commerce connecting 1 lakh+ businesses in India.

**Purpose:** Provide members access to educational resources, training programs, webinars, events, 
and business growth tools curated by the chamber of commerce.

**Prerequisites:**
- Flow 1 (Registration/Update) in production
- User must be registered member (FREE or PREMIUM)
- Content management system for resources (ERPNext or external CMS)

Read these files before starting:
- `docker-compose.yml` — understand all running services
- `.env` — all credentials and configuration
- `documents/` — setup guides and architecture notes

---

## TECH STACK

| Component | Technology | Access |
|-----------|------------|--------|
| WhatsApp | Meta Cloud API (direct, free) | Via HTTP to graph.facebook.com |
| Automation | n8n (self-hosted) | http://localhost:5678 |
| Database | ERPNext v15 | http://localhost:8080 |
| Content Storage | ERPNext + File attachments | rifah_uploads volume |
| Tunnel | ngrok static domain | URL in .env as NGROK_URL |
| OS | Intel Mac (Docker Desktop) | - |

**No AI required for this flow** — all content is pre-curated and static

---

## MEMBERSHIP TIER ACCESS

| Feature | FREE | PREMIUM |
|---------|------|---------|
| Business Tips | ✅ Basic (10 articles) | ✅ Full Library (100+ articles) |
| Video Tutorials | ✅ 5 basic videos | ✅ 50+ videos |
| Webinars | ❌ No access | ✅ Live + recordings |
| Training Programs | ❌ No access | ✅ Paid programs (discounted) |
| Certifications | ❌ No access | ✅ Chamber certificates |
| Events | ✅ Public events only | ✅ Exclusive member events |
| Mentorship | ❌ No access | ✅ 1-on-1 mentorship matching |

---

## ERPNEXT CUSTOM DOCTYPES REQUIRED

### 1. RIFAH Resource

**Fields:**
```
resource_id (Data, Unique, Read Only) — RSRC-YYYY-####
title (Data, 150 chars) — Resource title
resource_type (Select) — ARTICLE, VIDEO, PDF, WEBINAR, EVENT, TRAINING, TOOL
category (Select) — Marketing, Finance, Operations, HR, Legal, Technology, Sales, General
description (Text) — Brief description (500 chars)
content_url (Data) — URL or file path
thumbnail_url (Data) — Image URL for preview
access_tier (Select) — FREE, PREMIUM, ALL
language (Select) — English, Hindi, Marathi, Tamil, Telugu, Gujarati, etc.
duration_minutes (Int) — For videos/webinars (optional)
published_date (Date)
is_active (Check) — Show/hide resource
view_count (Int, Default 0) — Track popularity
rating (Float, Default 0) — User ratings (0-5)
created_by (Data) — Admin who added
tags (Small Text) — Comma-separated keywords
```

**Naming:** `RSRC-2024-0001`, `RSRC-2024-0002`, etc.

### 2. RIFAH Event

**Fields:**
```
event_id (Data, Unique, Read Only) — EVENT-YYYY-####
event_name (Data, 150 chars)
event_type (Select) — WEBINAR, WORKSHOP, CONFERENCE, NETWORKING, SEMINAR
description (Text)
event_date (Datetime)
event_duration_hours (Float) — Duration in hours
location (Data) — Venue or "Online"
registration_link (Data) — URL for registration
registration_deadline (Date)
max_participants (Int)
current_registrations (Int, Default 0)
access_tier (Select) — FREE, PREMIUM, ALL
organizer (Data) — Speaker/organizer name
cost (Currency) — ₹0 for free events
status (Select) — UPCOMING, ONGOING, COMPLETED, CANCELLED
thumbnail_url (Data)
is_active (Check)
created_at (Datetime)
```

**Naming:** `EVENT-2024-0001`, `EVENT-2024-0002`, etc.

### 3. RIFAH Event Registration

**Fields:**
```
registration_id (Data, Unique, Read Only) — REG-EVENT-YYYY-#####
event_id (Link: RIFAH Event)
member_id (Link: RIFAH Member)
member_name (Data, from member)
member_phone (Data, from member)
member_email (Data, from member)
registration_date (Datetime, Default Now)
attendance_status (Select) — REGISTERED, ATTENDED, NO_SHOW, CANCELLED
payment_status (Select) — NA, PENDING, PAID, REFUNDED
payment_amount (Currency)
certificate_issued (Check, Default 0)
feedback_rating (Int) — 1-5 stars (optional)
feedback_comments (Text)
created_at (Datetime)
```

**Naming:** Auto-increment `REG-EVENT-2024-00001`

### 4. RIFAH Resource View

**Purpose:** Track which members viewed which resources

**Fields:**
```
view_id (Data, Unique, Read Only) — VIEW-YYYY-######
resource_id (Link: RIFAH Resource)
member_id (Link: RIFAH Member)
viewed_at (Datetime, Default Now)
view_duration_seconds (Int) — If trackable
completed (Check) — For videos/courses
rating (Int) — 1-5 stars (optional)
```

**Naming:** Auto-increment `VIEW-2024-000001`

---

## COMPLETE CONVERSATION FLOW

### Entry Point

User sends "Hi" → Bot shows main menu → User selects "4️⃣ Learn & Grow"

**Bot Message:**
```
📚 *LEARN & GROW*

Access business resources, training, and events:

1️⃣ Business Tips & Articles
2️⃣ Video Tutorials
3️⃣ Upcoming Events
4️⃣ Training Programs
5️⃣ Tools & Templates
0️⃣ Back to Main Menu

_Reply with a number (1-5)_
```

Session step: `LEARN_CATEGORY`

---

### OPTION 1: BUSINESS TIPS & ARTICLES

**User Input:** `1`

**Check Tier & Show Categories:**
```javascript
const member = await getMember(userPhone);

// Get categories with count
const categories = await erpnext.query("RIFAH Resource", {
  resource_type: "ARTICLE",
  is_active: 1,
  access_tier: ["in", member.membership_tier === "PREMIUM" ? 
    ["FREE", "PREMIUM", "ALL"] : 
    ["FREE", "ALL"]
  ]
});

// Group by category
const categoryCounts = {};
categories.forEach(r => {
  categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
});
```

**Bot Message:**
```
📖 *BUSINESS ARTICLES*

Browse by category:

1️⃣ Marketing (12 articles)
2️⃣ Finance (8 articles)
3️⃣ Operations (10 articles)
4️⃣ HR & People (6 articles)
5️⃣ Legal & Compliance (5 articles)
6️⃣ Technology (9 articles)
7️⃣ Sales (11 articles)
8️⃣ View All (61 articles)
0️⃣ Back

_Reply with a number_
```

Session step: `ARTICLE_CATEGORY`

**User selects category (e.g., 1 for Marketing):**

```javascript
const articles = await erpnext.query("RIFAH Resource", {
  resource_type: "ARTICLE",
  category: "Marketing",
  is_active: 1,
  access_tier: ["in", accessTiers]
}, {
  order_by: "view_count DESC",
  limit: 10
});
```

**Bot Message:**
```
📖 *MARKETING ARTICLES* (Top 10)

1. Digital Marketing Basics for SMEs
   👁️ 245 views | ⭐ 4.5/5
   
2. Social Media Strategy Guide
   👁️ 198 views | ⭐ 4.7/5
   
3. SEO for Small Businesses
   👁️ 167 views | ⭐ 4.3/5
   
4. Email Marketing That Works
   👁️ 142 views | ⭐ 4.6/5
   
[... up to 10 articles]

_Reply with article number to read_
Or *MORE* for next 10
Or *0* to go back
```

Session step: `ARTICLE_SELECT`

**User selects article (e.g., 2):**

```javascript
const article = articles[1]; // Index 1 for option 2

// Track view
await erpnext.create("RIFAH Resource View", {
  resource_id: article.resource_id,
  member_id: member.rifah_id,
  viewed_at: new Date().toISOString()
});

// Increment view count
await erpnext.setValue("RIFAH Resource", article.resource_id, 
  "view_count", article.view_count + 1);

// Send content
if (article.content_url.startsWith("http")) {
  // External URL
  await whatsapp.send(userPhone, `
📖 *${article.title}*

${article.description}

🔗 Read full article:
${article.content_url}

⭐ Rate this article (1-5) or reply BACK
  `);
} else {
  // File attachment stored in ERPNext
  const fileUrl = `${ERPNEXT_URL}${article.content_url}`;
  
  await whatsapp.sendDocument(userPhone, fileUrl, {
    caption: `📖 *${article.title}*\n\n${article.description}\n\n⭐ Rate this article (1-5) or reply BACK`
  });
}
```

Session step: `ARTICLE_RATE`

**User rates or goes back:**
```
Input: 5
Expected: "✅ Thank you for rating! (5/5)"
Then show more articles or category menu
```

---

### OPTION 2: VIDEO TUTORIALS

**User Input:** `2`

**Check Tier & Show Categories:**
```
📹 *VIDEO TUTORIALS*

{member.tier === "FREE" ? "🔓 5 basic videos available" : "⭐ 50+ videos available"}

Browse by topic:

1️⃣ Getting Started (5 videos)
2️⃣ Marketing (8 videos) {PREMIUM badge if needed}
3️⃣ Finance Management (6 videos) {PREMIUM badge}
4️⃣ Operations (7 videos) {PREMIUM badge}
5️⃣ Technology (9 videos) {PREMIUM badge}
6️⃣ View All
0️⃣ Back

_Reply with a number_
```

**User selects category:**

```javascript
const videos = await erpnext.query("RIFAH Resource", {
  resource_type: "VIDEO",
  category: selectedCategory,
  is_active: 1,
  access_tier: ["in", accessTiers]
}, {
  order_by: "view_count DESC",
  limit: 10
});
```

**Bot Message:**
```
📹 *GETTING STARTED VIDEOS*

1. Introduction to RIFAH Connect (5 min)
   👁️ 1,245 views | ⭐ 4.8/5
   
2. How to Post Your First Lead (3 min)
   👁️ 987 views | ⭐ 4.6/5
   
3. Finding the Right Vendors (8 min)
   👁️ 756 views | ⭐ 4.5/5
   
[... up to 10 videos]

_Reply with video number to watch_
```

**User selects video:**

```javascript
// Track view
await erpnext.create("RIFAH Resource View", {
  resource_id: video.resource_id,
  member_id: member.rifah_id,
  viewed_at: new Date().toISOString()
});

// Send video link (YouTube, Vimeo, or hosted)
await whatsapp.send(userPhone, `
📹 *${video.title}*
⏱️ Duration: ${video.duration_minutes} minutes

${video.description}

🎬 Watch now:
${video.content_url}

⭐ Rate this video (1-5) or reply BACK
`);
```

---

### OPTION 3: UPCOMING EVENTS

**User Input:** `3`

**Query Events:**
```javascript
const upcomingEvents = await erpnext.query("RIFAH Event", {
  status: "UPCOMING",
  event_date: [">=", new Date().toISOString()],
  is_active: 1,
  access_tier: ["in", accessTiers]
}, {
  order_by: "event_date ASC",
  limit: 10
});
```

**Bot Message:**
```
📅 *UPCOMING EVENTS*

{events.length === 0 ? "No upcoming events at the moment." : ""}

1. Digital Marketing Workshop
   📅 March 25, 2024 | 10:00 AM - 1:00 PM
   📍 Online (Zoom)
   💰 ₹500 (₹0 for Premium)
   👥 15/50 seats available
   
2. Finance Management Webinar
   📅 March 28, 2024 | 3:00 PM - 5:00 PM
   📍 Online
   💰 FREE
   👥 120/200 seats available
   
3. Networking Mixer - Pune
   📅 April 2, 2024 | 6:00 PM - 9:00 PM
   📍 Hotel ABC, Pune
   💰 ₹1,000 (₹500 for Premium)
   👥 45/100 seats available
   
[... up to 10 events]

_Reply with event number for details_
Or *PAST* to see past events
Or *0* to go back
```

Session step: `EVENT_SELECT`

**User selects event:**

```javascript
const event = upcomingEvents[selectedIndex];

// Check if already registered
const existingReg = await erpnext.query("RIFAH Event Registration", {
  event_id: event.event_id,
  member_id: member.rifah_id
});

const isRegistered = existingReg.length > 0;
const isFull = event.current_registrations >= event.max_participants;
const cost = member.membership_tier === "PREMIUM" && event.cost > 0 ? 
  event.cost * 0.5 : event.cost; // 50% discount for premium
```

**Bot Message:**
```
📅 *${event.event_name}*

📝 Description:
${event.description}

📅 Date & Time:
${formatDateTime(event.event_date)}

⏱️ Duration: ${event.event_duration_hours} hours

📍 Location: ${event.location}

👤 Organizer: ${event.organizer}

💰 Fee: ₹${cost} ${cost === 0 ? '(FREE)' : ''}
{member.tier === "PREMIUM" && event.cost > 0 ? '(50% premium discount applied)' : ''}

👥 Seats: ${event.max_participants - event.current_registrations} available

━━━━━━━━━━━━━━━━━━━━━━

{isRegistered ? 
  "✅ You are already registered!\n\nReply CANCEL to cancel registration" :
  isFull ?
  "⚠️ This event is fully booked.\n\nReply WAITLIST to join waiting list" :
  "Reply *REGISTER* to confirm registration\nOr *0* to go back"
}
```

Session step: `EVENT_ACTION`

**User registers:**

```javascript
if (userInput === "REGISTER") {
  // Create registration
  const regId = await erpnext.create("RIFAH Event Registration", {
    event_id: event.event_id,
    member_id: member.rifah_id,
    member_name: member.business_name,
    member_phone: member.whatsapp_number,
    member_email: member.email,
    registration_date: new Date().toISOString(),
    attendance_status: "REGISTERED",
    payment_status: cost === 0 ? "NA" : "PENDING",
    payment_amount: cost
  });
  
  // Increment count
  await erpnext.setValue("RIFAH Event", event.event_id,
    "current_registrations", event.current_registrations + 1);
  
  // Send confirmation
  await whatsapp.send(userPhone, `
✅ *Registration Confirmed!*

📋 Registration ID: ${regId}
📅 Event: ${event.event_name}
📅 Date: ${formatDateTime(event.event_date)}
📍 Location: ${event.location}

{cost > 0 ? `
💰 Payment Required: ₹${cost}

Payment details:
Account: RIFAH Chamber
IFSC: XXXX0001234
UPI: rifah@upi

Please send payment screenshot to confirm.
` : ''}

You'll receive event link 24 hours before the event.

📧 Confirmation sent to: ${member.email}

Thank you! 🙏
  `);
  
  // Send to admin for tracking
  await whatsapp.send(ADMIN_WHATSAPP, `
📅 New Event Registration

Event: ${event.event_name}
Member: ${member.business_name} (${member.rifah_id})
Tier: ${member.membership_tier}
Fee: ₹${cost}
Payment: ${cost === 0 ? 'NA' : 'PENDING'}
  `);
}
```

---

### OPTION 4: TRAINING PROGRAMS

**User Input:** `4`

**Check Access:**
```javascript
if (member.membership_tier !== "PREMIUM") {
  await whatsapp.send(userPhone, `
🎓 *TRAINING PROGRAMS*

Access to structured training programs and certifications is available for *PREMIUM members only*.

*Available Programs:*
• Business Management Certification
• Digital Marketing Mastery
• Financial Planning for SMEs
• Export-Import Fundamentals
• Leadership Development

💡 *Upgrade to Premium* to access:
✓ 10+ certification programs
✓ Live training sessions
✓ 1-on-1 mentorship
✓ Chamber-recognized certificates

Upgrade: Reply *UPGRADE* or call 1800-XXX-XXXX
  `);
  
  return;
}
```

**For Premium Members:**
```
🎓 *TRAINING PROGRAMS*

{member.tier === "PREMIUM" ? "⭐ Premium Access Activated" : ""}

Available programs:

1️⃣ Business Management Certification
   📚 8 weeks | 💰 ₹5,000 (₹3,500 for members)
   📅 Next batch: April 15, 2024
   
2️⃣ Digital Marketing Mastery
   📚 6 weeks | 💰 ₹4,000 (₹2,800 for members)
   📅 Next batch: April 22, 2024
   
3️⃣ Financial Planning for SMEs
   📚 4 weeks | 💰 ₹3,000 (₹2,100 for members)
   📅 Next batch: May 1, 2024
   
4️⃣ Export-Import Fundamentals
   📚 6 weeks | 💰 ₹6,000 (₹4,200 for members)
   📅 Next batch: May 8, 2024
   
0️⃣ Back

_Reply with program number for details_
```

**User selects program:**
```
📚 *DIGITAL MARKETING MASTERY*

🎯 Program Overview:
Comprehensive 6-week program covering SEO, social media marketing, 
Google Ads, content marketing, and analytics.

📅 Duration: 6 weeks (12 sessions)
📅 Next Batch: April 22, 2024
⏰ Schedule: Tue & Thu, 7:00 PM - 9:00 PM

💰 Fee: ₹4,000 (₹2,800 for members - 30% off)

📚 Curriculum:
• Week 1-2: SEO & Content Marketing
• Week 3-4: Social Media Marketing
• Week 5: Google Ads & PPC
• Week 6: Analytics & Reporting

🎓 Includes:
✓ Live online sessions
✓ Recorded lectures
✓ Assignments & projects
✓ Certificate of completion
✓ 3-month mentorship

👥 Seats: 18/30 available

━━━━━━━━━━━━━━━━━━━━━━

Reply *ENROLL* to register
Or *0* to go back
```

**Enrollment handled same as event registration**

---

### OPTION 5: TOOLS & TEMPLATES

**User Input:** `5`

```
🛠️ *BUSINESS TOOLS & TEMPLATES*

Download ready-to-use templates:

1️⃣ Quotation Templates (5 formats)
2️⃣ Invoice Templates (8 formats)
3️⃣ Business Plan Template
4️⃣ Financial Projections Calculator
5️⃣ HR Policy Templates {PREMIUM only}
6️⃣ Contract Templates {PREMIUM only}
7️⃣ Marketing Plan Template
8️⃣ Pitch Deck Template {PREMIUM only}
0️⃣ Back

_Reply with a number_
```

**User selects template:**

```javascript
const template = await erpnext.getDoc("RIFAH Resource", {
  resource_id: selectedTemplateId
});

// Check access
if (template.access_tier === "PREMIUM" && member.membership_tier !== "PREMIUM") {
  await whatsapp.send(userPhone, `
⭐ *PREMIUM TEMPLATE*

This template is available for Premium members only.

Upgrade to access:
✓ 50+ professional templates
✓ Customizable formats
✓ Legal-vetted contracts
✓ Financial calculators

Reply *UPGRADE* for details
  `);
  return;
}

// Track download
await erpnext.create("RIFAH Resource View", {
  resource_id: template.resource_id,
  member_id: member.rifah_id,
  viewed_at: new Date().toISOString()
});

// Send file
const fileUrl = `${ERPNEXT_URL}${template.content_url}`;

await whatsapp.sendDocument(userPhone, fileUrl, {
  caption: `
📄 *${template.title}*

${template.description}

✅ Download complete!

💡 Need help using this template?
Reply HELP for support
  `,
  filename: `${template.title}.${template.content_url.split('.').pop()}`
});
```

---

## SESSION STATE REFERENCE

| current_step | Bot is waiting for |
|---|---|
| LEARN_CATEGORY | Main category (1-5) |
| ARTICLE_CATEGORY | Article category selection |
| ARTICLE_SELECT | Article number to read |
| ARTICLE_RATE | Rating (1-5) or BACK |
| VIDEO_CATEGORY | Video category selection |
| VIDEO_SELECT | Video number to watch |
| VIDEO_RATE | Rating (1-5) or BACK |
| EVENT_SELECT | Event number for details |
| EVENT_ACTION | REGISTER/CANCEL/WAITLIST/BACK |
| TRAINING_SELECT | Training program number |
| TRAINING_ACTION | ENROLL/BACK |
| TEMPLATE_SELECT | Template number |
| COMPLETED | Flow finished |

---

## N8N WORKFLOW ARCHITECTURE

### Main Learn & Grow Path
- `IF Learn Selected` — Menu option 4
- `Show Learn Categories` — 5 main options
- `Route by Category` — Switch to article/video/event/training/template

### Articles Path
- `Show Article Categories` — Query categories with counts
- `Get Articles by Category` — Filter and sort
- `Format Article List` — Numbered list with views/ratings
- `Send Article Content` — URL or file
- `Track Article View` — Create view record
- `Collect Article Rating` — Store in Resource View

### Videos Path
- `Show Video Categories` — Query categories
- `Get Videos by Category` — Filter by tier
- `Send Video Link` — YouTube/Vimeo/hosted
- `Track Video View` — Create view record

### Events Path
- `Get Upcoming Events` — Query by date and tier
- `Format Event List` — With date, location, cost, seats
- `Show Event Details` — Full information
- `IF User Registers` — Create registration
- `Send Confirmation` — WhatsApp + Email
- `Update Event Count` — Increment registrations
- `Notify Admin` — New registration alert

### Training Programs Path
- `Check Premium Access` — Premium only
- `Show Training List` — Available programs
- `Show Program Details` — Curriculum, schedule, pricing
- `IF User Enrolls` — Create registration (same as event)

### Templates Path
- `Show Template Categories` — With tier markers
- `Check Access Rights` — Verify tier for premium templates
- `Send Template File` — Document attachment
- `Track Template Download` — Create view record

---

## CRITICAL FIXES

### Fix 1: Handle Empty Results
```javascript
// No articles in category
if (articles.length === 0) {
  await whatsapp.send(userPhone, `
📖 No articles found in this category yet.

More content coming soon!

Reply *BACK* to select another category
  `);
  return;
}

// No upcoming events
if (events.length === 0) {
  await whatsapp.send(userPhone, `
📅 No upcoming events scheduled at the moment.

We'll notify you when new events are announced!

Reply *PAST* to see past events
Or *0* to go back
  `);
}
```

### Fix 2: File Size Validation
```javascript
// WhatsApp limit: 100MB for documents

const fileSize = await getFileSize(fileUrl);

if (fileSize > 100 * 1024 * 1024) {
  // Send link instead of file
  await whatsapp.send(userPhone, `
📄 *${template.title}*

This file is large (${formatFileSize(fileSize)}).

Download here: ${fileUrl}

Or access via web: ${WEBSITE_URL}/resources/${template.resource_id}
  `);
} else {
  await whatsapp.sendDocument(userPhone, fileUrl);
}
```

### Fix 3: Event Registration Deadline
```javascript
// Check registration deadline
const deadlineDate = new Date(event.registration_deadline);
const now = new Date();

if (now > deadlineDate) {
  await whatsapp.send(userPhone, `
⚠️ Registration deadline has passed.

Registration closed on: ${formatDate(deadlineDate)}

For late registration, contact:
📞 ${ADMIN_PHONE}
  `);
  return;
}
```

### Fix 4: Concurrent Registration Handling
```javascript
// Race condition: Multiple users registering simultaneously

// Use ERPNext transactions or locks
const currentCount = await erpnext.getValue("RIFAH Event", 
  event.event_id, "current_registrations");

if (currentCount >= event.max_participants) {
  await whatsapp.send(userPhone, `
⚠️ Sorry! Event just got fully booked.

Reply *WAITLIST* to join waiting list
  `);
  return;
}

// Atomic increment
await erpnext.db.sql(`
  UPDATE \`tabRIFAH Event\` 
  SET current_registrations = current_registrations + 1 
  WHERE event_id = '${event.event_id}' 
  AND current_registrations < max_participants
`);
```

---

## ENVIRONMENT VARIABLES

**No new variables needed for Flow 4**

Uses existing:
- `ERPNEXT_URL`
- `ADMIN_WHATSAPP`
- `BOT_WHATSAPP_NUMBER`

Optional:
```bash
# Website for web access to resources
WEBSITE_URL=https://rifah.org

# Email for event confirmations
SMTP_HOST=smtp.gmail.com
SMTP_USER=events@rifah.org
SMTP_PASS=xxxxx
```

---

## TEST SCENARIOS

### Test Suite Overview

**Total Test Cases:** 12  
**Coverage:** All resource types, tier access, event registration, file handling  
**Execution Time:** ~25 minutes (manual) or ~4 minutes (automated)

---

### TEST 1: Browse Articles (Free User)

**Objective:** Verify free user can access free articles

**Prerequisites:**
- User registered as FREE member
- At least 10 free articles in database across 3+ categories

**Test Steps:**

```
Step 1: Select Learn & Grow
  Input: Hi → 4
  Expected: "📚 LEARN & GROW" with 5 options
  
Step 2: Select Articles
  Input: 1
  Expected: "📖 BUSINESS ARTICLES"
  Expected: Shows categories with article counts
  
Step 3: Select category (Marketing)
  Input: 1
  Expected: List of top 10 marketing articles
  Expected: Shows view count and ratings
  
Step 4: Select article
  Input: 2 (second article)
  Expected: Article content sent (URL or file)
  Expected: "⭐ Rate this article (1-5) or reply BACK"
  
Step 5: Rate article
  Input: 5
  Expected: "✅ Thank you for rating! (5/5)"
  Expected: Returns to article list or category menu
```

**Verify in ERPNext:**
```sql
-- Check view tracked
SELECT * FROM `tabRIFAH Resource View`
WHERE member_id = 'RIF-FREE-2024-0001'
AND resource_id = 'RSRC-2024-0002'
ORDER BY viewed_at DESC LIMIT 1;

Expected: New record with current timestamp

-- Check view count incremented
SELECT view_count FROM `tabRIFAH Resource`
WHERE resource_id = 'RSRC-2024-0002';

Expected: view_count increased by 1

-- Check rating stored
SELECT rating FROM `tabRIFAH Resource View`
WHERE view_id = [last created view_id];

Expected: rating = 5
```

---

### TEST 2: Premium Content Access (Free User)

**Objective:** Verify free users cannot access premium articles

**Test Steps:**

```
Step 1-3: Same as Test 1 (browse to article list)

Step 4: Try to select premium article
  [Setup: Article marked access_tier = "PREMIUM"]
  Input: 3 (premium article in list)
  
  Expected: Article opens normally IF properly filtered
  OR
  Expected: "⭐ PREMIUM CONTENT - Upgrade to access" if accidentally shown
```

**Better Implementation:**
```javascript
// Premium articles should NOT appear in free user's list at all
const articles = await erpnext.query("RIFAH Resource", {
  resource_type: "ARTICLE",
  category: "Marketing",
  access_tier: member.membership_tier === "PREMIUM" ? 
    ["in", ["FREE", "PREMIUM", "ALL"]] : 
    ["in", ["FREE", "ALL"]]  // Only free content for free users
});
```

**Verify:** Premium articles do not appear in list for free users

---

### TEST 3: Watch Video (Premium User)

**Objective:** Verify premium user can access all videos

**Prerequisites:**
- Premium user registered
- At least 5 premium videos in database

**Test Steps:**

```
Step 1: Select Learn → Videos
  Input: Hi → 4 → 2
  Expected: "📹 VIDEO TUTORIALS"
  Expected: "⭐ 50+ videos available" (premium message)
  
Step 2: Select category
  Input: 2 (Marketing category - premium)
  Expected: List of marketing videos
  Expected: Includes premium videos
  
Step 3: Select video
  Input: 1
  Expected: Video link sent (YouTube/Vimeo URL)
  Expected: Shows duration, description
  Expected: "🎬 Watch now: [URL]"
  
Step 4: Rate video
  Input: 4
  Expected: "✅ Thank you for rating! (4/5)"
```

**Verify:**
```sql
-- View tracked
SELECT * FROM `tabRIFAH Resource View`
WHERE member_id = 'RIF-PREM-2024-0001'
AND resource_id LIKE 'RSRC-2024-%'
AND rating = 4;

Expected: New record with rating
```

---

### TEST 4: Event Registration (Paid Event)

**Objective:** Verify complete event registration flow

**Prerequisites:**
- Upcoming event with available seats
- Event cost: ₹1,000 (₹500 for premium)

**Test Steps:**

```
Step 1: Browse events
  Input: Hi → 4 → 3
  Expected: "📅 UPCOMING EVENTS"
  Expected: List of upcoming events with dates, costs, seats
  
Step 2: Select event
  Input: 1 (Digital Marketing Workshop)
  Expected: Full event details
  Expected: "📅 Date & Time: March 25, 2024..."
  Expected: "💰 Fee: ₹500 (50% premium discount applied)" [if premium]
  Expected: "👥 Seats: 15 available"
  Expected: "Reply REGISTER to confirm"
  
Step 3: Register
  Input: REGISTER
  Expected: "✅ Registration Confirmed!"
  Expected: Shows registration ID (REG-EVENT-2024-00001)
  Expected: Shows payment details (account, UPI)
  Expected: "Please send payment screenshot"
  Expected: "📧 Confirmation sent to: user@email.com"
  
Step 4: Admin notification
  Expected: Admin receives:
    - "📅 New Event Registration"
    - Event name, member details, tier, fee, payment status
```

**Verify in ERPNext:**
```sql
-- Registration created
SELECT * FROM `tabRIFAH Event Registration`
WHERE member_id = 'RIF-PREM-2024-0001'
AND event_id = 'EVENT-2024-0001';

Expected:
- registration_id: REG-EVENT-2024-00001
- attendance_status: REGISTERED
- payment_status: PENDING
- payment_amount: 500 (premium discount)

-- Event count incremented
SELECT current_registrations FROM `tabRIFAH Event`
WHERE event_id = 'EVENT-2024-0001';

Expected: Increased by 1
```

---

### TEST 5: Event Registration (Free Event)

**Test Steps:**

```
Step 1-2: Browse to free event (₹0 cost)

Step 3: Register
  Input: REGISTER
  Expected: "✅ Registration Confirmed!"
  Expected: NO payment details shown
  Expected: "You'll receive event link 24 hours before"
```

**Verify:**
```sql
Expected:
- payment_status: NA (not applicable for free events)
- payment_amount: 0
```

---

### TEST 6: Event Already Registered

**Objective:** Prevent duplicate registration

**Test Steps:**

```
Step 1: Register for event (same as Test 4)
Step 2: Try to register again for same event
  Input: Hi → 4 → 3 → 1 (same event)
  
  Expected: "✅ You are already registered!"
  Expected: "Reply CANCEL to cancel registration"
  
Step 3: Cancel registration
  Input: CANCEL
  Expected: "⚠️ Registration cancelled"
  Expected: Event seat count decremented
```

**Verify:**
```sql
-- Registration cancelled
UPDATE `tabRIFAH Event Registration`
SET attendance_status = 'CANCELLED'
WHERE registration_id = 'REG-EVENT-2024-00001';

-- Seat freed
Expected: current_registrations decreased by 1
```

---

### TEST 7: Event Fully Booked

**Test Steps:**

```
Step 1: Browse to event at max capacity
  [Setup: current_registrations = max_participants]
  
Step 2: Try to register
  Input: REGISTER
  Expected: "⚠️ This event is fully booked"
  Expected: "Reply WAITLIST to join waiting list"
  
Step 3: Join waitlist
  Input: WAITLIST
  Expected: "✅ Added to waiting list"
  Expected: "We'll notify you if a seat becomes available"
```

**Implementation:**
```javascript
// Store waitlist separately or use custom status
await erpnext.create("RIFAH Event Registration", {
  event_id: event.event_id,
  member_id: member.rifah_id,
  attendance_status: "WAITLIST",
  payment_status: "NA"
});
```

---

### TEST 8: Download Template (Premium)

**Objective:** Download premium template as premium user

**Test Steps:**

```
Step 1: Browse templates
  Input: Hi → 4 → 5
  Expected: "🛠️ BUSINESS TOOLS & TEMPLATES"
  Expected: List of templates with premium markers
  
Step 2: Select premium template
  Input: 5 (HR Policy Templates - PREMIUM)
  Expected: File sent as document attachment
  Expected: "📄 HR Policy Templates"
  Expected: "✅ Download complete!"
  
Step 3: File received
  Expected: .docx or .pdf file downloaded in WhatsApp
```

**Verify:**
```sql
-- Download tracked
SELECT * FROM `tabRIFAH Resource View`
WHERE member_id = 'RIF-PREM-2024-0001'
AND resource_id = 'RSRC-2024-0025';

Expected: New view record
```

---

### TEST 9: Premium Template Blocked (Free User)

**Test Steps:**

```
Step 1: Free user tries to download premium template
  Input: Hi → 4 → 5 → 5 (HR Policy - PREMIUM)
  
  Expected: "⭐ PREMIUM TEMPLATE"
  Expected: "This template is available for Premium members only"
  Expected: "Upgrade to access..."
  Expected: "Reply UPGRADE for details"
  
Step 2: File NOT sent
```

**Verify:** No download record created for blocked access

---

### TEST 10: Training Program Enrollment (Premium Only)

**Test Steps:**

```
Step 1: Premium user browses training
  Input: Hi → 4 → 4
  Expected: "🎓 TRAINING PROGRAMS"
  Expected: "⭐ Premium Access Activated"
  Expected: List of programs with pricing
  
Step 2: Select program
  Input: 2 (Digital Marketing Mastery)
  Expected: Full program details
  Expected: Curriculum, schedule, fee with discount
  Expected: "Reply ENROLL to register"
  
Step 3: Enroll
  Input: ENROLL
  Expected: Registration confirmation
  Expected: Payment details
  Expected: "We'll send course access link 24 hours before start"
```

**Verify:** Same as event registration (uses same doctype)

---

### TEST 11: Training Access Denied (Free User)

**Test Steps:**

```
Step 1: Free user selects training
  Input: Hi → 4 → 4
  
  Expected: "🎓 TRAINING PROGRAMS"
  Expected: "Access to structured training programs is available for PREMIUM members only"
  Expected: Lists available programs (informational)
  Expected: "💡 Upgrade to Premium to access"
  Expected: No option to enroll
```

---

### TEST 12: Empty Results Handling

**Test Steps:**

```
Test 12a: No articles in category
  Input: Select category with 0 articles
  Expected: "📖 No articles found in this category yet"
  Expected: "Reply BACK to select another category"
  
Test 12b: No upcoming events
  Input: Hi → 4 → 3 (when no events scheduled)
  Expected: "📅 No upcoming events at the moment"
  Expected: "Reply PAST to see past events"
  
Test 12c: Past events view
  Input: PAST
  Expected: Shows completed events (last 10)
  Expected: No registration option (read-only)
```

---

## AUTOMATED TEST SCRIPT

**File:** `test_suite/test_flow4.js`

```javascript
const assert = require('assert');
const { browseResources, registerForEvent, downloadTemplate } = require('./helpers');

describe('Flow 4: Learn & Grow', function() {
  this.timeout(30000);
  
  describe('Articles & Videos', () => {
    it('should show articles for free users', async () => {
      const articles = await browseResources({
        phone: '919876543210',  // FREE user
        type: 'ARTICLE',
        category: 'Marketing'
      });
      
      assert.ok(articles.length > 0);
      assert.ok(articles.every(a => 
        a.access_tier === 'FREE' || a.access_tier === 'ALL'
      ));
    });
    
    it('should track article views', async () => {
      const view = await viewResource({
        memberId: 'RIF-FREE-2024-0001',
        resourceId: 'RSRC-2024-0001'
      });
      
      assert.ok(view.view_id);
      assert.ok(view.viewed_at);
    });
  });
  
  describe('Events', () => {
    it('should register for free event', async () => {
      const reg = await registerForEvent({
        phone: '919876543210',
        eventId: 'EVENT-2024-0001'
      });
      
      assert.strictEqual(reg.payment_status, 'NA');
      assert.strictEqual(reg.payment_amount, 0);
    });
    
    it('should apply premium discount', async () => {
      const event = await getEvent('EVENT-2024-0002');  // Cost: 1000
      const cost = calculateEventCost(event, 'PREMIUM');
      
      assert.strictEqual(cost, 500);  // 50% off
    });
    
    it('should prevent overbooking', async () => {
      // Fill event to capacity
      const event = await getEvent('EVENT-2024-0003');
      for (let i = 0; i < event.max_participants; i++) {
        await registerForEvent({
          phone: `9191111${i}`,
          eventId: event.event_id
        });
      }
      
      // Try to register one more
      try {
        await registerForEvent({
          phone: '919999999999',
          eventId: event.event_id
        });
        assert.fail('Should have thrown error');
      } catch (e) {
        assert.ok(e.message.includes('fully booked'));
      }
    });
  });
  
  describe('Templates & Access Control', () => {
    it('should block premium templates for free users', async () => {
      try {
        await downloadTemplate({
          phone: '919876543210',  // FREE user
          resourceId: 'RSRC-2024-0025'  // PREMIUM template
        });
        assert.fail('Should have thrown access denied');
      } catch (e) {
        assert.ok(e.message.includes('Premium members only'));
      }
    });
    
    it('should allow premium templates for premium users', async () => {
      const download = await downloadTemplate({
        phone: '919111111111',  // PREMIUM user
        resourceId: 'RSRC-2024-0025'
      });
      
      assert.ok(download.file_url);
      assert.ok(download.view_tracked);
    });
  });
});
```

---

## TEST DATA SETUP

**Script:** `scripts/setup_learn_grow_data.js`

```javascript
// Create 50 articles across categories
const articles = [
  {
    title: "Digital Marketing Basics for SMEs",
    resource_type: "ARTICLE",
    category: "Marketing",
    access_tier: "FREE",
    content_url: "https://blog.rifah.org/digital-marketing-basics",
    description: "Learn the fundamentals of digital marketing..."
  },
  // ... 49 more
];

// Create 10 videos
const videos = [
  {
    title: "Introduction to RIFAH Connect",
    resource_type: "VIDEO",
    category: "Getting Started",
    access_tier: "FREE",
    content_url: "https://youtube.com/watch?v=xxxxx",
    duration_minutes: 5
  },
  // ... 9 more
];

// Create 5 upcoming events
const events = [
  {
    event_name: "Digital Marketing Workshop",
    event_type: "WORKSHOP",
    event_date: "2024-03-25T10:00:00",
    location: "Online (Zoom)",
    cost: 500,
    max_participants: 50,
    access_tier: "ALL"
  },
  // ... 4 more
];

// Create 20 templates
const templates = [
  {
    title: "Invoice Template - GST Compliant",
    resource_type: "PDF",
    category: "Finance",
    access_tier: "FREE",
    content_url: "/files/templates/invoice_gst.pdf"
  },
  // ... 19 more
];
```

---

## TESTING CHECKLIST

**Before Testing:**
- [ ] ERPNext running
- [ ] At least 20 resources in each category
- [ ] At least 3 upcoming events
- [ ] File attachments properly stored
- [ ] Free and premium users registered

**Core Functionality:**
- [ ] Test 1: Browse articles (free)
- [ ] Test 3: Watch video (premium)
- [ ] Test 4: Event registration (paid)
- [ ] Test 5: Event registration (free)
- [ ] Test 8: Download template (premium)
- [ ] Test 10: Training enrollment (premium)

**Access Control:**
- [ ] Test 2: Premium content blocked for free users
- [ ] Test 9: Premium template blocked for free users
- [ ] Test 11: Training blocked for free users

**Edge Cases:**
- [ ] Test 6: Duplicate registration prevention
- [ ] Test 7: Fully booked event handling
- [ ] Test 12: Empty results handling

**After Testing:**
- [ ] View counts accurate
- [ ] Ratings stored correctly
- [ ] Event counts updated
- [ ] Files accessible
- [ ] Admin notifications working

---

## DELIVERABLES CHECKLIST

- [ ] `doctypes/rifah_resource.json`
- [ ] `doctypes/rifah_event.json`
- [ ] `doctypes/rifah_event_registration.json`
- [ ] `doctypes/rifah_resource_view.json`
- [ ] `n8n/rifah_flow4_workflow.json`
- [ ] `scripts/populate_sample_resources.js`
- [ ] `test_suite/test_flow4.js`
- [ ] `documents/flow4_setup_guide.md`
- [ ] `documents/content_management_guide.md`

---

END OF FLOW 4 MASTER PROMPT
