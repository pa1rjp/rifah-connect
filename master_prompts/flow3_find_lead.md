# RIFAH Connect — Master Prompt: Flow 3 Find Lead

## CONTEXT FOR CLAUDE CODE

You are building Flow 3 (Find Lead) for RIFAH Connect — a WhatsApp Business automation platform 
for a chamber of commerce connecting 1 lakh+ businesses in India.

**Purpose:** Allow members to proactively search for and respond to existing leads posted by buyers.
This is the "vendor" perspective - finding business opportunities rather than posting requirements.

**Prerequisites:**
- Flow 1 (Registration/Update) in production
- Flow 2A (Share Lead - Free) in production
- Flow 2B (Share Lead - Premium) in production
- RIFAH Lead doctype exists with posted leads
- User must be registered member (FREE or PREMIUM)

Read these files before starting:
- `docker-compose.yml` — understand all running services
- `.env` — all credentials and configuration
- `flow2a_share_lead_free.md` — understand lead structure and vendor qualification
- `flow2b_share_lead_premium.md` — understand premium features

---

## TECH STACK

| Component | Technology | Access |
|-----------|------------|--------|
| WhatsApp | Meta Cloud API (direct, free) | Via HTTP to graph.facebook.com |
| Automation | n8n (self-hosted) | http://localhost:5678 |
| Database | ERPNext v15 | http://localhost:8080 |
| AI | OpenAI GPT-4o-mini | https://api.openai.com/v1/chat/completions |
| Tunnel | ngrok static domain | URL in .env as NGROK_URL |
| OS | Intel Mac (Docker Desktop) | - |

---

## MEMBERSHIP TIER ACCESS

| Feature | FREE | PREMIUM |
|---------|------|---------|
| Lead Search Scope | Industry + City only | **All industries + All locations** |
| Leads Visible | Posted to groups you're in | **All posted leads (direct + groups)** |
| Filter Options | Basic (category, urgency) | **Advanced (budget range, date posted)** |
| Responses per Day | 3 leads max | **Unlimited responses** |
| Lead Details | Basic info only | **Full AI qualification details** |
| Saved Searches | ❌ Not available | ✅ Save search criteria |
| Lead Alerts | ❌ Manual search only | ✅ Daily WhatsApp alerts for new matches |

---

## ERPNEXT DOCTYPE ADDITIONS

**No new doctypes needed.** This flow uses existing:
- **RIFAH Lead** (from Flow 2A/2B) - Query posted leads
- **RIFAH Member** - User profile for filtering
- **RIFAH Session** - Session management

**New field in RIFAH Member:**
```
search_preferences (JSON Text) - Store saved search criteria for premium users
daily_alert_enabled (Check, Default 0) - Premium alert subscription
last_search_date (Date) - Track free tier daily limit
leads_responded_today (Int, Default 0) - Count for free tier (max 3/day)
```

---

## COMPLETE CONVERSATION FLOW

### Entry Point

User sends "Hi" → Bot shows main menu → User selects "3️⃣ Find Lead"

**Bot Message:**
```
🔍 *FIND LEAD*

Search for business opportunities posted by buyers.

*How to search:*
1️⃣ Browse by Category
2️⃣ Search by Location
3️⃣ Browse by Urgency
4️⃣ View All Recent Leads
5️⃣ My Saved Searches {PREMIUM only}
6️⃣ My Responses
0️⃣ Back to Main Menu

{member.tier === "FREE" ? 
  "\n⚠️ *Free Tier:* Search limited to your industry + city\n💡 Upgrade to Premium for full access" : 
  "\n⭐ *Premium Access:* Search all leads across India"
}

_Reply with a number (1-6)_
```

Session step: `SEARCH_METHOD`

---

### OPTION 1: BROWSE BY CATEGORY

**User Input:** `1`

**Show Lead Type Categories:**
```
🔍 *BROWSE LEADS BY CATEGORY*

What type of opportunities are you looking for?

1️⃣ Products to Supply (BUY leads)
   {count_buy} active leads
   
2️⃣ Products to Purchase (SELL leads)
   {count_sell} active leads
   
3️⃣ Services Needed (SERVICE NEED leads)
   {count_service_need} active leads
   
4️⃣ Services Offered (SERVICE OFFER leads)
   {count_service_offer} active leads
   
0️⃣ Back

_Reply with a number_
```

Session step: `CATEGORY_SELECT`

**User selects category (e.g., 1 - BUY leads):**

```javascript
// Apply tier-based filtering
function getLeadSearchCriteria(member, leadType) {
  const baseFilters = {
    lead_type: leadType,
    status: ["in", ["Posted to Groups", "Introductions Sent - Awaiting Vendor Response", "Has Interested Vendors"]],
    is_active: 1
  };
  
  if (member.membership_tier === "FREE") {
    // Free tier: Only leads in user's industry and city
    const userCity = extractCity(member.city_state);
    const userIndustry = member.industry;
    
    return {
      ...baseFilters,
      // Location filter: Leads in same city OR mentioning "All India"
      location: ["like", `%${userCity}%`],
      // Industry filter: Detect from description (we'll do this in JS after query)
      // For now, we'll query all and filter in code
    };
  } else {
    // Premium: All leads
    return baseFilters;
  }
}

const leads = await erpnext.query("RIFAH Lead", getLeadSearchCriteria(member, "BUY"), {
  order_by: "created_at DESC",
  limit: 20
});

// Additional filtering for free users
let filteredLeads = leads;
if (member.membership_tier === "FREE") {
  filteredLeads = leads.filter(lead => {
    const leadIndustry = detectIndustry(lead.description);
    return leadIndustry === member.industry || leadIndustry === "General";
  });
}
```

**Bot Message:**
```
🛒 *BUY LEADS - Products Needed*

{member.tier === "FREE" ? 
  `Showing leads in *${member.industry}* industry near *${member.city_state}*\n(${filteredLeads.length} matches)\n` :
  `Showing all recent leads\n(${filteredLeads.length} leads)\n`
}

━━━━━━━━━━━━━━━━━━━━━━

1. Plastic Bottles - 500ml Food Grade
   📍 Pune, Maharashtra
   💰 Budget: ₹50,000 - ₹1,00,000
   ⏰ Urgency: THIS WEEK
   📅 Posted: 2 hours ago
   {member.tier === "PREMIUM" ? "⭐ PREMIUM Lead" : ""}
   
2. Cotton T-Shirts Bulk Order
   📍 Mumbai, Maharashtra
   💰 Budget: ₹5,00,000
   ⏰ Urgency: THIS MONTH
   📅 Posted: 5 hours ago
   
3. Industrial Packaging Material
   📍 All India
   💰 Budget: Negotiable
   ⏰ Urgency: FLEXIBLE
   📅 Posted: 1 day ago
   
[... up to 20 leads]

━━━━━━━━━━━━━━━━━━━━━━

Reply with lead number for details
Or *MORE* for next 20
Or *FILTER* to refine search
Or *0* to go back

{member.tier === "FREE" ? 
  `\n⚠️ Responses today: ${member.leads_responded_today}/3\n💡 Upgrade to Premium for unlimited responses` :
  ""
}
```

Session step: `LEAD_SELECT`

**User selects lead (e.g., 1):**

```javascript
const lead = filteredLeads[0]; // Index 0 for option 1

// Check if user already responded to this lead
const alreadyResponded = await erpnext.query("RIFAH Lead", {
  lead_id: lead.lead_id,
  interested_vendors: ["like", `%${member.rifah_id}%`]
});

const hasResponded = alreadyResponded.length > 0;

// Check daily limit for free users
if (member.membership_tier === "FREE") {
  const today = new Date().toISOString().split('T')[0];
  
  if (member.last_search_date !== today) {
    // Reset counter for new day
    await erpnext.setValue("RIFAH Member", member.rifah_id, {
      last_search_date: today,
      leads_responded_today: 0
    });
    member.leads_responded_today = 0;
  }
}
```

**Bot Message:**
```
📋 *LEAD DETAILS*

Lead ID: {lead.lead_id}
Type: 🛒 {lead.lead_type}

*Requirement:*
{lead.title}

{lead.description}

*Details:*
📍 Location: {lead.location}
💰 Budget: {lead.budget || 'Negotiable'}
⏰ Urgency: {lead.urgency}
📅 Posted: {formatTimeAgo(lead.created_at)}

{member.tier === "PREMIUM" ? `
*AI Qualification Details:*
${formatAIQualification(lead.ai_qualification)}
` : ""}

*Posted to:* {lead.posted_to_groups.length} WhatsApp groups
*Interested vendors:* {lead.interested_vendors.length} responded

━━━━━━━━━━━━━━━━━━━━━━

{hasResponded ? 
  "✅ You already responded to this lead\n\nStatus: Pending admin review" :
  member.membership_tier === "FREE" && member.leads_responded_today >= 3 ?
  "⚠️ Daily response limit reached (3/3)\n\n💡 Upgrade to Premium for unlimited responses" :
  "Reply *INTERESTED* to respond\nOr *BACK* to continue browsing"
}
```

Session step: `LEAD_ACTION`

**User responds to lead:**
```
Input: INTERESTED
```

**Check eligibility & start qualification:**
```javascript
// Same qualification flow as Flow 2A vendor response
// This is the EXACT SAME process

if (member.membership_tier === "FREE" && member.leads_responded_today >= 3) {
  await whatsapp.send(userPhone, `
⚠️ *Daily Response Limit Reached*

Free members can respond to 3 leads per day.

*Upgrade to Premium for:*
✓ Unlimited lead responses
✓ Search all industries & locations
✓ Full AI qualification details
✓ Daily lead alerts

Reply *UPGRADE* for details
Or come back tomorrow to respond to more leads.
  `);
  return;
}

if (hasResponded) {
  await whatsapp.send(userPhone, `
You've already responded to this lead.

Check status: Reply *RESPONSES*
  `);
  return;
}

// Start vendor qualification (SAME AS FLOW 2A)
await whatsapp.send(userPhone, `
Great! Let's check if you can fulfill this requirement.

I'll ask you 6 quick questions to assess your capability.

*Lead:* ${lead.title}
*Location:* ${lead.location}
*Budget:* ${lead.budget}

Ready? Reply *START*
`);

session_data.active_lead_id = lead.lead_id;
session_data.vendor_qualification_step = 0;

// Generate AI questions (same as Flow 2A)
const vendorQuestions = await generateVendorQuestions(lead);
session_data.vendor_questions = vendorQuestions;
```

**Vendor Qualification Flow:**
```
[IDENTICAL TO FLOW 2A VENDOR QUALIFICATION]

Step 1-6: AI-generated qualification questions
Step 7: Calculate compatibility score (0-100)
Step 8: Show score summary
Step 9: User confirms SUBMIT or CANCEL
Step 10: Store interest in lead record
Step 11: Notify admin for approval
Step 12: Increment free user daily counter (if applicable)
```

**After successful submission:**
```javascript
// Increment daily counter for free users
if (member.membership_tier === "FREE") {
  await erpnext.setValue("RIFAH Member", member.rifah_id,
    "leads_responded_today", member.leads_responded_today + 1);
}

await whatsapp.send(userPhone, `
✅ *Interest submitted successfully!*

📋 Lead: ${lead.lead_id}
📊 Your Compatibility Score: ${compatibilityScore}/100

Our admin will review your response and connect you with the buyer if approved.

Expected timeline: ${lead.tier === "PREMIUM" ? "2-4 hours" : "4-24 hours"}

{member.tier === "FREE" ? 
  `\n*Responses today:* ${member.leads_responded_today + 1}/3` :
  ""
}

Track your responses: Reply *RESPONSES*
Continue searching: Reply *SEARCH*
`);
```

---

### OPTION 2: SEARCH BY LOCATION

**User Input:** `2`

**Bot Message:**
```
📍 *SEARCH BY LOCATION*

{member.tier === "FREE" ?
  `Searching leads in *${member.city_state}*\n(Free tier: Your city only)\n` :
  `Search leads by location:\n`
}

{member.tier === "PREMIUM" ? `
1️⃣ My City (${member.city_state})
2️⃣ My State (${extractState(member.city_state)})
3️⃣ Specific City (type city name)
4️⃣ All India
0️⃣ Back

_Reply with a number or type city name_
` : `
Showing leads in your city...
`}
```

**For Premium users - they select location:**
```
Input: 3 (Specific City)
Bot: Type city name (e.g., Delhi, Bangalore, Mumbai)

Input: Bangalore
```

**Query leads by location:**
```javascript
const locationQuery = member.membership_tier === "PREMIUM" ? 
  userInput : // User's selected location
  extractCity(member.city_state); // Free user's city only

const leads = await erpnext.query("RIFAH Lead", {
  location: ["like", `%${locationQuery}%`],
  status: ["in", ["Posted to Groups", "Introductions Sent - Awaiting Vendor Response"]],
  is_active: 1
}, {
  order_by: "created_at DESC",
  limit: 20
});
```

**Show results (same format as Category browse)**

---

### OPTION 3: BROWSE BY URGENCY

**User Input:** `3`

**Bot Message:**
```
⏰ *SEARCH BY URGENCY*

Find leads by timeline:

1️⃣ URGENT (Need immediately)
   {count_urgent} leads
   
2️⃣ THIS WEEK
   {count_this_week} leads
   
3️⃣ THIS MONTH
   {count_this_month} leads
   
4️⃣ FLEXIBLE
   {count_flexible} leads
   
0️⃣ Back

_Reply with a number_
```

**User selects urgency:**
```javascript
const urgencyMap = {
  1: "URGENT",
  2: "THIS WEEK",
  3: "THIS MONTH",
  4: "FLEXIBLE"
};

const selectedUrgency = urgencyMap[userInput];

const leads = await erpnext.query("RIFAH Lead", {
  urgency: selectedUrgency,
  status: ["in", ["Posted to Groups", "Introductions Sent - Awaiting Vendor Response"]],
  is_active: 1,
  // Apply tier-based location/industry filters
  ...getTierBasedFilters(member)
}, {
  order_by: "created_at DESC",
  limit: 20
});
```

**Show results (same format)**

---

### OPTION 4: VIEW ALL RECENT LEADS

**User Input:** `4`

**Query all recent leads (with tier filters):**
```javascript
const leads = await erpnext.query("RIFAH Lead", {
  status: ["in", ["Posted to Groups", "Introductions Sent - Awaiting Vendor Response", "Has Interested Vendors"]],
  is_active: 1,
  created_at: [">=", getDateDaysAgo(7)], // Last 7 days
  ...getTierBasedFilters(member)
}, {
  order_by: "created_at DESC",
  limit: 50
});
```

**Bot Message:**
```
📋 *ALL RECENT LEADS*

Showing leads from last 7 days
{member.tier === "FREE" ? `(Filtered by your industry + city)` : `(All industries + locations)`}

Found {leads.length} leads

[Shows leads grouped by date:]

━━━━━━━━━━━━━━━━━━━━━━
*TODAY ({todayCount})*

1. Plastic Bottles - 500ml...
2. Cotton T-Shirts Bulk...

━━━━━━━━━━━━━━━━━━━━━━
*YESTERDAY ({yesterdayCount})*

3. Industrial Packaging...
4. Website Development...

━━━━━━━━━━━━━━━━━━━━━━
*THIS WEEK ({weekCount})*

[... more leads]

━━━━━━━━━━━━━━━━━━━━━━

Reply with lead number for details
Or *MORE* for older leads
Or *FILTER* to refine search
```

---

### OPTION 5: MY SAVED SEARCHES (Premium Only)

**User Input:** `5`

**Check Premium Access:**
```javascript
if (member.membership_tier !== "PREMIUM") {
  await whatsapp.send(userPhone, `
⭐ *SAVED SEARCHES*

Save your favorite search criteria and get daily alerts for new matching leads.

*This is a Premium feature.*

Upgrade to access:
✓ Save unlimited search filters
✓ Daily WhatsApp alerts for new leads
✓ Quick access to saved searches

Reply *UPGRADE* for details
  `);
  return;
}
```

**For Premium Users:**
```javascript
const savedSearches = JSON.parse(member.search_preferences || "[]");

if (savedSearches.length === 0) {
  await whatsapp.send(userPhone, `
⭐ *MY SAVED SEARCHES*

You haven't saved any searches yet.

*How to save:*
1. Browse leads by category/location
2. Reply *SAVE SEARCH* when viewing results
3. Name your search for quick access

Saved searches will appear here.
  `);
  return;
}
```

**Show saved searches:**
```
⭐ *MY SAVED SEARCHES*

{daily_alert_enabled ? "🔔 Daily alerts: ON" : "🔕 Daily alerts: OFF"}

1. 📦 Packaging Leads in Pune
   Filters: Category=BUY, Location=Pune, Industry=Packaging
   Last run: 2 hours ago
   New matches: 3 leads
   
2. 🏭 Manufacturing Services - All India
   Filters: Category=SERVICE NEED, Location=All India, Industry=Manufacturing
   Last run: Yesterday
   New matches: 7 leads
   
3. ⚡ Urgent Leads - My Industry
   Filters: Urgency=URGENT, Industry=Packaging
   Last run: 5 hours ago
   New matches: 1 lead

━━━━━━━━━━━━━━━━━━━━━━

Reply with search number to run
Or *ALERTS* to manage notifications
Or *0* to go back
```

**User runs saved search:**
```
Input: 1

[Executes saved search criteria]
[Shows results same as category browse]
```

---

### OPTION 6: MY RESPONSES

**User Input:** `6`

**Query user's lead responses:**
```javascript
// Find all leads where user has responded
const allLeads = await erpnext.query("RIFAH Lead", {
  is_active: 1
});

const myResponses = allLeads.filter(lead => {
  const interestedVendors = JSON.parse(lead.interested_vendors || "[]");
  return interestedVendors.some(v => v.vendor_id === member.rifah_id);
});

// Group by status
const pending = myResponses.filter(lead => {
  const vendors = JSON.parse(lead.interested_vendors);
  const myResponse = vendors.find(v => v.vendor_id === member.rifah_id);
  return myResponse.status === "Pending Admin Approval";
});

const approved = myResponses.filter(lead => {
  const vendors = JSON.parse(lead.interested_vendors);
  const myResponse = vendors.find(v => v.vendor_id === member.rifah_id);
  return myResponse.status === "Approved - Connected";
});

const declined = myResponses.filter(lead => {
  const vendors = JSON.parse(lead.interested_vendors);
  const myResponse = vendors.find(v => v.vendor_id === member.rifah_id);
  return myResponse.status === "Declined by Admin";
});
```

**Bot Message:**
```
📊 *MY LEAD RESPONSES*

━━━━━━━━━━━━━━━━━━━━━━
*PENDING REVIEW (${pending.length})*

${pending.map((lead, i) => {
  const vendors = JSON.parse(lead.interested_vendors);
  const myResponse = vendors.find(v => v.vendor_id === member.rifah_id);
  
  return `${i+1}. ${lead.lead_id}
   ${lead.title.substring(0, 50)}...
   📊 Your Score: ${myResponse.compatibility_score}/100
   📅 Responded: ${formatTimeAgo(myResponse.submitted_at)}
   ⏰ Pending: ${calculatePendingTime(myResponse.submitted_at)}`;
}).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━
*APPROVED - CONNECTED (${approved.length})*

${approved.slice(0, 3).map((lead, i) => `${i+1}. ${lead.lead_id}
   ✅ Connected ${formatTimeAgo(getMyConnectionDate(lead))}
   👤 Buyer: ${lead.member_name}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━
*DECLINED (${declined.length})*

${declined.slice(0, 2).map(lead => `• ${lead.lead_id} - ${getDeclineReason(lead)}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━

Reply with lead ID for details
Or *0* to go back
```

**User views response details:**
```
Input: LEAD-FREE-2024-0001

[Shows full lead details + user's qualification responses + current status]
```

---

## ADVANCED FILTERS (Premium)

**Trigger:** User types "FILTER" when viewing search results

**Bot Message:**
```
🔍 *ADVANCED FILTERS*

Current search: BUY leads in All India

*Apply filters:*

1️⃣ Budget Range
   Current: All budgets
   
2️⃣ Date Posted
   Current: All dates
   
3️⃣ Lead Tier
   Current: FREE + PREMIUM leads
   
4️⃣ Industry
   Current: All industries
   
5️⃣ Clear All Filters
0️⃣ Back

_Reply with filter number to modify_
```

**Budget Range Filter:**
```
Input: 1

Select budget range:

1️⃣ Under ₹50,000
2️⃣ ₹50,000 - ₹1,00,000
3️⃣ ₹1,00,000 - ₹5,00,000
4️⃣ ₹5,00,000 - ₹10,00,000
5️⃣ Above ₹10,00,000
6️⃣ Any budget

_Reply with a number_
```

**Date Posted Filter:**
```
1️⃣ Today
2️⃣ Last 3 days
3️⃣ Last week
4️⃣ Last month
5️⃣ Any date
```

**After applying filters:**
```
✅ Filters applied!

Budget: ₹50,000 - ₹1,00,000
Date: Last 3 days

Showing 12 matching leads...

[Shows filtered results]
```

---

## SAVE SEARCH (Premium)

**Trigger:** User types "SAVE SEARCH" when viewing results

**Bot Message:**
```
💾 *SAVE THIS SEARCH*

Give your search a name (max 30 chars):

Examples:
• "Packaging Leads Pune"
• "Urgent Manufacturing"
• "High Budget Services"

_Type search name or CANCEL_
```

**User provides name:**
```
Input: Packaging Leads Pune
```

**Save to user profile:**
```javascript
const savedSearches = JSON.parse(member.search_preferences || "[]");

savedSearches.push({
  name: userInput,
  filters: {
    lead_type: session_data.current_lead_type,
    location: session_data.current_location,
    urgency: session_data.current_urgency,
    budget_range: session_data.current_budget_filter,
    industry: session_data.current_industry_filter,
    date_posted: session_data.current_date_filter
  },
  created_at: new Date().toISOString(),
  last_run: null,
  alert_enabled: false
});

await erpnext.setValue("RIFAH Member", member.rifah_id,
  "search_preferences", JSON.stringify(savedSearches));

await whatsapp.send(userPhone, `
✅ *Search saved!*

Name: ${userInput}

Access anytime: Reply *SEARCHES*

Enable daily alerts? Reply YES or NO
`);
```

---

## DAILY LEAD ALERTS (Premium)

**Cron Job - Runs every morning at 9 AM:**

```javascript
async function sendDailyLeadAlerts() {
  // Get all premium members with alerts enabled
  const premiumMembers = await erpnext.query("RIFAH Member", {
    membership_tier: "PREMIUM",
    daily_alert_enabled: 1
  });
  
  for (const member of premiumMembers) {
    const savedSearches = JSON.parse(member.search_preferences || "[]");
    const enabledSearches = savedSearches.filter(s => s.alert_enabled);
    
    if (enabledSearches.length === 0) continue;
    
    let totalNewLeads = 0;
    let alertMessage = `🔔 *DAILY LEAD ALERT*\n\nGood morning! Here are new leads matching your saved searches:\n\n`;
    
    for (const search of enabledSearches) {
      const lastRun = search.last_run ? new Date(search.last_run) : new Date(0);
      const now = new Date();
      
      // Find leads posted since last run
      const newLeads = await erpnext.query("RIFAH Lead", {
        ...search.filters,
        created_at: [">=", lastRun.toISOString()],
        status: ["in", ["Posted to Groups", "Introductions Sent - Awaiting Vendor Response"]],
        is_active: 1
      });
      
      if (newLeads.length > 0) {
        totalNewLeads += newLeads.length;
        
        alertMessage += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        alertMessage += `*${search.name}* (${newLeads.length} new)\n\n`;
        
        // Show top 3 leads
        newLeads.slice(0, 3).forEach((lead, i) => {
          alertMessage += `${i+1}. ${lead.title.substring(0, 40)}...\n`;
          alertMessage += `   📍 ${lead.location} | 💰 ${lead.budget || 'Negotiable'}\n`;
          alertMessage += `   ⏰ ${lead.urgency} | 📅 ${formatTimeAgo(lead.created_at)}\n\n`;
        });
        
        if (newLeads.length > 3) {
          alertMessage += `   ... and ${newLeads.length - 3} more\n\n`;
        }
      }
      
      // Update last run time
      search.last_run = now.toISOString();
    }
    
    if (totalNewLeads > 0) {
      alertMessage += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      alertMessage += `Total: ${totalNewLeads} new leads\n\n`;
      alertMessage += `View all: Reply *SEARCH*\n`;
      alertMessage += `Manage alerts: Reply *ALERTS*`;
      
      await whatsapp.send(member.whatsapp_number, alertMessage);
      
      // Save updated last_run times
      await erpnext.setValue("RIFAH Member", member.rifah_id,
        "search_preferences", JSON.stringify(savedSearches));
    }
  }
}

// Schedule for 9 AM every day
// In n8n: Use Cron node with schedule "0 9 * * *"
```

---

## SESSION STATE REFERENCE

| current_step | Bot is waiting for |
|---|---|
| SEARCH_METHOD | Main search option (1-6) |
| CATEGORY_SELECT | Lead type category |
| LEAD_SELECT | Lead number to view |
| LEAD_ACTION | INTERESTED or BACK |
| VENDOR_Q1 to VENDOR_Q6 | Qualification answers |
| VENDOR_SCORE | SUBMIT or CANCEL |
| LOCATION_INPUT | City name (premium) |
| URGENCY_SELECT | Urgency level |
| FILTER_SELECT | Filter type to modify |
| FILTER_VALUE | Filter value selection |
| SAVE_SEARCH_NAME | Search name to save |
| COMPLETED | Flow finished |

---

## N8N WORKFLOW ARCHITECTURE

### Main Find Lead Path
- `IF Find Lead Selected` — Menu option 3
- `Show Search Methods` — 6 main options
- `Check Membership Tier` — Apply tier-based restrictions
- `Route by Search Method` — Category/Location/Urgency/All/Saved/Responses

### Browse by Category Path
- `Show Lead Categories` — BUY/SELL/SERVICE NEED/SERVICE OFFER with counts
- `Query Leads by Type` — GET from RIFAH Lead
- `Apply Tier Filters` — Industry + City for FREE, All for PREMIUM
- `Format Lead List` — Numbered list with details
- `Wait for Selection` — User picks lead number

### Lead Detail View Path
- `Get Lead Details` — Full lead information
- `Check Already Responded` — Query interested_vendors
- `Check Daily Limit` — Free tier: 3 per day
- `Show Lead Details` — Full info (premium gets AI qualification)
- `IF User Interested` — Start qualification

### Vendor Qualification Path (REUSE FROM FLOW 2A)
- `Generate AI Questions` — Same as Flow 2A vendor flow
- `Ask Questions 1-6` — Collect answers
- `Calculate Compatibility` — 0-100 score
- `Show Score Summary` — Display to vendor
- `IF Submit` — Store interest in lead
- `Notify Admin` — Same as Flow 2A
- `Update Daily Counter` — Increment for free users

### Search by Location Path
- `IF Premium` — Show location options
- `IF Free` — Auto-use member's city
- `Query by Location` — Filter leads
- `Show Results` — Same format as category

### Search by Urgency Path
- `Show Urgency Options` — URGENT/WEEK/MONTH/FLEXIBLE
- `Query by Urgency` — Filter leads
- `Show Results` — Same format

### View All Recent Path
- `Query Last 7 Days` — All recent leads
- `Apply Tier Filters` — Based on membership
- `Group by Date` — TODAY/YESTERDAY/THIS WEEK
- `Show Results` — Grouped list

### My Saved Searches Path (Premium)
- `Check Premium Access` — Block free users
- `Load Saved Searches` — From search_preferences JSON
- `Show Search List` — With last run info
- `IF User Runs Search` — Execute saved criteria
- `Update Last Run` — Timestamp

### Save Search Feature
- `Capture Search Criteria` — From session data
- `Request Search Name` — User input
- `Store in Preferences` — Update member record
- `Offer Alert Setup` — Enable daily notifications

### My Responses Path
- `Query User Responses` — Filter all leads by vendor_id
- `Group by Status` — Pending/Approved/Declined
- `Show Response List` — With scores and dates
- `IF Lead Selected` — Show details

### Daily Alert Cron
- `Run at 9 AM Daily` — Cron schedule
- `Get Premium Users with Alerts` — Query members
- `For Each User` — Loop through saved searches
- `Find New Leads` — Since last run
- `Send WhatsApp Alert` — Summary message
- `Update Last Run Times` — Save back to member

---

## CRITICAL FIXES

### Fix 1: Free Tier Daily Limit Reset
```javascript
// Reset counter at midnight, not first search of the day

async function checkAndResetDailyLimit(member) {
  const today = new Date().toISOString().split('T')[0];
  const lastSearchDate = member.last_search_date;
  
  if (lastSearchDate !== today) {
    // New day - reset counter
    await erpnext.update("RIFAH Member", member.rifah_id, {
      last_search_date: today,
      leads_responded_today: 0
    });
    
    return 0; // Reset count
  }
  
  return member.leads_responded_today;
}
```

### Fix 2: Duplicate Response Prevention
```javascript
// Check before starting qualification, not just displaying lead

async function checkDuplicateResponse(leadId, vendorId) {
  const lead = await erpnext.getDoc("RIFAH Lead", leadId);
  const interestedVendors = JSON.parse(lead.interested_vendors || "[]");
  
  return interestedVendors.some(v => v.vendor_id === vendorId);
}

// Use before qualification
if (await checkDuplicateResponse(lead.lead_id, member.rifah_id)) {
  return "You've already responded to this lead.";
}
```

### Fix 3: Industry Detection for Free Users
```javascript
// Accurate industry matching from lead description

function detectIndustry(description) {
  // Expanded keyword mapping
  const industryKeywords = {
    "Packaging": ["bottle", "container", "packaging", "box", "carton", "wrapper", "label"],
    "Manufacturing": ["machine", "equipment", "manufacturing", "production", "assembly", "fabrication"],
    "Food & Beverage": ["food", "beverage", "juice", "snack", "ingredient", "bakery", "dairy"],
    "Textile": ["fabric", "cloth", "textile", "garment", "cotton", "polyester", "yarn"],
    "IT & Software": ["software", "website", "app", "development", "digital", "cloud", "system"],
    "Construction": ["construction", "building", "cement", "steel", "contractor", "renovation"],
    "Retail": ["retail", "shop", "store", "outlet", "showroom", "franchise"],
    "Trading": ["trading", "export", "import", "wholesale", "distributor", "supplier"],
    "Chemicals": ["chemical", "pharma", "fertilizer", "pesticide", "industrial chemical"],
    "Automotive": ["auto", "vehicle", "car", "bike", "parts", "automotive", "garage"],
    "Electronics": ["electronic", "electrical", "components", "PCB", "semiconductor"],
    "Agriculture": ["agriculture", "farming", "seeds", "crop", "irrigation", "tractor"]
  };
  
  const desc = description.toLowerCase();
  
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return industry;
    }
  }
  
  return "General";
}
```

### Fix 4: Premium Search Performance
```javascript
// Optimize for 100K+ lead database

// Add database indexes
await erpnext.db.sql(`
  CREATE INDEX IF NOT EXISTS idx_lead_status 
  ON \`tabRIFAH Lead\` (status);
  
  CREATE INDEX IF NOT EXISTS idx_lead_created 
  ON \`tabRIFAH Lead\` (created_at);
  
  CREATE INDEX IF NOT EXISTS idx_lead_type 
  ON \`tabRIFAH Lead\` (lead_type);
  
  CREATE INDEX IF NOT EXISTS idx_lead_location 
  ON \`tabRIFAH Lead\` (location);
`);

// Use pagination for large result sets
const RESULTS_PER_PAGE = 20;

async function getLeadPage(filters, page = 1) {
  const offset = (page - 1) * RESULTS_PER_PAGE;
  
  return await erpnext.query("RIFAH Lead", filters, {
    order_by: "created_at DESC",
    limit: RESULTS_PER_PAGE,
    offset: offset
  });
}
```

---

## ENVIRONMENT VARIABLES

**No new variables needed** - uses existing configuration

---

## TEST SCENARIOS

### Test Suite Overview

**Total Test Cases:** 14  
**Coverage:** All search methods, tier restrictions, daily limits, saved searches  
**Execution Time:** ~30 minutes (manual) or ~5 minutes (automated)

---

### TEST 1: Browse by Category (Free User)

**Objective:** Verify free user can browse leads in their industry only

**Prerequisites:**
- User registered as FREE member (Industry: Packaging, City: Pune)
- At least 20 leads in database
- 10+ leads in Packaging industry near Pune
- 5+ leads in other industries/cities

**Test Steps:**

```
Step 1: Select Find Lead
  Input: Hi → 3
  Expected: "🔍 FIND LEAD"
  Expected: Shows 6 search options
  Expected: "⚠️ Free Tier: Search limited to your industry + city"
  
Step 2: Browse by category
  Input: 1
  Expected: "🔍 BROWSE LEADS BY CATEGORY"
  Expected: Shows 4 lead types with counts
  
Step 3: Select BUY leads
  Input: 1
  Expected: "🛒 BUY LEADS - Products Needed"
  Expected: "Showing leads in *Packaging* industry near *Pune, Maharashtra*"
  Expected: Shows only leads matching Packaging + Pune
  Expected: Does NOT show leads from other industries/cities
  Expected: Shows count like "(8 matches)"
```

**Verify in Code:**
```javascript
// All displayed leads should match user's industry and city
leads.forEach(lead => {
  const leadIndustry = detectIndustry(lead.description);
  const leadCity = extractCity(lead.location);
  
  assert(leadIndustry === "Packaging" || leadIndustry === "General");
  assert(lead.location.includes("Pune") || lead.location.includes("All India"));
});
```

---

### TEST 2: Browse All Leads (Premium User)

**Objective:** Verify premium user can see all leads across industries/locations

**Test Steps:**

```
Step 1-3: Same as Test 1 (browse to BUY leads)

Expected: "Showing all recent leads"
Expected: "(45 leads)" - much larger count
Expected: Shows leads from all industries (Packaging, IT, Textile, etc.)
Expected: Shows leads from all cities (Pune, Mumbai, Delhi, etc.)
Expected: "⭐ Premium Access: Search all leads across India"
```

**Verify:** Lead list includes diverse industries and locations

---

### TEST 3: View Lead Details & Respond

**Objective:** Complete flow from finding lead to submitting interest

**Test Steps:**

```
Step 1-3: Browse to lead list (Test 1)

Step 4: Select lead
  Input: 2 (second lead in list)
  Expected: "📋 LEAD DETAILS"
  Expected: Shows lead ID, type, description, location, budget, urgency
  Expected: "Reply INTERESTED to respond"
  
Step 5: Express interest
  Input: INTERESTED
  Expected: "Great! Let's check if you can fulfill this requirement"
  Expected: "I'll ask you 6 quick questions"
  Expected: Shows lead summary
  Expected: "Ready? Reply START"
  
Step 6: Start qualification
  Input: START
  Expected: "Question 1 of 6: [AI-generated question]"
  
Step 7-12: Answer 6 questions (SAME AS FLOW 2A)
  [Qualification flow identical to Flow 2A vendor response]
  
Step 13: View score
  Expected: "📊 Match Analysis Complete"
  Expected: "Compatibility Score: 85/100 🌟🌟🌟"
  Expected: "Reply SUBMIT or CANCEL"
  
Step 14: Submit interest
  Input: SUBMIT
  Expected: "✅ Interest submitted successfully!"
  Expected: Shows lead ID and score
  Expected: "Our admin will review your response"
  Expected: "Expected timeline: 4-24 hours"
```

**Verify in ERPNext:**
```sql
-- Interest stored in lead
SELECT interested_vendors FROM `tabRIFAH Lead`
WHERE lead_id = 'LEAD-FREE-2024-0002';

Expected JSON contains:
{
  vendor_id: "RIF-FREE-2024-0001",
  vendor_name: "User Business Name",
  compatibility_score: 85,
  status: "Pending Admin Approval",
  ai_qualification: {...}
}

-- Admin notification sent
Expected: Admin received WhatsApp with vendor match details
```

---

### TEST 4: Duplicate Response Prevention

**Prerequisites:** User already responded to a lead

**Test Steps:**

```
Step 1: Browse to same lead from Test 3
  Input: 2 (same lead)
  
  Expected: Lead details shown
  Expected: "✅ You already responded to this lead"
  Expected: "Status: Pending admin review"
  Expected: NO "Reply INTERESTED" option
  
Step 2: Try to respond anyway
  Input: INTERESTED
  
  Expected: "You've already responded to this lead."
  Expected: "Check status: Reply RESPONSES"
```

---

### TEST 5: Free User Daily Limit (3 responses/day)

**Objective:** Verify 3-response daily limit for free users

**Test Steps:**

```
Step 1: Respond to first lead
  [Complete qualification flow]
  Expected: "✅ Interest submitted!"
  Expected: "*Responses today:* 1/3"
  
Step 2: Respond to second lead
  [Complete qualification flow]
  Expected: "✅ Interest submitted!"
  Expected: "*Responses today:* 2/3"
  
Step 3: Respond to third lead
  [Complete qualification flow]
  Expected: "✅ Interest submitted!"
  Expected: "*Responses today:* 3/3"
  
Step 4: Try to respond to fourth lead
  Browse to lead → Select lead
  
  Expected: "⚠️ Daily response limit reached (3/3)"
  Expected: "💡 Upgrade to Premium for unlimited responses"
  Expected: NO qualification flow starts
  
Step 5: Check next day (mock time forward 24 hours)
  Browse to new lead → INTERESTED
  
  Expected: Qualification starts
  Expected: Counter reset to 0
  Expected: "Responses today: 1/3"
```

**Verify:**
```sql
-- Daily counter updated
SELECT last_search_date, leads_responded_today 
FROM `tabRIFAH Member`
WHERE rifah_id = 'RIF-FREE-2024-0001';

Expected after Step 3:
- last_search_date: Today's date
- leads_responded_today: 3

Expected after Step 5 (next day):
- last_search_date: Tomorrow's date
- leads_responded_today: 1
```

---

### TEST 6: Premium User Unlimited Responses

**Test Steps:**

```
Step 1: Premium user responds to 5 leads in a row
  [No daily limit should apply]
  
  Expected after each: "✅ Interest submitted!"
  Expected: NO "X/3 responses" message
  Expected: NO daily limit blocking
```

---

### TEST 7: Search by Location (Premium)

**Test Steps:**

```
Step 1: Select search by location
  Input: Hi → 3 → 2
  Expected: "📍 SEARCH BY LOCATION"
  Expected: Shows 4 options (My City, My State, Specific City, All India)
  
Step 2: Search specific city
  Input: 3 (Specific City)
  Expected: "Type city name (e.g., Delhi, Bangalore, Mumbai)"
  
Step 3: Type city
  Input: Mumbai
  Expected: Shows leads containing "Mumbai" in location
  Expected: Includes leads marked "Maharashtra" (state match)
  Expected: Includes leads marked "All India"
```

---

### TEST 8: Search by Urgency

**Test Steps:**

```
Step 1: Select urgency search
  Input: Hi → 3 → 3
  Expected: "⏰ SEARCH BY URGENCY"
  Expected: Shows 4 urgency levels with counts
  
Step 2: Select URGENT
  Input: 1
  Expected: Shows only leads with urgency = "URGENT"
  Expected: All leads displayed have "⏰ Urgency: URGENT"
```

---

### TEST 9: View All Recent Leads

**Test Steps:**

```
Step 1: View all recent
  Input: Hi → 3 → 4
  Expected: "📋 ALL RECENT LEADS"
  Expected: "Showing leads from last 7 days"
  Expected: Leads grouped by date (TODAY, YESTERDAY, THIS WEEK)
  Expected: Max 50 leads shown
  Expected: All leads created within last 7 days
```

**Verify:**
```javascript
leads.forEach(lead => {
  const daysAgo = (new Date() - new Date(lead.created_at)) / (1000 * 60 * 60 * 24);
  assert(daysAgo <= 7);
});
```

---

### TEST 10: My Responses View

**Prerequisites:** User has responded to 3 leads (1 pending, 1 approved, 1 declined)

**Test Steps:**

```
Step 1: View responses
  Input: Hi → 3 → 6
  Expected: "📊 MY LEAD RESPONSES"
  Expected: Shows grouped sections:
    - "PENDING REVIEW (1)"
    - "APPROVED - CONNECTED (1)"
    - "DECLINED (1)"
  Expected: Each shows lead ID, title, score, status
  
Step 2: View pending response details
  Input: LEAD-FREE-2024-0001
  Expected: Full lead details
  Expected: Shows user's qualification responses
  Expected: "Status: Pending admin review"
  Expected: Shows time elapsed since response
```

---

### TEST 11: Save Search (Premium Only)

**Objective:** Verify premium users can save search criteria

**Test Steps:**

```
Step 1: Browse leads with specific filters
  Input: Hi → 3 → 1 → 1 (BUY leads)
  Expected: Shows BUY leads list
  
Step 2: Save search
  Input: SAVE SEARCH
  Expected: "💾 SAVE THIS SEARCH"
  Expected: "Give your search a name (max 30 chars)"
  
Step 3: Name search
  Input: Packaging Leads Pune
  Expected: "✅ Search saved!"
  Expected: "Name: Packaging Leads Pune"
  Expected: "Access anytime: Reply SEARCHES"
  Expected: "Enable daily alerts? Reply YES or NO"
  
Step 4: Enable alerts
  Input: YES
  Expected: "🔔 Daily alerts enabled"
  Expected: "You'll receive WhatsApp notifications at 9 AM"
```

**Verify:**
```sql
-- Search saved in preferences
SELECT search_preferences FROM `tabRIFAH Member`
WHERE rifah_id = 'RIF-PREM-2024-0001';

Expected JSON:
[
  {
    name: "Packaging Leads Pune",
    filters: {
      lead_type: "BUY",
      location: "Pune",
      ...
    },
    created_at: "2024-03-18T...",
    alert_enabled: true
  }
]
```

---

### TEST 12: Access Saved Searches (Premium)

**Prerequisites:** Test 11 completed (1 saved search exists)

**Test Steps:**

```
Step 1: View saved searches
  Input: Hi → 3 → 5
  Expected: "⭐ MY SAVED SEARCHES"
  Expected: "🔔 Daily alerts: ON"
  Expected: Shows saved search:
    - "📦 Packaging Leads Pune"
    - "Filters: Category=BUY, Location=Pune..."
    - "Last run: [timestamp]"
    - "New matches: X leads"
    
Step 2: Run saved search
  Input: 1
  Expected: Executes search with saved criteria
  Expected: Shows BUY leads in Pune
  Expected: Updates "Last run" timestamp
```

---

### TEST 13: Daily Lead Alerts (Premium)

**Objective:** Verify daily alert cron job

**Test Setup:**
- Premium user with 1 saved search (alerts enabled)
- 3 new leads matching criteria posted overnight
- Cron job runs at 9 AM

**Test Steps:**

```
Step 1: Cron job executes (mock 9 AM)
  
Step 2: User receives WhatsApp alert
  Expected: "🔔 DAILY LEAD ALERT"
  Expected: "Good morning! Here are new leads matching your saved searches:"
  Expected: Shows search name: "Packaging Leads Pune (3 new)"
  Expected: Lists top 3 new leads with details
  Expected: "Total: 3 new leads"
  Expected: "View all: Reply SEARCH"
```

**Verify:**
```sql
-- Last run timestamp updated
SELECT search_preferences FROM `tabRIFAH Member`
WHERE rifah_id = 'RIF-PREM-2024-0001';

Expected: search.last_run updated to cron execution time
```

---

### TEST 14: Free User Blocked from Premium Features

**Test Steps:**

```
Test 14a: Try to save search
  [Free user browsing leads]
  Input: SAVE SEARCH
  Expected: "This is a Premium feature"
  Expected: Upgrade prompt shown
  Expected: Search NOT saved
  
Test 14b: Try to access saved searches
  Input: Hi → 3 → 5
  Expected: "⭐ SAVED SEARCHES"
  Expected: "Save your favorite search criteria... This is a Premium feature"
  Expected: Upgrade prompt
  
Test 14c: Try to search all locations
  Input: Hi → 3 → 2 (Search by location)
  Expected: "Searching leads in *Pune, Maharashtra*"
  Expected: "(Free tier: Your city only)"
  Expected: NO option to select other cities
  Expected: Automatically filters to user's city
```

---

## AUTOMATED TEST SCRIPT

**File:** `test_suite/test_flow3.js`

```javascript
const assert = require('assert');
const { searchLeads, respondToLead, saveSear } = require('./helpers');

describe('Flow 3: Find Lead', function() {
  this.timeout(45000);
  
  describe('Search & Browse', () => {
    it('should filter leads by tier (free user)', async () => {
      const leads = await searchLeads({
        phone: '919876543210',  // FREE user
        tier: 'FREE',
        category: 'BUY'
      });
      
      const member = await getMember('919876543210');
      const userCity = extractCity(member.city_state);
      const userIndustry = member.industry;
      
      // Verify all leads match user's industry and city
      leads.forEach(lead => {
        const leadIndustry = detectIndustry(lead.description);
        const leadCity = extractCity(lead.location);
        
        assert.ok(
          leadIndustry === userIndustry || 
          leadIndustry === "General" ||
          lead.location.includes("All India")
        );
        assert.ok(
          leadCity === userCity || 
          lead.location.includes("All India")
        );
      });
    });
    
    it('should show all leads for premium users', async () => {
      const leads = await searchLeads({
        phone: '919111111111',  // PREMIUM user
        tier: 'PREMIUM',
        category: 'BUY'
      });
      
      // Should have leads from multiple industries and cities
      const industries = new Set(leads.map(l => detectIndustry(l.description)));
      const cities = new Set(leads.map(l => extractCity(l.location)));
      
      assert.ok(industries.size >= 3);
      assert.ok(cities.size >= 3);
    });
  });
  
  describe('Daily Limits (Free Tier)', () => {
    it('should enforce 3 responses per day limit', async () => {
      const freeUser = await getMember('919876543210');
      
      // Reset counter
      await erpnext.update("RIFAH Member", freeUser.rifah_id, {
        last_search_date: new Date().toISOString().split('T')[0],
        leads_responded_today: 0
      });
      
      // Respond to 3 leads
      for (let i = 0; i < 3; i++) {
        const result = await respondToLead({
          phone: freeUser.whatsapp_number,
          leadId: `LEAD-FREE-2024-000${i+1}`
        });
        
        assert.ok(result.success);
      }
      
      // Try 4th response
      try {
        await respondToLead({
          phone: freeUser.whatsapp_number,
          leadId: 'LEAD-FREE-2024-0004'
        });
        assert.fail('Should have blocked 4th response');
      } catch (e) {
        assert.ok(e.message.includes('Daily response limit reached'));
      }
    });
    
    it('should reset counter on new day', async () => {
      const freeUser = await getMember('919876543210');
      
      // Set counter to 3 for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await erpnext.update("RIFAH Member", freeUser.rifah_id, {
        last_search_date: yesterday.toISOString().split('T')[0],
        leads_responded_today: 3
      });
      
      // Try to respond today
      const result = await respondToLead({
        phone: freeUser.whatsapp_number,
        leadId: 'LEAD-FREE-2024-0005'
      });
      
      assert.ok(result.success);
      
      const updated = await getMember(freeUser.rifah_id);
      assert.strictEqual(updated.leads_responded_today, 1);
    });
  });
  
  describe('Saved Searches (Premium)', () => {
    it('should save search criteria', async () => {
      const premiumUser = await getMember('919111111111');
      
      const saved = await saveSearch({
        memberId: premiumUser.rifah_id,
        name: "Test Search",
        filters: {
          lead_type: "BUY",
          location: "Pune",
          urgency: "URGENT"
        }
      });
      
      assert.ok(saved.success);
      
      const updated = await getMember(premiumUser.rifah_id);
      const searches = JSON.parse(updated.search_preferences);
      
      assert.ok(searches.length > 0);
      assert.strictEqual(searches[0].name, "Test Search");
    });
    
    it('should block free users from saving searches', async () => {
      try {
        await saveSearch({
          memberId: 'RIF-FREE-2024-0001',
          name: "Test Search"
        });
        assert.fail('Should have blocked free user');
      } catch (e) {
        assert.ok(e.message.includes('Premium feature'));
      }
    });
  });
  
  describe('Duplicate Prevention', () => {
    it('should prevent duplicate responses', async () => {
      const user = await getMember('919876543210');
      const leadId = 'LEAD-FREE-2024-0001';
      
      // First response
      await respondToLead({
        phone: user.whatsapp_number,
        leadId: leadId
      });
      
      // Try second response
      try {
        await respondToLead({
          phone: user.whatsapp_number,
          leadId: leadId
        });
        assert.fail('Should have blocked duplicate response');
      } catch (e) {
        assert.ok(e.message.includes('already responded'));
      }
    });
  });
});
```

---

## TEST DATA SETUP

**Script:** `scripts/setup_flow3_test_data.js`

```javascript
// Create 50 test leads across various categories

const leads = [];

// 20 BUY leads
for (let i = 1; i <= 20; i++) {
  leads.push({
    lead_id: `LEAD-FREE-2024-${String(i).padStart(4, '0')}`,
    tier: i % 5 === 0 ? "PREMIUM" : "FREE",
    lead_type: "BUY",
    title: getRandomProductTitle(),
    description: getRandomDescription(),
    location: getRandomLocation(),
    urgency: getRandomUrgency(),
    budget: getRandomBudget(),
    status: "Posted to Groups",
    posted_to_groups: JSON.stringify([{...}]),
    interested_vendors: "[]",
    created_at: getRandomDate(7) // Within last 7 days
  });
}

// 15 SELL leads
// 10 SERVICE NEED leads
// 5 SERVICE OFFER leads

function getRandomLocation() {
  const locations = [
    "Pune, Maharashtra",
    "Mumbai, Maharashtra",
    "Delhi, Delhi",
    "Bangalore, Karnataka",
    "Chennai, Tamil Nadu",
    "All India"
  ];
  return locations[Math.floor(Math.random() * locations.length)];
}

function getRandomProductTitle() {
  const products = [
    "Plastic Bottles - 500ml Food Grade",
    "Cotton T-Shirts Bulk Order",
    "Industrial Packaging Material",
    "Website Development Services",
    "CNC Machining Parts",
    "Digital Marketing Services"
  ];
  return products[Math.floor(Math.random() * products.length)];
}

function getRandomDescription() {
  // Include industry keywords for detection
  const descriptions = [
    "Need 5000 food-grade PET bottles for juice packaging business",
    "Looking to purchase cotton fabric in bulk for garment manufacturing",
    "Required packaging material for export shipments",
    "Need WordPress website development with e-commerce integration",
    "CNC machining services needed for automotive parts production"
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}
```

---

## TESTING CHECKLIST

**Before Testing:**
- [ ] ERPNext running
- [ ] At least 50 test leads in database
- [ ] Leads across all 4 categories
- [ ] Leads in multiple cities
- [ ] Free and premium users registered
- [ ] Daily limit counter works

**Core Functionality:**
- [ ] Test 1: Browse by category (free user)
- [ ] Test 2: Browse all leads (premium user)
- [ ] Test 3: View lead & respond
- [ ] Test 7: Search by location (premium)
- [ ] Test 8: Search by urgency
- [ ] Test 9: View all recent leads
- [ ] Test 10: My responses view

**Access Control:**
- [ ] Test 4: Duplicate response prevention
- [ ] Test 5: Free daily limit (3 responses)
- [ ] Test 6: Premium unlimited responses
- [ ] Test 14: Free user blocked from premium features

**Premium Features:**
- [ ] Test 11: Save search
- [ ] Test 12: Access saved searches
- [ ] Test 13: Daily lead alerts

**After Testing:**
- [ ] Free tier filters working
- [ ] Premium users see all leads
- [ ] Daily limits enforced
- [ ] Saved searches working
- [ ] Alert cron job scheduled
- [ ] No duplicate responses

---

## DELIVERABLES CHECKLIST

- [ ] `n8n/rifah_flow3_workflow.json` — importable workflow
- [ ] `scripts/populate_test_leads.js` — generate 50+ leads
- [ ] `scripts/daily_alert_cron.js` — alert scheduler
- [ ] `test_suite/test_flow3.js` — automated tests
- [ ] Updated `doctypes/rifah_member.json` — add search_preferences fields
- [ ] `documents/flow3_setup_guide.md` — setup instructions
- [ ] `documents/flow3_architecture.md` — technical design
- [ ] `documents/saved_search_guide.md` — premium feature documentation

---

## COST ANALYSIS

### AI Costs (Same as Flow 2A)

- Same vendor qualification flow as Flow 2A
- Same OpenAI API calls (6 questions per response)
- Cost per response: ₹0.05 (same as Flow 2A)

### Expected Volume

| Scenario | Active Users | Searches/Day | Responses/Day | AI Calls/Month | Monthly Cost |
|----------|-------------|--------------|---------------|----------------|--------------|
| Launch | 1,000 | 500 | 100 | 3,000 | ₹75 |
| Growing | 5,000 | 2,500 | 500 | 15,000 | ₹375 |
| Mature | 20,000 | 10,000 | 2,000 | 60,000 | ₹1,500 |

**Note:** Lower response rate than Flow 2 (posting leads) because not all searches result in responses

---

END OF FLOW 3 MASTER PROMPT
