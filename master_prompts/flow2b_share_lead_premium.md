# RIFAH Connect — Master Prompt: Flow 2B Share Lead (Premium User)

## CONTEXT FOR CLAUDE CODE

You are building Flow 2B (Share Lead - Premium User) for RIFAH Connect — a WhatsApp Business
automation platform for a chamber of commerce connecting 1 lakh+ businesses in India.

**Prerequisites:**
- Flow 1 (Registration/Update) is already in production
- Flow 2A (Share Lead - Free User) is already in production
- RIFAH Member, RIFAH Session, RIFAH Lead, RIFAH WhatsApp Group doctypes exist
- User must be registered PREMIUM member (RIF-PREM-XXXX-YYYY)

Read these files before starting:
- `docker-compose.yml` — understand all running services
- `.env` — all credentials and configuration
- `documents/` — setup guides and architecture notes
- `flow2a_share_lead_free.md` — reference for shared components

---

## TECH STACK

| Component | Technology | Access |
|-----------|------------|--------|
| WhatsApp | Meta Cloud API (direct, free) | Via HTTP to graph.facebook.com |
| Automation | n8n (self-hosted) | http://localhost:5678 |
| Database | ERPNext v15 | http://localhost:8080 |
| AI | OpenAI GPT-4o-mini | https://api.openai.com/v1/chat/completions |
| Tunnel | ngrok static domain | URL in .env as NGROK_URL |
| Storage | Local filesystem in Docker volume | rifah_uploads volume |
| OS | Intel Mac (Docker Desktop) | - |

**ERPNext internal site name:** `rifah.localhost`
**n8n webhook base path:** `/webhook/whatsapp-webhook`
**Admin WhatsApp number:** Stored in .env as ADMIN_WHATSAPP

---

## MEMBERSHIP TIERS (Reference)

| Tier | Price | Groups | Support | Response | Matching |
|------|-------|--------|---------|----------|----------|
| FREE | ₹0/year | 2-3 WhatsApp groups | Manual | 24-48 hours | Group posting only |
| PREMIUM | ₹3,000/year | 5-10 WhatsApp groups | 24/7 bot | 2-4 hours | **Smart algorithm + Groups fallback** |

**This flow is for PREMIUM tier users only.**

---

## KEY DIFFERENCES FROM FLOW 2A (FREE USER)

| Feature | Flow 2A (FREE) | Flow 2B (PREMIUM) |
|---------|----------------|-------------------|
| **Processing** | Admin approval required before posting | **Instant auto-processing** |
| **Matching** | Group posting only | **Smart algorithm searches 1L+ businesses first** |
| **Results** | Passive (wait for group responses) | **Active: Top 10 vendors shown immediately** |
| **User Action** | Wait for vendors to respond | **User selects vendors from list** |
| **Fallback** | None | **Auto-post to groups if no matches found** |
| **Groups Posted** | Marked as regular posts | **Marked "⭐ PREMIUM REQUEST"** |
| **Priority** | Normal (4-hour SLA) | **High priority (2-hour SLA)** |
| **Admin Approval** | Before posting | **After matching, before connection** |

---

## ERPNEXT CUSTOM DOCTYPES REQUIRED

### All doctypes from Flow 2A are reused:
- RIFAH Lead (same structure, tier = "PREMIUM")
- RIFAH WhatsApp Group (same)
- RIFAH Session (same)
- RIFAH Member (same)

**No new doctypes needed for Flow 2B.**

---

## COMPLETE CONVERSATION FLOW

### Entry Point
User (registered PREMIUM member) sends "Hi" → Bot shows main menu → User selects "2️⃣ Share Lead"

**Prerequisite Check:**
```javascript
// Query ERPNext RIFAH Member
const member = await erpnext.query("RIFAH Member", {
  whatsapp_number: userPhone,
  membership_tier: "PREMIUM"
});

if (!member || member.length === 0) {
  return "⚠️ Please register first or upgrade to PREMIUM. Reply with 1️⃣";
}

// Member is PREMIUM - proceed with premium flow
```

**Bot Message:**
```
⭐ *PREMIUM LEAD POSTING*

Your lead will be:
✓ Processed instantly (no waiting)
✓ Matched against 1 lakh+ businesses
✓ Top 10 matches shown to you
✓ Posted to groups if no direct matches

Let's begin!
```

Session step: `LEAD_TYPE`

---

### STEP 1-5: CAPTURE BASIC DETAILS & AI QUALIFICATION

**EXACTLY THE SAME AS FLOW 2A:**

1. Lead Type (BUY/SELL/SERVICE NEED/SERVICE OFFER)
2. Description (minimum 10 words)
3. Location preference
4. Urgency (URGENT/THIS WEEK/THIS MONTH/FLEXIBLE)
5. Budget range (optional)
6. AI-powered qualification (3-6 questions using OpenAI)

**See Flow 2A prompt for detailed specifications.**

Session steps: `LEAD_TYPE` → `LEAD_DESC` → `LEAD_LOC` → `LEAD_URGENCY` → `LEAD_BUDGET` → `AI_Q1` through `AI_Q6`

---

### STEP 6: AUTO-PROCESS LEAD (NO ADMIN APPROVAL)

**Difference from FREE:** Premium users skip admin review, instant processing

**Generate Lead ID:**
```javascript
const count = await erpnext.count("RIFAH Lead", {
  tier: "PREMIUM",
  created_at: [">=", "2024-01-01"]
});

const leadId = `LEAD-PREM-2024-${String(count + 1).padStart(4, '0')}`;
// Example: LEAD-PREM-2024-0001
```

**Create RIFAH Lead in ERPNext:**
```javascript
const leadData = {
  lead_id: leadId,
  member_id: member.rifah_id,
  member_name: member.business_name,
  member_phone: member.whatsapp_number,
  tier: "PREMIUM",
  lead_type: session_data.lead_type,
  title: session_data.lead_description.substring(0, 50) + "...",
  description: session_data.lead_description,
  location: session_data.lead_location,
  urgency: session_data.lead_urgency,
  budget: session_data.lead_budget,
  ai_qualification: JSON.stringify({
    question_1: session_data.ai_question_1,
    answer_1: session_data.ai_answer_1,
    // ... up to question_6
  }),
  status: "Processing - Running Matching Algorithm",  // Different from FREE
  posted_to_groups: "[]",
  interested_vendors: "[]",
  matched_vendors: "[]",  // New field for premium
  connection_made: 0,
  created_at: new Date().toISOString()
};

await erpnext.create("RIFAH Lead", leadData);
```

**Message to user:**
```
✅ *Lead created!*

📋 Lead ID: *{leadId}*
📝 Type: {emoji} {lead_type}

⚡ *Processing instantly...*
🔍 *Searching 1 lakh+ businesses...*

_This will take 5-10 seconds..._
```

**Next:** Immediately trigger smart matching algorithm

---

### STEP 7: SMART MATCHING ALGORITHM

**Process:**
1. Query all RIFAH Members with matching potential
2. Score each business 0-100 points
3. Return top 10 highest scoring vendors
4. If < 3 matches (score ≥ 40), trigger group posting fallback

**Algorithm (JavaScript in n8n):**

```javascript
async function matchVendorsForLead(lead) {
  // Get all active members (exclude the buyer themselves)
  const allVendors = await erpnext.query("RIFAH Member", {
    status: ["in", ["Active Free", "Active Premium"]],
    rifah_id: ["!=", lead.member_id]
  });
  
  const matches = allVendors.map(vendor => {
    let score = 0;
    
    // 1. CITY EXACT MATCH: +30 points
    const leadCity = extractCity(lead.location);
    const vendorCity = extractCity(vendor.city_state);
    if (leadCity && vendorCity && leadCity.toLowerCase() === vendorCity.toLowerCase()) {
      score += 30;
    }
    
    // 2. INDUSTRY MATCH: +20 points (exact), +10 (related)
    const leadIndustry = detectIndustry(lead.description);
    const vendorIndustry = vendor.industry;
    
    if (leadIndustry && vendorIndustry) {
      if (leadIndustry.toLowerCase() === vendorIndustry.toLowerCase()) {
        score += 20; // Exact match
      } else if (isRelatedIndustry(leadIndustry, vendorIndustry)) {
        score += 10; // Related industry
      }
    }
    
    // 3. PAST SUCCESSFUL DEALS: +5 per deal (max +25)
    const pastDeals = vendor.successful_deals || 0;
    score += Math.min(pastDeals * 5, 25);
    
    // 4. RATING ≥ 4.5 STARS: +10 points
    const rating = vendor.rating || 0;
    if (rating >= 4.5) {
      score += 10;
    }
    
    // 5. YEARS OF EXPERIENCE: +1 per year (max +10)
    const years = vendor.years_operating || 0;
    score += Math.min(years, 10);
    
    // 6. RESPONSE RATE > 80%: +10 points
    const responseRate = vendor.response_rate || 0;
    if (responseRate > 0.8) {
      score += 10;
    }
    
    // 7. PREMIUM MEMBER BONUS: +5 points
    if (vendor.membership_tier === "PREMIUM") {
      score += 5;
    }
    
    return {
      vendor_id: vendor.rifah_id,
      vendor_name: vendor.business_name,
      vendor_phone: vendor.whatsapp_number,
      vendor_city: vendor.city_state,
      vendor_industry: vendor.industry,
      vendor_years: vendor.years_operating,
      vendor_rating: vendor.rating || 0,
      vendor_tier: vendor.membership_tier,
      score: score,
      match_details: {
        city_match: leadCity === vendorCity,
        industry_match: leadIndustry,
        past_deals: pastDeals,
        rating: rating,
        experience: years,
        response_rate: responseRate
      }
    };
  });
  
  // Return vendors with score ≥ 40, sorted by score, top 10
  return matches
    .filter(m => m.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// Helper functions (same as Flow 2A)
function extractCity(location) {
  return location.split(",")[0].trim();
}

function detectIndustry(description) {
  // Same keyword matching as Flow 2A
  const keywords = {
    "Packaging": ["bottle", "container", "packaging", "box", "carton"],
    "Manufacturing": ["machine", "equipment", "manufacturing", "production"],
    "Food": ["food", "beverage", "juice", "snack", "ingredient"],
    "Textile": ["fabric", "cloth", "textile", "garment", "cotton"],
    "IT": ["software", "website", "app", "development", "digital"],
    "Construction": ["construction", "building", "cement", "steel"],
    "Retail": ["retail", "shop", "store", "outlet"],
    "Trading": ["trading", "export", "import", "wholesale"]
  };
  
  const desc = description.toLowerCase();
  for (const [industry, words] of Object.entries(keywords)) {
    if (words.some(word => desc.includes(word))) {
      return industry;
    }
  }
  return "General";
}

function isRelatedIndustry(industry1, industry2) {
  const related = {
    "Packaging": ["Manufacturing", "Food", "Retail"],
    "Food": ["Packaging", "Retail", "Trading"],
    "Textile": ["Manufacturing", "Retail", "Trading"],
    "IT": ["Services"],
    "Construction": ["Manufacturing", "Trading"],
    "Retail": ["Trading", "Packaging"],
    "Trading": ["Manufacturing", "Retail", "Packaging"]
  };
  
  return related[industry1]?.includes(industry2) || false;
}
```

**Processing Time:** Simulate 5-10 seconds for searching database

---

### STEP 8: RESULT SCENARIOS

#### **SCENARIO A: MATCHES FOUND (≥3 vendors with score ≥40)**

**Update Lead:**
```javascript
await erpnext.update("RIFAH Lead", leadId, {
  matched_vendors: JSON.stringify(matchedVendors),
  status: "Matched - Awaiting User Selection"
});
```

**Message to User:**
```
✅ *Found {count} matching vendors!*

Top matches for your requirement:
━━━━━━━━━━━━━━━━━━━━━━

*1. ABC Packaging Industries*
📍 Pune, Maharashtra
⭐ Rating: 4.8/5 | 🏭 Packaging
📊 Match: *87/100*
✓ 10 years experience
✓ Food-grade certified
✓ 25 successful deals

*2. XYZ Plastics Pvt Ltd*
📍 Pune, Maharashtra
⭐ Rating: 4.6/5 | 🏭 Packaging
📊 Match: *82/100*
✓ 8 years experience
✓ FSSAI certified
✓ 18 successful deals

*3. PQR Manufacturing*
📍 Mumbai, Maharashtra
⭐ Rating: 4.7/5 | 🏭 Manufacturing
📊 Match: *78/100*
✓ 12 years experience
✓ ISO certified
✓ 30 successful deals

[Shows up to 10 vendors]

━━━━━━━━━━━━━━━━━━━━━━

*Select vendors to contact:*
Reply with numbers (e.g., "1,2,3" or "1-5" or "ALL")
```

Session step: `VENDOR_SELECTION`

**User selects vendors:**
```
Input: 1,2,3
or
Input: 1-5
or
Input: ALL
```

**Parse selection:**
```javascript
function parseVendorSelection(input, totalVendors) {
  input = input.toUpperCase().trim();
  
  if (input === "ALL") {
    return Array.from({length: totalVendors}, (_, i) => i + 1);
  }
  
  // Handle ranges: "1-5"
  if (input.includes("-")) {
    const [start, end] = input.split("-").map(n => parseInt(n.trim()));
    const selected = [];
    for (let i = start; i <= Math.min(end, totalVendors); i++) {
      selected.push(i);
    }
    return selected;
  }
  
  // Handle comma-separated: "1,2,3"
  return input.split(",")
    .map(n => parseInt(n.trim()))
    .filter(n => n >= 1 && n <= totalVendors);
}

const selected = parseVendorSelection(userInput, matchedVendors.length);
// Example: [1, 2, 3]
```

**Confirm selection:**
```
✅ *Selected {count} vendors*

We'll send introduction messages to:
• ABC Packaging Industries
• XYZ Plastics Pvt Ltd
• PQR Manufacturing

Vendors have *12 hours* to respond.
You'll be notified when they accept.

_Proceed? Reply YES or CHANGE_
```

**User confirms:** YES

**Next:** Send direct introductions (Step 9)

---

#### **SCENARIO B: FEW MATCHES (<3 vendors with score ≥40)**

**Message to user:**
```
🔍 *Search Complete*

We searched 1,00,000+ businesses but found only {count} direct matches meeting your specific requirements.

⭐ *PREMIUM FALLBACK ACTIVATED*

We'll also post your requirement to relevant WhatsApp groups to reach a wider audience.

━━━━━━━━━━━━━━━━━━━━━━
*Your requirement will be:*
1. Sent to {count} matched vendors directly
2. Posted to 5-7 premium WhatsApp groups

*Expected reach:* 5,000+ members
━━━━━━━━━━━━━━━━━━━━━━

_Proceeding with both methods..._
```

**Process:**
1. Show available matches (if any)
2. Auto-post to groups (marked "⭐ PREMIUM REQUEST")
3. Vendors can respond via interactive links (same as Flow 2A)

**Next:** Group posting + Direct introductions

---

### STEP 9: SEND DIRECT INTRODUCTIONS

**For each selected vendor, send personalized WhatsApp:**

```javascript
for (const selectedIndex of selectedIndexes) {
  const vendor = matchedVendors[selectedIndex - 1];
  
  await whatsapp.send(vendor.vendor_phone, 
`⭐ *PREMIUM LEAD MATCH*

A premium member needs your expertise!

*Requirement:*
📋 {lead.title}
📝 Type: {lead.lead_type}
📍 Location: {lead.location}
💰 Budget: {lead.budget || 'Negotiable'}
⏰ Timeline: {lead.urgency}

*Detailed Specifications:*
${formatAISpecs(lead.ai_qualification)}

*Match Score: {vendor.score}/100*

*Why you matched:*
${formatMatchReasons(vendor.match_details)}

Lead ID: {leadId}

━━━━━━━━━━━━━━━━━━━━━━
*Are you interested in this requirement?*

Reply:
*INTERESTED* - Start qualification
*NOT NOW* - Skip this lead
*DETAILS* - View more information
━━━━━━━━━━━━━━━━━━━━━━

_You have 12 hours to respond._
`);
  
  // Store introduction sent
  const introductions = JSON.parse(lead.introduction_sent || "[]");
  introductions.push({
    vendor_id: vendor.vendor_id,
    vendor_name: vendor.vendor_name,
    match_score: vendor.score,
    sent_at: new Date().toISOString(),
    response_deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    status: "Awaiting Response"
  });
  
  await erpnext.update("RIFAH Lead", leadId, {
    introduction_sent: JSON.stringify(introductions),
    status: "Introductions Sent - Awaiting Vendor Response"
  });
}

function formatAISpecs(aiQualification) {
  const qa = JSON.parse(aiQualification);
  let specs = "";
  for (let i = 1; i <= 6; i++) {
    if (qa[`answer_${i}`]) {
      specs += `• ${qa[`question_${i}`].split('?')[0]}: ${qa[`answer_${i}`]}\n`;
    }
  }
  return specs.trim();
}

function formatMatchReasons(matchDetails) {
  const reasons = [];
  if (matchDetails.city_match) reasons.push("✓ Same city");
  if (matchDetails.industry_match) reasons.push(`✓ ${matchDetails.industry_match} industry`);
  if (matchDetails.rating >= 4.5) reasons.push(`✓ High rating (${matchDetails.rating}/5)`);
  if (matchDetails.past_deals > 10) reasons.push(`✓ ${matchDetails.past_deals} successful deals`);
  if (matchDetails.experience >= 5) reasons.push(`✓ ${matchDetails.experience} years experience`);
  return reasons.join("\n");
}
```

**Notify user:**
```
✅ *Introductions sent!*

We've contacted:
• ABC Packaging Industries (87% match)
• XYZ Plastics Pvt Ltd (82% match)
• PQR Manufacturing (78% match)

Vendors have *12 hours* to respond.

We'll notify you immediately when:
• Vendor shows interest
• Vendor qualifies successfully
• Connection is ready to be made

You can track responses in your dashboard.
Thank you! 🙏
```

**Update session:**
```javascript
await erpnext.update("RIFAH Session", sessionName, {
  current_step: "COMPLETED",
  status: "Completed"
});
```

---

### STEP 10: VENDOR RESPONSE TO DIRECT INTRODUCTION

**Vendor receives introduction message, replies:**

**Option 1: INTERESTED**
```
Input: INTERESTED
```

**Bot creates qualification session (same as Flow 2A):**
- Verify vendor is registered
- Start AI qualification (6 questions)
- Calculate compatibility score
- Ask for SUBMIT or CANCEL

**This is IDENTICAL to Flow 2A vendor qualification flow.**

---

**Option 2: NOT NOW**
```
Input: NOT NOW
```

**Update status:**
```javascript
// Update vendor response status
const introductions = JSON.parse(lead.introduction_sent);
const vendorIntro = introductions.find(i => i.vendor_phone === vendorPhone);
vendorIntro.status = "Declined";
vendorIntro.responded_at = new Date().toISOString();

await erpnext.update("RIFAH Lead", leadId, {
  introduction_sent: JSON.stringify(introductions)
});
```

**Confirm to vendor:**
```
Thank you for your response.

We've noted that you're not available for this requirement right now.

You'll continue to receive relevant leads based on your expertise.
```

---

**Option 3: DETAILS**
```
Input: DETAILS
```

**Show complete lead information:**
```
📋 *Complete Lead Details*

*Buyer Information:*
🏢 Business: {buyer.business_name}
📍 Location: {buyer.city_state}
🏭 Industry: {buyer.industry}

*Requirement:*
{lead.description}

*AI Qualification Details:*
${formatCompleteAIQA(lead.ai_qualification)}

*Your Match Analysis:*
Score: {vendor.score}/100
${formatMatchReasons(vendor.match_details)}

━━━━━━━━━━━━━━━━━━━━━━

Reply:
*INTERESTED* - Proceed with qualification
*NOT NOW* - Skip this lead
```

---

### STEP 11: ADMIN APPROVAL (PHASE 1)

**After vendor completes qualification and submits interest:**

**Send WhatsApp to admin:**
```
🤝 *PREMIUM VENDOR MATCH FOR APPROVAL*

📋 Lead ID: {leadId} ⭐ PREMIUM
📝 Requirement: {lead.title}
👤 Buyer: {lead.member_name} ({lead.member_id})

*Matched Vendor:*
🏢 {vendor_name} ({vendor_id})
📍 {vendor_city}
🏭 {vendor_industry}
⭐ Tier: {vendor_tier}

*Match Score:* {match_score}/100

*AI Qualification Results:*
{format_vendor_qa}

*Compatibility Score:* {compatibility_score}/100 {emoji}

*AI Recommendation:*
{compatibility_score >= 70 ? "✅ APPROVE - Excellent match" :
 compatibility_score >= 50 ? "⚠️ REVIEW - Good fit, verify details" :
 "❌ CONSIDER DECLINE - Low compatibility"}

━━━━━━━━━━━━━━━━━━━━━━
*Actions (SLA: 2 hours):*

Reply:
CONNECT {leadId} {vendor_id}
DECLINE {leadId} {vendor_id} [reason]
```

**Admin approval handler (same as Flow 2A):**
```javascript
if (message.from === ADMIN_WHATSAPP) {
  const connectMatch = text.match(/^CONNECT\s+(LEAD-\w+-\d{4}-\d+)\s+(RIF-\w+-\d{4}-\d+)$/i);
  
  if (connectMatch) {
    await approveVendorMatch(leadId, vendorId);
  }
}
```

---

### STEP 12: SHARE CONTACTS (CONNECTION MADE)

**Same as Flow 2A, but with premium branding:**

**Message to Buyer:**
```
🎉 *PREMIUM MATCH CONFIRMED!*

📋 Lead ID: {leadId}

*Matched Vendor:*
🏢 *Business:* {vendor.business_name}
📍 *Location:* {vendor.city_state}
⭐ *Rating:* {vendor.rating}/5
📊 *Match Quality:* {match_score}/100
🎯 *Compatibility:* {compatibility_score}/100

*Vendor Capabilities:*
${formatVendorQA(vendor.ai_qualification)}

*Contact Information:*
📞 Phone: {vendor.whatsapp_number}
👤 Contact: {vendor.full_name}
📧 Email: {vendor.email || 'Not provided'}

💡 *Premium Support:*
Our team will follow up with you in 7 days to ensure successful connection.

For immediate assistance, contact your dedicated account manager.

Please reach out to them directly. Good luck! 🙏
```

**Message to Vendor:**
```
🎉 *Your interest has been approved!*

📋 Lead ID: {leadId} ⭐ PREMIUM

*Premium Buyer Details:*
🏢 *Business:* {buyer.business_name}
📍 *Location:* {buyer.city_state}
📝 *Requirement:* {lead.title}
💰 *Budget:* {lead.budget || 'Negotiable'}
⏰ *Timeline:* {lead.urgency}

*Detailed Requirements:*
${formatAISpecs(lead.ai_qualification)}

*Contact Information:*
📞 Phone: {buyer.whatsapp_number}
👤 Contact: {buyer.full_name}
📧 Email: {buyer.email || 'Not provided'}

Please contact them to finalize the deal.

We'll follow up in 7 days! 🙏
```

**Schedule 7-day follow-up:**
```javascript
const followupDate = new Date();
followupDate.setDate(followupDate.getDate() + 7);

await erpnext.update("RIFAH Lead", leadId, {
  connection_made: 1,
  status: "Connected",
  followup_scheduled: followupDate.toISOString()
});
```

---

### STEP 13: GROUP POSTING FALLBACK (If <3 matches OR user requests)

**When to trigger:**
- Matching algorithm returns <3 vendors with score ≥40
- User explicitly asks to post to groups
- All direct introductions declined/no response after 24 hours

**Select groups (same algorithm as Flow 2A):**
```javascript
const selectedGroups = await selectGroupsForLead(lead);
```

**Post to groups with PREMIUM marker:**

**Message Format:**
```
━━━━━━━━━━━━━━━━━━━━
⭐ *PREMIUM REQUEST* ⭐

Type: {emoji} {lead_type}
*Product/Service:* {formatted_title}

{formatted_ai_specs}

📍 *Location:* {location}
💰 *Budget:* {budget}
⏰ *Urgency:* {urgency}

Lead ID: {leadId}

*Premium features:*
✓ Verified buyer
✓ Fast response expected
✓ High-value opportunity

━━━━━━━━━━━━━━━━━━━━
💡 *Can you fulfill this requirement?*

Click here to respond:
https://wa.me/{bot_number}?text={leadId}

_(Opens chatbot with lead details)_
━━━━━━━━━━━━━━━━━━━━
```

**Note:** Groups posted for premium leads should be marked differently in ERPNext:
```javascript
posted_to_groups.push({
  group_id: group.group_id,
  group_name: group.group_name,
  posted_at: new Date().toISOString(),
  match_score: group.score,
  is_premium_request: true  // Marker for premium
});
```

**Vendor response to group post:** Same interactive chatbot flow as Flow 2A

---

## SESSION STATE REFERENCE

| current_step | Bot is waiting for |
|---|---|
| LEAD_TYPE | BUY/SELL/SERVICE NEED/SERVICE OFFER |
| LEAD_DESC | Description (min 10 words) |
| LEAD_LOC | Location/city |
| LEAD_URGENCY | URGENT/THIS WEEK/THIS MONTH/FLEXIBLE |
| LEAD_BUDGET | Budget or SKIP |
| AI_Q1 to AI_Q6 | Answers to AI qualification questions |
| LEAD_PROCESSING | (Matching algorithm running) |
| VENDOR_SELECTION | Vendor selection (1,2,3 or 1-5 or ALL) |
| VENDOR_CONFIRM | YES or CHANGE |
| VENDOR_RESPONSE | (Waiting for vendor to respond to introduction) |
| VENDOR_Q1 to VENDOR_Q6 | Vendor qualification answers |
| VENDOR_SCORE | SUBMIT or CANCEL |
| COMPLETED | Flow finished |

---

## N8N WORKFLOW ARCHITECTURE

### Inherited from Flow 1 & Flow 2A:
- Main webhook handlers
- Session management nodes
- Member verification nodes

### Flow 2B Specific Nodes:

#### Premium Detection & Routing
- `Check Member Tier - Premium` — Filter for PREMIUM members only
- `IF Tier is Premium` — Route to Flow 2B vs Flow 2A

#### Smart Matching Path
- `Create Premium Lead` — POST with tier="PREMIUM"
- `Notify User - Matching Started` — "Searching 1 lakh+ businesses..."
- `Get All Vendors` — Query all RIFAH Members
- `Run Matching Algorithm` — JavaScript code node (0-100 scoring)
- `Filter Top Matches` — Keep score >= 40, top 10
- `Format Vendor List` — Build numbered list for display
- `Send Vendor List to User` — WhatsApp message
- `Wait for Selection` — User picks vendors (1,2,3 or ALL)

#### Direct Introduction Path
- `Parse Vendor Selection` — Extract vendor numbers
- `For Each Selected Vendor` — Loop through selections
- `Build Introduction Message` — Personalized for each vendor
- `Send Direct Introduction` — WhatsApp to vendor
- `Update Introduction Status` — JSON array in lead record
- `Notify User - Sent` — Confirmation message

#### Vendor Response Handling
- `IF INTERESTED Response` — Vendor clicked "INTERESTED"
- `IF NOT NOW Response` — Vendor clicked "NOT NOW"
- `IF DETAILS Response` — Vendor clicked "DETAILS"
- `Show Complete Details` — Send full lead info
- `Start Vendor Qualification` — Same as Flow 2A
- `Calculate Compatibility` — 0-100 score
- `Store Vendor Interest` — Update lead record

#### Fallback to Groups
- `IF Few Matches (<3)` — Trigger group posting
- `Select Premium Groups` — Algorithm selects groups
- `Post with Premium Marker` — Add "⭐ PREMIUM REQUEST"
- `Update Lead - Posted` — Mark as posted with premium flag

#### Admin Approval (Premium Priority)
- `Notify Admin - Premium Match` — 2-hour SLA (vs 4-hour free)
- `IF CONNECT Command` — Admin approves
- `Share Premium Contacts` — Enhanced messages for premium
- `Schedule Premium Followup` — 7-day + premium support note

---

## CRITICAL FIXES

### All fixes from Flow 2A apply, plus:

#### Fix 1: Matching Algorithm Performance
```javascript
// Optimize for 100K+ records
// Use database query filters before JavaScript scoring

const potentialVendors = await erpnext.query("RIFAH Member", {
  status: ["in", ["Active Free", "Active Premium"]],
  rifah_id: ["!=", lead.member_id],
  city_state: ["like", `%${leadCity}%`]  // Pre-filter by city/state
});

// Then score only filtered set (10K instead of 100K)
```

#### Fix 2: Handle Zero Matches Gracefully
```javascript
if (matchedVendors.length === 0) {
  // No matches at all
  await whatsapp.send(userPhone, `
🔍 No direct matches found.

Don't worry! We're posting your requirement to 5-7 premium WhatsApp groups to reach a wider audience.

Expected reach: 5,000+ members

You'll be notified when vendors respond.
  `);
  
  // Trigger group posting immediately
  await triggerGroupPosting(leadId, true); // true = premium
}
```

#### Fix 3: 12-Hour Response Deadline
```javascript
// Set cron job or scheduled task
// Check every hour for expired introductions

async function checkExpiredIntroductions() {
  const now = new Date();
  
  const leads = await erpnext.query("RIFAH Lead", {
    status: "Introductions Sent - Awaiting Vendor Response"
  });
  
  for (const lead of leads) {
    const introductions = JSON.parse(lead.introduction_sent);
    
    for (const intro of introductions) {
      if (intro.status === "Awaiting Response") {
        const deadline = new Date(intro.response_deadline);
        
        if (now > deadline) {
          // Mark as expired
          intro.status = "No Response (Expired)";
          
          // Check if any other vendors responded
          const hasResponses = introductions.some(i => i.status === "Interested");
          
          if (!hasResponses) {
            // Trigger group posting fallback
            await triggerGroupPosting(lead.lead_id, true);
            
            // Notify user
            await whatsapp.send(lead.member_phone, `
⏰ Vendors have not responded to direct introductions within 12 hours.

We've automatically posted your requirement to premium WhatsApp groups for wider reach.

You'll be notified when vendors respond.
            `);
          }
        }
      }
    }
    
    await erpnext.update("RIFAH Lead", lead.lead_id, {
      introduction_sent: JSON.stringify(introductions)
    });
  }
}

// Run every hour
setInterval(checkExpiredIntroductions, 60 * 60 * 1000);
```

---

## OPENAI API USAGE (Same as Flow 2A)

- Lead qualification: 1 API call per lead
- Vendor qualification: 1 API call per interested vendor
- Same error handling, fallback questions, retry logic
- See Flow 2A prompt for complete implementation

---

## ENVIRONMENT VARIABLES

**Same as Flow 2A, no additional variables needed.**

---

## INTEGRATION WITH FLOW 1 & FLOW 2A

**Shared Resources:**
- All ERPNext doctypes (RIFAH Member, Session, Lead, Group)
- Main webhook handler
- Session management
- OpenAI integration
- Vendor qualification flow
- Admin approval workflow
- Contact sharing logic

**Flow Detection:**
```javascript
// In main webhook after user selects "2"
const member = await getMember(phone);

if (member.membership_tier === "FREE") {
  return startFlow2A(phone, member);
} else if (member.membership_tier === "PREMIUM") {
  return startFlow2B(phone, member);
}
```

---

## COST MONITORING & OPTIMIZATION

### Expected Costs (Flow 2B Only - Premium Users)

| Scenario | Premium Users | Leads/Month | OpenAI Calls | Cost/Month |
|----------|---------------|-------------|--------------|------------|
| Launch | 100 | 300 | 600 | ₹15 |
| Growing | 500 | 1,500 | 3,000 | ₹75 |
| Mature | 2,000 | 6,000 | 12,000 | ₹300 |
| Peak | 5,000 | 15,000 | 30,000 | ₹750 |

**Note:** Premium users likely post more leads than free users (higher engagement)

### Matching Algorithm Optimization

**Database Queries:**
- Pre-filter by city/state before scoring (reduces load)
- Index on city_state, industry, status fields
- Cache industry detection results

**Score Calculation:**
- Only calculate for filtered set
- Skip vendors with obvious mismatches early
- Limit to top 20 before final filtering to 10

---

## TEST SCENARIOS

### Test Suite Overview

**Total Test Cases:** 18  
**Coverage:** End-to-end premium flow, matching algorithm, fallback scenarios  
**Execution Time:** ~40 minutes (manual) or ~7 minutes (automated)

---

### TEST 1: Complete Premium Happy Path (Direct Match)

**Objective:** Verify complete flow from lead creation to vendor selection and connection

**Prerequisites:**
- User registered as PREMIUM member (RIF-PREM-2024-0001)
- 100+ vendors in database with varied industries/locations
- At least 10 vendors match the test requirement
- OpenAI API key valid

**Test Steps:**

```
Step 1-7: Lead Creation (SAME AS FLOW 2A)
  Input sequence:
  Hi → 2 → BUY → Need 5000 plastic bottles... → Pune → THIS WEEK → ₹50,000-1,00,000
  Then AI questions (6 answers)
  
Step 8: Instant processing
  Expected: "⭐ PREMIUM LEAD POSTING"
  Expected: "✅ Lead created! Lead ID: LEAD-PREM-2024-XXXX"
  Expected: "⚡ Processing instantly..."
  Expected: "🔍 Searching 1 lakh+ businesses..."
  
Step 9: Matching algorithm runs (5-10 seconds)
  Expected: System scores all vendors
  Expected: Returns top 10 with scores >= 40
  
Step 10: Vendor list displayed
  Expected: "✅ Found 8 matching vendors!"
  Expected: List of 8 vendors with:
    - Business name
    - Location
    - Rating
    - Match score
    - Key details
  Expected: "Select vendors to contact: Reply with numbers"
  
Step 11: User selects vendors
  Input: 1,2,3
  Expected: "✅ Selected 3 vendors"
  Expected: Lists selected vendor names
  Expected: "Proceed? Reply YES or CHANGE"
  
Step 12: User confirms
  Input: YES
  Expected: "✅ Introductions sent!"
  Expected: Lists vendors contacted
  Expected: "Vendors have 12 hours to respond"
```

**Verify in ERPNext:**
```sql
SELECT * FROM `tabRIFAH Lead` WHERE lead_id = 'LEAD-PREM-2024-XXXX';

Expected:
- tier: "PREMIUM"
- status: "Introductions Sent - Awaiting Vendor Response"
- matched_vendors: JSON array with 8-10 vendors and scores
- introduction_sent: JSON array with 3 selected vendors
- posted_to_groups: "[]" (not posted to groups)
```

**Verify Vendor Messages:**
- 3 vendors should receive WhatsApp introduction
- Messages contain "⭐ PREMIUM LEAD MATCH"
- Messages show match score and reasons
- Contains INTERESTED/NOT NOW/DETAILS buttons

---

### TEST 2: Vendor Responds INTERESTED

**Prerequisites:** Test 1 completed

**Test Steps:**

```
Step 1: Vendor clicks INTERESTED
  From: Vendor 1 phone (matched in Test 1)
  Input: INTERESTED
  
Step 2-8: Vendor qualification (SAME AS FLOW 2A)
  Bot asks 6 validation questions
  Vendor answers all
  Compatibility score calculated: 92/100
  
Step 9: Vendor submits interest
  Input: SUBMIT
  Expected: "✅ Interest submitted!"
  Expected: "Our admin will review within 2 hours" (note: 2hrs for premium, not 4)
  
Step 10: Admin receives notification
  Expected: "🤝 PREMIUM VENDOR MATCH FOR APPROVAL"
  Expected: Contains "⭐ PREMIUM" marker
  Expected: 2-hour SLA mentioned
  Expected: Match score + compatibility score
  
Step 11: Admin approves
  Input (from admin): CONNECT LEAD-PREM-2024-0001 RIF-PREM-2024-0050
  Expected: "✅ Connection approved"
  
Step 12: Contacts shared
  Expected: Buyer receives "🎉 PREMIUM MATCH CONFIRMED!"
  Expected: Vendor receives approval message
  Expected: Both receive complete contact details
  Expected: "We'll follow up in 7 days"
```

**Verify in ERPNext:**
```sql
SELECT interested_vendors, connection_made, followup_scheduled 
FROM `tabRIFAH Lead` WHERE lead_id = 'LEAD-PREM-2024-0001';

Expected:
- interested_vendors: Has vendor with compatibility_score: 92, status: "Approved - Connected"
- connection_made: 1
- status: "Connected"
- followup_scheduled: 7 days from now
```

---

### TEST 3: Vendor Responds NOT NOW

**Prerequisites:** Test 1 completed

**Test Steps:**

```
Step 1: Vendor 2 declines
  Input: NOT NOW
  Expected: "Thank you for your response"
  Expected: "We've noted that you're not available"
```

**Verify:**
```sql
SELECT introduction_sent FROM `tabRIFAH Lead` WHERE lead_id = 'LEAD-PREM-2024-0001';

Expected JSON:
[
  { vendor_id: "...", status: "Interested", ... },  // Vendor 1
  { vendor_id: "...", status: "Declined", responded_at: "..." },  // Vendor 2
  { vendor_id: "...", status: "Awaiting Response", ... }  // Vendor 3
]
```

---

### TEST 4: Vendor Requests DETAILS

**Test Steps:**

```
Step 1: Vendor clicks DETAILS
  Input: DETAILS
  Expected: "📋 Complete Lead Details"
  Expected: Shows buyer info, full requirement, AI specs, match analysis
  Expected: "Reply: INTERESTED or NOT NOW"
  
Step 2: After viewing, vendor proceeds
  Input: INTERESTED
  Expected: Starts qualification flow
```

---

### TEST 5: Matching Algorithm - Few Matches (<3)

**Objective:** Verify fallback to group posting when insufficient direct matches

**Test Setup:**
- Create lead with very specific niche requirement
- Ensure <3 vendors match with score >= 40

**Test Steps:**

```
Step 1-7: Create niche lead
  Type: BUY
  Description: Need specialized aerospace-grade titanium CNC machining services
  Location: Remote (All India)
  
Step 8: Matching runs
  Expected: Finds 0-2 vendors only
  
Step 9: Fallback triggered
  Expected: "🔍 Search Complete"
  Expected: "We searched 1,00,000+ businesses but found only 2 direct matches"
  Expected: "⭐ PREMIUM FALLBACK ACTIVATED"
  Expected: "We'll also post to relevant WhatsApp groups"
  Expected: "Expected reach: 5,000+ members"
```

**Verify:**
```sql
Expected in ERPNext:
- matched_vendors: 0-2 entries
- status: "Posted to Groups" (fallback triggered)
- posted_to_groups: Has entries with is_premium_request: true
```

**Verify Group Messages:**
- Messages contain "⭐ PREMIUM REQUEST ⭐"
- Different styling from regular free user posts

---

### TEST 6: Matching Algorithm - Zero Matches

**Objective:** Handle case where no vendors match at all

**Test Steps:**

```
Step 1: Create very niche lead
  Description: Need quantum computing hardware supplier in Antarctica
  
Step 2: Matching runs
  Expected: Zero matches (score < 40 for all)
  
Step 3: Immediate group posting
  Expected: "🔍 No direct matches found"
  Expected: "Don't worry! We're posting to premium groups"
  Expected: Groups posted immediately
```

---

### TEST 7: User Selects ALL Vendors

**Test Steps:**

```
Step 1-10: Same as Test 1, get 8 vendor matches

Step 11: User selects all
  Input: ALL
  Expected: "✅ Selected 8 vendors"
  Expected: Lists all 8 vendor names
  
Step 12: Confirm
  Input: YES
  Expected: 8 introduction messages sent
```

**Verify:** introduction_sent has 8 entries

---

### TEST 8: User Selects Range (1-5)

**Test Steps:**

```
Step 11: User selects range
  Input: 1-5
  Expected: "✅ Selected 5 vendors"
  Expected: Lists vendors 1 through 5
```

**Verify:** introduction_sent has 5 entries (vendors 1-5 from list)

---

### TEST 9: Invalid Vendor Selection

**Test Steps:**

```
Step 11a: Invalid format
  Input: ABC
  Expected: "⚠️ Invalid selection"
  Expected: "Please reply with numbers (e.g., 1,2,3 or 1-5 or ALL)"
  
Step 11b: Out of range
  Input: 15,20  (only 8 vendors available)
  Expected: "⚠️ Please select from 1 to 8"
  
Step 11c: Empty selection
  Input: ""
  Expected: Stays at VENDOR_SELECTION step, asks again
```

---

### TEST 10: Change Selection Before Confirming

**Test Steps:**

```
Step 11: First selection
  Input: 1,2
  Expected: "✅ Selected 2 vendors... Proceed? YES or CHANGE"
  
Step 12: User changes mind
  Input: CHANGE
  Expected: "Please select again"
  Expected: Shows vendor list again
  
Step 13: New selection
  Input: 3,4,5
  Expected: "✅ Selected 3 vendors"
```

---

### TEST 11: 12-Hour Response Deadline Expiry

**Objective:** Verify automatic fallback after vendor timeout

**Test Setup:**
- Send introductions to 3 vendors
- Wait 12+ hours (or mock time)
- None of the vendors respond

**Test Steps:**

```
Step 1-12: Test 1 flow (introductions sent)

Step 13: Wait 12 hours (mock system time +12hrs)

Step 14: Cron job runs
  Expected: System detects expired introductions
  Expected: Status updated to "No Response (Expired)"
  Expected: Group posting triggered automatically
  
Step 15: User notification
  Expected: "⏰ Vendors have not responded within 12 hours"
  Expected: "We've automatically posted to premium groups"
```

**Verify:**
```sql
Expected:
- introduction_sent: All vendors status "No Response (Expired)"
- posted_to_groups: Now has entries (fallback triggered)
- status: "Posted to Groups - No Direct Response"
```

---

### TEST 12: Multiple Vendors Respond

**Test Steps:**

```
Step 1: Vendor 1 responds INTERESTED → qualifies → score 92
Step 2: Vendor 2 responds INTERESTED → qualifies → score 85
Step 3: Vendor 3 responds INTERESTED → qualifies → score 78

Step 4: Admin sees 3 notifications

Step 5: Admin approves highest scoring vendor
  Input: CONNECT LEAD-PREM-2024-0001 RIF-PREM-2024-0050
  
Step 6: Only Vendor 1 gets connection
```

**Verify:**
```sql
interested_vendors JSON:
[
  { vendor_id: "0050", score: 92, status: "Approved - Connected" },
  { vendor_id: "0051", score: 85, status: "Pending Admin Approval" },
  { vendor_id: "0052", score: 78, status: "Pending Admin Approval" }
]
```

---

### TEST 13: Matching Algorithm Scoring Accuracy

**Objective:** Verify algorithm scores correctly

**Test Data:**
```
Lead:
- Type: BUY
- Description: Plastic bottles for juice business
- Location: Pune, Maharashtra
- Industry: Packaging (detected)

Vendor A:
- City: Pune (+30)
- Industry: Packaging (+20)
- Past deals: 20 (+25, capped at 25)
- Rating: 4.8 (+10)
- Experience: 15 years (+10)
- Response rate: 0.9 (+10)
- Tier: PREMIUM (+5)
Expected Score: 110, but capped or highest priority

Vendor B:
- City: Mumbai (0)
- Industry: Packaging (+20)
- Past deals: 10 (+25, capped)
- Rating: 4.2 (0)
- Experience: 5 years (+5)
- Response rate: 0.75 (0)
- Tier: FREE (0)
Expected Score: 50

Vendor C:
- City: Pune (+30)
- Industry: Textile (0, not related)
- Past deals: 2 (+10)
- Rating: 3.5 (0)
- Experience: 3 years (+3)
- Response rate: 0.6 (0)
- Tier: FREE (0)
Expected Score: 43
```

**Execute matching:**
```javascript
const matches = await matchVendorsForLead(testLead);
```

**Verify:**
- Vendor A: score 110 (or highest, around 90-110)
- Vendor B: score ~50
- Vendor C: score ~43

**Expected in results:**
- Vendor A: rank #1
- Vendor B: rank #2 (or not in top 10 if many better matches)
- Vendor C: included if >= 40, excluded if < 40

---

### TEST 14: Different Lead Types (Premium)

**Test 14a: SELL Lead (Premium)**
```
Input: SELL
Description: Selling 10,000 cotton T-shirts, wholesale, Tirupur
Location: Tamil Nadu, Karnataka

Verify:
- Matching finds textile/garment vendors
- AI asks about: specifications, pricing, MOQ, quality
```

**Test 14b: SERVICE NEED (Premium)**
```
Input: SERVICE NEED
Description: Need ERP implementation for manufacturing company, 50 users
Location: All India (remote OK)

Verify:
- Matching finds IT service vendors
- AI asks about: platform, timeline, support, pricing model
```

**Test 14c: SERVICE OFFER (Premium)**
```
Input: SERVICE OFFER
Description: Digital marketing agency - SEO, social media, paid ads
Location: Pan India

Verify:
- Matching finds businesses needing digital marketing
- AI asks about: packages, case studies, industries served
```

---

### TEST 15: Mixed Scenario (Direct + Groups)

**Test Steps:**

```
Step 1: Create lead that gets 2 direct matches
Step 2: Matching returns 2 vendors (score >= 40)
Step 3: System shows 2 vendors + triggers group posting
Step 4: User proceeds with both:
  - 2 direct introductions sent
  - Posted to 5-7 premium groups
Step 5: Vendor from group responds INTERESTED
Step 6: Direct vendor also responds INTERESTED
Step 7: Admin approves one connection
```

**Verify:** Lead has both introduction_sent and posted_to_groups populated

---

### TEST 16: Premium User Without Enough Credits

**Objective:** Handle edge case if premium expired or payment issue

**Test Steps:**

```
Step 1: Premium member (but payment expired in background)
Step 2: Creates lead
Step 3: System checks membership_tier: PREMIUM but status: "Payment Pending"

Expected: 
- Downgrade to free tier flow OR
- Block lead creation with payment reminder
```

**Implementation:**
```javascript
if (member.membership_tier === "PREMIUM" && member.status !== "Active Premium") {
  return `⚠️ Your premium membership needs renewal.
  
Please update your payment to continue using premium features.

Renew now: [payment link]
Or contact support: [support number]`;
}
```

---

### TEST 17: Concurrent Premium Leads

**Objective:** Test system handles multiple premium users posting simultaneously

**Test Setup:**
- 10 premium users
- All create leads at same time

**Metrics:**
- All 10 leads created with unique IDs
- Matching algorithm runs for each
- No duplicate vendor selections
- No ERPNext conflicts
- Response time < 15 seconds per lead

---

### TEST 18: End-to-End Premium Performance

**Test Setup:**
- 20 concurrent premium leads
- 10 vendors responding to various leads
- 5 admin approvals happening
- Group posting for 5 leads

**Success Criteria:**
- Lead creation: < 10 seconds (including AI + matching)
- Vendor introduction: < 5 seconds
- Vendor qualification: < 45 seconds
- Admin approval processing: < 3 seconds
- No timeouts or errors
- No duplicate connections
- Proper session management for all users

---

## AUTOMATED TEST SCRIPT

**File:** `test_suite/test_flow2b.js`

```javascript
const assert = require('assert');
const { createPremiumLead, matchVendors, selectVendors } = require('./helpers');

describe('Flow 2B: Share Lead - Premium User', function() {
  this.timeout(90000); // 90 second timeout for matching
  
  describe('Direct Matching', () => {
    it('should find top 10 vendors with smart algorithm', async () => {
      const result = await createPremiumLead({
        phone: '919876543210',
        type: 'BUY',
        description: 'Need plastic bottles 500ml',
        location: 'Pune'
      });
      
      assert.strictEqual(result.status, 'Matched - Awaiting User Selection');
      assert.ok(result.matched_vendors.length >= 3);
      assert.ok(result.matched_vendors.length <= 10);
      assert.ok(result.matched_vendors[0].score >= 40);
    });
    
    it('should score vendors correctly', async () => {
      const scores = await matchVendors({
        location: 'Pune',
        industry: 'Packaging',
        type: 'BUY'
      });
      
      // Check highest score vendor has expected attributes
      const topVendor = scores[0];
      assert.ok(topVendor.match_details.city_match === true);
      assert.ok(topVendor.score >= 70);
    });
  });
  
  describe('Vendor Selection', () => {
    it('should handle range selection (1-5)', async () => {
      const selected = parseVendorSelection('1-5', 10);
      assert.deepStrictEqual(selected, [1,2,3,4,5]);
    });
    
    it('should handle ALL selection', async () => {
      const selected = parseVendorSelection('ALL', 8);
      assert.strictEqual(selected.length, 8);
    });
  });
  
  describe('Fallback Scenarios', () => {
    it('should fallback to groups when <3 matches', async () => {
      const result = await createPremiumLead({
        description: 'Very niche aerospace requirement'
      });
      
      if (result.matched_vendors.length < 3) {
        assert.ok(result.posted_to_groups.length > 0);
        assert.ok(result.posted_to_groups[0].is_premium_request === true);
      }
    });
  });
});
```

---

## TEST DATA SETUP

**Script:** `scripts/setup_premium_test_data.js`

```javascript
// Create 100 test vendors with varied profiles
const vendors = [];

for (let i = 1; i <= 100; i++) {
  vendors.push({
    rifah_id: `RIF-FREE-2024-${String(i).padStart(4, '0')}`,
    business_name: `Test Vendor ${i}`,
    phone: `9191111${String(i).padStart(4, '0')}`,
    city_state: getCityState(i),  // Distributed across cities
    industry: getIndustry(i),      // Distributed across industries
    years_operating: Math.floor(Math.random() * 20),
    rating: 3 + Math.random() * 2,  // 3.0 to 5.0
    successful_deals: Math.floor(Math.random() * 50),
    response_rate: Math.random(),
    membership_tier: i % 5 === 0 ? "PREMIUM" : "FREE"  // 20% premium
  });
}

function getCityState(index) {
  const cities = [
    "Pune, Maharashtra",
    "Mumbai, Maharashtra", 
    "Bangalore, Karnataka",
    "Delhi, Delhi",
    "Chennai, Tamil Nadu"
  ];
  return cities[index % cities.length];
}

function getIndustry(index) {
  const industries = [
    "Packaging", "Manufacturing", "Food", "Textile", 
    "IT", "Construction", "Retail", "Trading"
  ];
  return industries[index % industries.length];
}
```

---

## TESTING CHECKLIST

**Before Testing:**
- [ ] All Flow 2A tests passing
- [ ] At least 100 test vendors in database
- [ ] Premium test members registered
- [ ] OpenAI API funded
- [ ] Matching algorithm code deployed
- [ ] Admin WhatsApp configured

**Core Functionality:**
- [ ] Test 1: Happy path with direct matching
- [ ] Test 2: Vendor INTERESTED response
- [ ] Test 3: Vendor NOT NOW response
- [ ] Test 4: Vendor DETAILS request
- [ ] Test 7: User selects ALL vendors
- [ ] Test 8: User selects range (1-5)

**Fallback Scenarios:**
- [ ] Test 5: Few matches (<3) fallback
- [ ] Test 6: Zero matches fallback
- [ ] Test 11: 12-hour timeout fallback
- [ ] Test 15: Mixed direct + groups

**Edge Cases:**
- [ ] Test 9: Invalid vendor selection
- [ ] Test 10: Change selection
- [ ] Test 12: Multiple vendors respond
- [ ] Test 16: Expired premium membership

**Algorithm Testing:**
- [ ] Test 13: Scoring accuracy
- [ ] Test 14: All lead types

**Performance:**
- [ ] Test 17: Concurrent premium leads
- [ ] Test 18: End-to-end load test

**After Testing:**
- [ ] Test data cleaned up
- [ ] Performance metrics documented
- [ ] Bugs logged
- [ ] Premium vs Free comparison analysis

---

## DELIVERABLES CHECKLIST

- [ ] `n8n/rifah_flow2b_workflow.json` — importable workflow (extends Flow 2A)
- [ ] `scripts/matching_algorithm.js` — standalone algorithm for testing
- [ ] `scripts/create_vendor_testdata.js` — generate 100+ test vendors
- [ ] `test_suite/test_flow2b.js` — automated test suite
- [ ] `test_suite/test_matching_algorithm.js` — algorithm unit tests
- [ ] Updated `.env` — no new variables needed
- [ ] `documents/flow2b_setup_guide.md` — setup instructions
- [ ] `documents/flow2b_architecture.md` — technical design
- [ ] `documents/matching_algorithm_design.md` — algorithm documentation
- [ ] `documents/premium_vs_free_comparison.md` — feature comparison

---

## COST ANALYSIS

### Premium vs Free - AI Costs

| Metric | Free User (2A) | Premium User (2B) |
|--------|----------------|-------------------|
| AI calls per lead | 2 (buyer + 1 vendor avg) | 2 (buyer + 1 vendor avg) |
| Cost per lead | ₹0.05 | ₹0.05 |
| Expected volume | 80% of leads | 20% of leads |

**Matching algorithm:** Zero additional AI cost (pure JavaScript logic)

### Processing Time Comparison

| Step | Free (2A) | Premium (2B) |
|------|-----------|--------------|
| Admin review | 4 hours (manual) | 0 (instant) |
| Matching | Groups only | Algorithm (10s) + Groups fallback |
| Vendor response | Passive (group posts) | Active (direct intro) |
| Total time to connection | 6-48 hours | 2-12 hours |

---

END OF FLOW 2B MASTER PROMPT
