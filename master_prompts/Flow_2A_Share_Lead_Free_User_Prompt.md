# RIFAH Connect — Master Prompt: Flow 2A Share Lead (Free User)

## CONTEXT FOR CLAUDE CODE

You are building Flow 2A (Share Lead - Free User) for RIFAH Connect — a WhatsApp Business
automation platform for a chamber of commerce connecting 1 lakh+ businesses in India.

**Prerequisites:**
- Flow 1 (Registration/Update) is already in production
- RIFAH Member, RIFAH Session doctypes exist
- User must be registered FREE member (RIF-FREE-XXXX-YYYY)

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
| AI | OpenAI GPT-4o-mini | https://api.openai.com/v1/chat/completions |
| Tunnel | ngrok static domain | URL in .env as NGROK_URL |
| Storage | Local filesystem in Docker volume | rifah_uploads volume |
| OS | Intel Mac (Docker Desktop) | - |

**ERPNext internal site name:** `rifah.localhost`
**n8n webhook base path:** `/webhook/whatsapp-webhook`
**Admin WhatsApp number:** Stored in .env as ADMIN_WHATSAPP

---

## MEMBERSHIP TIERS (Reference)

| Tier | Price | Groups | Support | Response |
|------|-------|--------|---------|----------|
| FREE | ₹0/year | 2-3 WhatsApp groups | Manual | 24-48 hours |
| PREMIUM | ₹3,000/year | 5-10 WhatsApp groups | 24/7 bot | 2-4 hours |

**This flow is for FREE tier users only.**

---

## ERPNEXT CUSTOM DOCTYPES REQUIRED

### Doctype 1: RIFAH Lead
Stores all lead/requirement posts. Created when user shares a need.

| Label | Fieldname | Fieldtype | Required | Unique |
|-------|-----------|-----------|----------|--------|
| Lead ID | lead_id | Data | ✅ | ✅ |
| Member ID | member_id | Data | ✅ | |
| Member Name | member_name | Data | | |
| Member Phone | member_phone | Data | | |
| Membership Tier | tier | Select | ✅ | |
| Lead Type | lead_type | Select | ✅ | |
| Title | title | Data | ✅ | |
| Description | description | Text | ✅ | |
| Location | location | Data | | |
| Urgency | urgency | Select | | |
| Budget | budget | Data | | |
| AI Qualification (JSON) | ai_qualification | Long Text | | |
| Status | status | Select | ✅ | |
| Posted to Groups (JSON) | posted_to_groups | Long Text | | |
| Interested Vendors (JSON) | interested_vendors | Long Text | | |
| Connection Made | connection_made | Check | | |
| Followup Scheduled | followup_scheduled | Datetime | | |
| Created At | created_at | Datetime | | |
| Approved By | approved_by | Data | | |
| Approved At | approved_at | Datetime | | |

Lead Type options: `BUY`, `SELL`, `SERVICE NEED`, `SERVICE OFFER`

Urgency options: `URGENT`, `THIS WEEK`, `THIS MONTH`, `FLEXIBLE`

Status options:
`Pending Review`, `Approved - Ready for Posting`, `Posted to Groups`, 
`Has Interested Vendors`, `Connected`, `Follow-up Sent`, `Rejected`, `Closed`

Tier options: `FREE`, `PREMIUM`

Settings: Module = Core, Is Child Table = false

**Auto-naming:** Format `LEAD-{tier}-{YYYY}-{####}`
- Example: `LEAD-FREE-2024-0001`
- Set in Doctype → Settings → Auto Name: `LEAD-.{tier}.-{####}`

---

### Doctype 2: RIFAH WhatsApp Group (If doesn't exist)
Stores information about WhatsApp groups for lead posting.

| Label | Fieldname | Fieldtype | Required | Unique |
|-------|-----------|-----------|----------|--------|
| Group ID | group_id | Data | ✅ | ✅ |
| Group Name | group_name | Data | ✅ | |
| Group JID | group_jid | Data | ✅ | ✅ |
| City | city | Data | | |
| State | state | Data | | |
| Industry | industry | Data | | |
| Lead Types Allowed (JSON) | lead_types | Long Text | | |
| Active Members | active_members | Int | | |
| Is Active | is_active | Check | | |
| Created At | created_at | Datetime | | |

Settings: Module = Core, Is Child Table = false

**Auto-naming:** Format `GRP-{####}`

**Initial Groups:** Create 5-10 sample groups manually with different cities/industries

---

## COMPLETE CONVERSATION FLOW

### Entry Point
User (registered FREE member) sends "Hi" → Bot shows main menu → User selects "2️⃣ Share Lead"

**Prerequisite Check:**
```javascript
// Query ERPNext RIFAH Member
const member = await erpnext.query("RIFAH Member", {
  whatsapp_number: userPhone,
  membership_tier: "FREE"
});

if (!member || member.length === 0) {
  return "⚠️ Please register first. Reply with 1️⃣";
}

// Member exists - proceed
```

Session step: `LEAD_TYPE`

---

### STEP 1: CAPTURE BASIC DETAILS

#### Question 1: Type — session step: `LEAD_TYPE`
```
📋 *Share Your Requirement*

What type of requirement do you have?

1. 🛒 *BUY* - I need to purchase
2. 💰 *SELL* - I have products to sell
3. 🔧 *SERVICE NEED* - I need a service
4. 🛠️ *SERVICE OFFER* - I provide a service

_Reply: BUY, SELL, SERVICE NEED, or SERVICE OFFER_
```

**Validation:**
- Accept: "BUY", "SELL", "SERVICE NEED", "SERVICE OFFER" (case-insensitive)
- Also accept: "1", "2", "3", "4" (map to types)
- Reject others: "Please select a valid option (BUY, SELL, SERVICE NEED, or SERVICE OFFER)"

**Store in session:** `lead_type`
**Next step:** `LEAD_DESC`

---

#### Question 2: Description — session step: `LEAD_DESC`
```
✅ Got it! You selected: *{lead_type}*

📝 *Please describe what you need/offer:*
_(Minimum 10 words)_

*Example:*
_"Need 5000 plastic bottles, 500ml capacity, food-grade PET material for juice packaging business in Pune"_
```

**Validation:**
- Word count ≥ 10 words
- If <10 words: "⚠️ Please provide more details (minimum 10 words required)"

**Store in session:** `lead_description`
**Next step:** `LEAD_LOC`

---

#### Question 3: Location — session step: `LEAD_LOC`
```
✅ Got it!

📍 *Which city/cities are you looking for?*

*Examples:*
• Single city: "Pune"
• Multiple cities: "Pune, Mumbai, Nashik"
• State-wide: "Maharashtra"
• Pan-India: "All India"

_Please specify location:_
```

**Validation:**
- Any non-empty text accepted (minimum 2 characters)

**Store in session:** `lead_location`
**Next step:** `LEAD_URGENCY`

---

#### Question 4: Urgency — session step: `LEAD_URGENCY`
```
✅ Got it!

⏰ *How urgent is this requirement?*

1. 🔴 *URGENT* - Need immediately
2. 📅 *THIS WEEK* - Within 7 days
3. 📆 *THIS MONTH* - Within 30 days
4. 🕐 *FLEXIBLE* - No rush

_Reply: URGENT, THIS WEEK, THIS MONTH, or FLEXIBLE_
```

**Validation:**
- Accept: "URGENT", "THIS WEEK", "THIS MONTH", "FLEXIBLE" (case-insensitive)
- Also accept: "1", "2", "3", "4"
- Reject others: "Please select urgency level"

**Store in session:** `lead_urgency`
**Next step:** `LEAD_BUDGET`

---

#### Question 5: Budget (Optional) — session step: `LEAD_BUDGET`
```
✅ Got it!

💰 *What's your budget range?* _(Optional)_

*Examples:*
• "₹50,000 - ₹1,00,000"
• "₹5 lakh"
• "Negotiable"
• "Best price"

_Type SKIP to skip this question_
```

**Validation:**
- Accept any text OR "SKIP" (case-insensitive)
- If SKIP: set budget to null

**Store in session:** `lead_budget` (null if skipped)
**Next step:** `AI_QUALIFICATION`

---

### STEP 2: AI-POWERED QUALIFICATION

Session step: `AI_Q1` through `AI_Q6` (dynamic based on AI response)

**Process:**
1. Send lead description to OpenAI API
2. AI generates 3-6 follow-up questions specific to the product/service
3. Ask questions one by one
4. Store all Q&A pairs in session

**OpenAI API Call:**
```javascript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a B2B requirement qualification assistant for an Indian marketplace connecting 1 lakh+ businesses. Generate specific follow-up questions to understand buyer requirements better.'
      },
      {
        role: 'user',
        content: `User's requirement:
Type: ${lead_type}
Description: ${lead_description}
Location: ${lead_location}

Generate 3-6 specific follow-up questions to understand:
- Exact specifications (size, material, capacity, standards, etc.)
- Quantity requirements (per order, per month, minimum order quantity)
- Quality standards, certifications, or compliance needed
- Timeline, delivery schedule, or service duration
- Any special requirements, customization, or preferences

Make questions simple, specific, relevant to Indian B2B context, and answerable in 1-2 sentences.

Return ONLY a JSON object with this exact format:
{
  "questions": [
    "What capacity/size do you need? (e.g., 250ml, 500ml, 1L?)",
    "Which material or specification? (e.g., food-grade PET, HDPE?)",
    "What quantity per order or per month?",
    ...
  ]
}

Generate 3-6 questions maximum.`
      }
    ],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: 'json_object' }
  })
});

const data = await response.json();
const aiQuestions = JSON.parse(data.choices[0].message.content).questions;
```

**Message to user:**
```
🤖 *AI Assistant*

Great! I need a few more details to find you the best matches.

I'll ask {count} quick questions...

*Question 1 of {count}:*
{aiQuestions[0]}
```

**For each question:**
- Send question to user
- Wait for answer (any text ≥ 2 words)
- Store: `ai_question_1: "...", ai_answer_1: "..."`
- Move to next question: `AI_Q2`, `AI_Q3`, etc.

**After all questions:**
```
✅ *All details captured!*

Creating your lead...
```

**Next step:** `LEAD_CREATE`

---

### STEP 3: CREATE LEAD RECORD

Session step: `LEAD_CREATE`

**Generate Lead ID:**
```javascript
// Count existing FREE leads in 2024
const count = await erpnext.count("RIFAH Lead", {
  tier: "FREE",
  created_at: [">=", "2024-01-01"]
});

const leadId = `LEAD-FREE-2024-${String(count + 1).padStart(4, '0')}`;
// Example: LEAD-FREE-2024-0001
```

**Create RIFAH Lead in ERPNext:**
```javascript
const leadData = {
  lead_id: leadId,
  member_id: member.rifah_id,
  member_name: member.business_name,
  member_phone: member.whatsapp_number,
  tier: "FREE",
  lead_type: session_data.lead_type,
  title: session_data.lead_description.substring(0, 50) + "...",
  description: session_data.lead_description,
  location: session_data.lead_location,
  urgency: session_data.lead_urgency,
  budget: session_data.lead_budget,
  ai_qualification: JSON.stringify({
    question_1: session_data.ai_question_1,
    answer_1: session_data.ai_answer_1,
    question_2: session_data.ai_question_2,
    answer_2: session_data.ai_answer_2,
    // ... up to question_6
  }),
  status: "Pending Review",
  posted_to_groups: "[]",
  interested_vendors: "[]",
  connection_made: 0,
  created_at: new Date().toISOString()
};

await erpnext.create("RIFAH Lead", leadData);
```

**Message to user:**
```
✅ *Lead captured successfully!*

📋 Lead ID: *{leadId}*
📝 Type: {emoji} {lead_type}
📍 Location: {location}
⏰ Urgency: {urgency}
💰 Budget: {budget || 'Not specified'}

Our admin will review and post to relevant WhatsApp groups within *4 hours*.

You'll be notified once posted. Thank you! 🙏
```

**Update session:**
- current_step: `COMPLETED`
- status: `Completed`

**Next step:** Trigger admin notification

---

### STEP 4: ADMIN APPROVAL NOTIFICATION

**Send WhatsApp message to admin:**
```
🔔 *NEW LEAD FOR REVIEW*

📋 Lead ID: *{leadId}*
👤 User: {member_name} ({member_id})
📞 {member_phone}

*Type:* {emoji} {lead_type}

*Basic Info:*
• {description}
• Location: {location}
• Budget: {budget}
• Urgency: {urgency}

*AI Qualification Summary:*
{format_ai_qa_pairs}

*Recommended Groups:*
{run_group_selection_algorithm_preview}

━━━━━━━━━━━━━━━━━━━━
*Actions (SLA: 4 hours):*

Reply:
APPROVE {leadId}
REJECT {leadId} [reason]
MORE {leadId}
```

**Update Lead:**
```javascript
await erpnext.update("RIFAH Lead", leadId, {
  admin_notified_at: new Date(),
  admin_notification_status: "Sent"
});
```

**Format AI Q&A:**
```javascript
function formatAIQA(aiQualification) {
  const qa = JSON.parse(aiQualification);
  let formatted = "";
  
  for (let i = 1; i <= 6; i++) {
    if (qa[`question_${i}`] && qa[`answer_${i}`]) {
      formatted += `Q${i}: ${qa[`question_${i}`]}\nA${i}: ${qa[`answer_${i}`]}\n\n`;
    }
  }
  
  return formatted.trim();
}
```

---

### STEP 5: ADMIN APPROVAL HANDLING

**Admin replies in WhatsApp:**
- `APPROVE LEAD-FREE-2024-0001`
- `REJECT LEAD-FREE-2024-0001 Incomplete information`
- `MORE LEAD-FREE-2024-0001`

**n8n Webhook Handler:**
```javascript
// Detect admin command
if (message.from === process.env.ADMIN_WHATSAPP) {
  const text = message.text.trim();
  const match = text.match(/^(APPROVE|REJECT|MORE)\s+(LEAD-\w+-\d{4}-\d+)(\s+(.+))?$/i);
  
  if (match) {
    const action = match[1].toUpperCase();
    const leadId = match[2];
    const reason = match[4] || "";
    
    const lead = await erpnext.get("RIFAH Lead", leadId);
    if (!lead) {
      return await whatsapp.send(process.env.ADMIN_WHATSAPP, 
        `⚠️ Lead ${leadId} not found`);
    }
    
    if (action === "APPROVE") {
      await erpnext.update("RIFAH Lead", leadId, {
        status: "Approved - Ready for Posting",
        approved_by: process.env.ADMIN_WHATSAPP,
        approved_at: new Date()
      });
      
      await whatsapp.send(process.env.ADMIN_WHATSAPP, 
        `✅ Lead ${leadId} approved. Posting to groups...`);
      
      // Trigger group posting workflow
      await triggerGroupPosting(leadId);
    }
    else if (action === "REJECT") {
      await erpnext.update("RIFAH Lead", leadId, {
        status: "Rejected",
        approved_by: process.env.ADMIN_WHATSAPP,
        approved_at: new Date(),
        admin_notes: reason
      });
      
      await whatsapp.send(lead.member_phone, 
        `⚠️ Your lead (${leadId}) could not be processed.\n\nReason: ${reason}\n\nPlease share a new requirement with complete details.`);
      
      await whatsapp.send(process.env.ADMIN_WHATSAPP, 
        `✅ Lead ${leadId} rejected. User notified.`);
    }
    else if (action === "MORE") {
      // Admin needs more info - send question to user
      await whatsapp.send(lead.member_phone, 
        `📋 Regarding your lead (${leadId}):\n\nOur admin needs more information. Please provide additional details.`);
      
      await erpnext.update("RIFAH Lead", leadId, {
        status: "Awaiting User Response"
      });
    }
  }
}
```

---

### STEP 6: GROUP SELECTION ALGORITHM

**Function:** Select 3-5 best WhatsApp groups for posting

**Algorithm (runs after admin approval):**
```javascript
async function selectGroupsForLead(lead) {
  // Get all active groups
  const allGroups = await erpnext.query("RIFAH WhatsApp Group", {
    is_active: 1
  });
  
  const scores = allGroups.map(group => {
    let score = 0;
    
    // 1. City exact match: +40 points
    const leadCity = extractCity(lead.location);
    if (group.city && group.city.toLowerCase() === leadCity.toLowerCase()) {
      score += 40;
    }
    
    // 2. State match: +20 points
    const leadState = extractState(lead.location);
    if (group.state && group.state.toLowerCase() === leadState.toLowerCase()) {
      score += 20;
    }
    
    // 3. Industry match: +30 points
    const leadIndustry = detectIndustry(lead.description);
    if (group.industry && group.industry.toLowerCase() === leadIndustry.toLowerCase()) {
      score += 30;
    }
    
    // 4. Lead type allowed: +20 points
    const allowedTypes = JSON.parse(group.lead_types || "[]");
    if (allowedTypes.includes(lead.lead_type)) {
      score += 20;
    }
    
    // 5. Group activity (large groups): +10 points
    if (group.active_members > 50) {
      score += 10;
    }
    
    return {
      group_id: group.group_id,
      group_name: group.group_name,
      group_jid: group.group_jid,
      score: score
    };
  });
  
  // Return top 3-5 groups with score > 50
  return scores
    .filter(s => s.score > 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function extractCity(location) {
  // Simple: first word/phrase before comma
  return location.split(",")[0].trim();
}

function extractState(location) {
  // Look for common Indian states
  const states = ["Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu", "Delhi", "Uttar Pradesh"];
  for (const state of states) {
    if (location.includes(state)) return state;
  }
  return "";
}

function detectIndustry(description) {
  const keywords = {
    "Packaging": ["bottle", "container", "packaging", "box", "carton", "packing"],
    "Manufacturing": ["machine", "equipment", "manufacturing", "production", "factory"],
    "Food": ["food", "beverage", "juice", "snack", "ingredient", "catering"],
    "Textile": ["fabric", "cloth", "textile", "garment", "cotton", "yarn"],
    "IT": ["software", "website", "app", "development", "digital", "tech"],
    "Construction": ["construction", "building", "cement", "steel", "contractor"],
    "Retail": ["retail", "shop", "store", "outlet", "franchise"],
    "Trading": ["trading", "export", "import", "wholesale", "distributor"]
  };
  
  const desc = description.toLowerCase();
  for (const [industry, words] of Object.entries(keywords)) {
    if (words.some(word => desc.includes(word))) {
      return industry;
    }
  }
  
  return "General";
}
```

---

### STEP 7: POST TO GROUPS

**For each selected group:**

**Message Format:**
```
━━━━━━━━━━━━━━━━━━━━
🔔 *NEW REQUIREMENT*

*Type:* {emoji} {lead_type}
*Product/Service:* {formatted_title}

{formatted_ai_specs}

📍 *Location:* {location}
💰 *Budget:* {budget}
⏰ *Urgency:* {urgency}

Lead ID: {leadId}
━━━━━━━━━━━━━━━━━━━━

💡 *Can you fulfill this requirement?*
Click here to respond:
https://wa.me/{bot_number}?text={leadId}

_(Opens chatbot with lead details)_
━━━━━━━━━━━━━━━━━━━━
```

**Formatting Functions:**
```javascript
function formatLeadForGroup(lead) {
  const emoji = {
    "BUY": "🛒",
    "SELL": "💰",
    "SERVICE NEED": "🔧",
    "SERVICE OFFER": "🛠️"
  }[lead.lead_type];
  
  // Extract title (first line or first 50 chars)
  const title = lead.title || lead.description.substring(0, 50) + "...";
  
  // Format AI specs
  const specs = formatKeySpecs(lead.ai_qualification);
  
  return `${emoji} ${lead.lead_type}
*Product/Service:* ${title}

${specs}

📍 *Location:* ${lead.location}
💰 *Budget:* ${lead.budget || 'Not specified'}
⏰ *Urgency:* ${lead.urgency}`;
}

function formatKeySpecs(aiQualification) {
  const qa = JSON.parse(aiQualification);
  const specs = [];
  
  for (let i = 1; i <= 6; i++) {
    if (qa[`question_${i}`] && qa[`answer_${i}`]) {
      // Extract question stem (before "?")
      const questionStem = qa[`question_${i}`].split("?")[0];
      specs.push(`• ${questionStem}: ${qa[`answer_${i}`]}`);
    }
  }
  
  // Return top 4 specs only (to keep message compact)
  return specs.slice(0, 4).join("\n");
}
```

**Send to Each Group (Meta Cloud API):**
```javascript
for (const group of selectedGroups) {
  const message = formatLeadForGroup(lead);
  
  // Note: Group messaging requires Business API with group permissions
  // For demo, log the message
  console.log(`Posting to group ${group.group_name}:`, message);
  
  // In production:
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.META_PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "group",  // Requires special permissions
      to: group.group_jid,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  // Update lead record - add this group to posted_to_groups
  const posted = JSON.parse(lead.posted_to_groups || "[]");
  posted.push({
    group_id: group.group_id,
    group_name: group.group_name,
    posted_at: new Date().toISOString(),
    match_score: group.score
  });
  
  await erpnext.update("RIFAH Lead", lead.lead_id, {
    posted_to_groups: JSON.stringify(posted)
  });
}

// After all groups posted
await erpnext.update("RIFAH Lead", lead.lead_id, {
  status: "Posted to Groups"
});
```

**Notify User:**
```
✅ *Your requirement has been posted!*

📋 Lead ID: {leadId}

Posted to {count} relevant WhatsApp groups:
{group_names}

💡 Interested vendors will contact you through our chatbot.

Expected reach: {estimated_members}+ members

Thank you for using RIFAH Connect! 🙏
```

---

### STEP 8: VENDOR CLICKS LINK (INTERACTIVE RESPONSE)

**Vendor in WhatsApp group clicks:**
`https://wa.me/{bot_number}?text=LEAD-FREE-2024-0001`

**Bot receives message:**
```javascript
{
  from: "919876543210",  // Vendor phone
  text: "LEAD-FREE-2024-0001"
}
```

**Webhook Handler Detection:**
```javascript
// Detect lead response pattern
const leadPattern = /^LEAD-(FREE|PREM)-\d{4}-\d+$/;

if (leadPattern.test(message.text.trim())) {
  const leadId = message.text.trim();
  const vendorPhone = message.from;
  
  // Get lead
  const lead = await erpnext.get("RIFAH Lead", leadId);
  if (!lead) {
    return await whatsapp.send(vendorPhone, "⚠️ Invalid lead ID. Please check and try again.");
  }
  
  // Check if vendor is registered
  const vendor = await erpnext.query("RIFAH Member", {
    whatsapp_number: vendorPhone
  });
  
  if (!vendor || vendor.length === 0) {
    // Not registered
    return await whatsapp.send(vendorPhone, 
`⚠️ *Registration Required*

You need to register first to respond to leads.

Lead: ${lead.title}

Would you like to register now?

Reply *YES* to register or *LATER* to skip.`);
  }
  
  // Vendor is registered - start qualification
  await startVendorQualification(vendorPhone, leadId, vendor[0]);
}
```

---

### STEP 9: AI VENDOR QUALIFICATION

**Create vendor qualification session:**
```javascript
async function startVendorQualification(vendorPhone, leadId, vendor) {
  const lead = await erpnext.get("RIFAH Lead", leadId);
  
  // Create session
  const session = await erpnext.create("RIFAH Session", {
    phone_number: vendorPhone,
    current_step: "VENDOR_INTRO",
    status: "Active",
    last_activity: new Date(),
    session_data: JSON.stringify({
      flow: "vendor_qualification",
      lead_id: leadId,
      vendor_id: vendor.rifah_id
    })
  });
  
  // Send intro message
  await whatsapp.send(vendorPhone, 
`👋 *Welcome!*

You're interested in:

📋 Lead: ${lead.title}
📝 Type: ${lead.lead_type}
📍 Location: ${lead.location}

✅ *Verified:* ${vendor.business_name}
🪪 Member ID: ${vendor.rifah_id}

Let's check if you can fulfill this requirement.
I'll ask a few quick questions to match you better.

Ready? Reply *YES* to continue.`);
}
```

**After vendor replies YES:**

Session step: `VENDOR_Q1`

**Generate AI Qualification Questions:**
```javascript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are validating if a vendor can fulfill a B2B requirement in India. Generate exactly 6 validation questions.'
      },
      {
        role: 'user',
        content: `Lead Details:
Type: ${lead.lead_type}
Description: ${lead.description}
AI Qualification: ${lead.ai_qualification}
Location: ${lead.location}
Budget: ${lead.budget}
Urgency: ${lead.urgency}

Generate exactly 6 validation questions to check vendor capability:
1. Can supply/provide the product/service (YES/NO)
2. Has required certification/compliance (YES/NO)
3. Delivery timeline or service duration (text answer)
4. Price per unit or total cost (text answer)
5. Can provide additional services/features mentioned (YES/NO)
6. Past experience with similar clients (YES/NO + optional details)

Return ONLY a JSON object:
{
  "questions": [
    {"q": "Can you supply 500ml food-grade PET bottles?", "type": "yes_no"},
    {"q": "Do you have FSSAI certification?", "type": "yes_no"},
    {"q": "What's your delivery timeline for 5000 bottles?", "type": "text"},
    {"q": "What's your price per bottle (approximate)?", "type": "text"},
    {"q": "Can you provide custom label printing?", "type": "yes_no"},
    {"q": "Have you supplied to food/beverage companies before?", "type": "yes_no"}
  ]
}

Make questions specific to the requirement. Use Indian context (₹ prices, Indian certifications).`
      }
    ],
    temperature: 0.7,
    max_tokens: 600,
    response_format: { type: 'json_object' }
  })
});

const data = await response.json();
const vendorQuestions = JSON.parse(data.choices[0].message.content).questions;

// Store in session
session_data.vendor_questions = vendorQuestions;
```

**Ask Each Question:**
```
🤖 *Vendor Qualification*

I'll ask 6 quick questions to validate your capability.

*Question 1 of 6:*
{question_1.q}

{question_1.type === 'yes_no' ? '_Reply: YES or NO_' : '_Please specify:_'}
```

**Process Each Answer:**
- Store: `vendor_answer_1`, `vendor_answer_2`, ..., `vendor_answer_6`
- Move to next question: `VENDOR_Q2`, `VENDOR_Q3`, etc.
- Validate YES/NO for yes_no type questions

---

### STEP 10: COMPATIBILITY SCORING

**After all 6 questions answered:**

Session step: `VENDOR_SCORE`

**Calculate Score (0-100):**
```javascript
function calculateCompatibility(lead, vendorAnswers, vendorQuestions) {
  let score = 0;
  
  // Q1: Can supply product/service (YES/NO) - 25 points
  if (vendorAnswers.q1.toUpperCase() === "YES") {
    score += 25;
  }
  
  // Q2: Has certification (YES/NO) - 20 points
  if (vendorAnswers.q2.toUpperCase() === "YES") {
    score += 20;
  }
  
  // Q3: Timeline match (text) - 20 points
  const timeline = extractDays(vendorAnswers.q3);
  const urgencyDays = {
    "URGENT": 3,
    "THIS WEEK": 7,
    "THIS MONTH": 30,
    "FLEXIBLE": 60
  }[lead.urgency];
  
  if (timeline > 0 && timeline <= urgencyDays) {
    score += 20;
  }
  
  // Q4: Price within budget (text) - 10 points
  const vendorPrice = extractPrice(vendorAnswers.q4);
  const budgetMax = extractBudgetMax(lead.budget);
  
  if (vendorPrice && budgetMax && vendorPrice <= budgetMax) {
    score += 10;
  }
  
  // Q5: Additional service (YES/NO) - 15 points
  if (vendorAnswers.q5.toUpperCase() === "YES") {
    score += 15;
  }
  
  // Q6: Past experience (YES/NO) - 10 points
  if (vendorAnswers.q6.toUpperCase() === "YES") {
    score += 10;
  }
  
  return score;
}

function extractDays(timelineText) {
  // Extract number from "7 days", "2 weeks", "1 month", etc.
  const text = timelineText.toLowerCase();
  
  if (text.includes("immediate")) return 1;
  
  const dayMatch = text.match(/(\d+)\s*days?/);
  if (dayMatch) return parseInt(dayMatch[1]);
  
  const weekMatch = text.match(/(\d+)\s*weeks?/);
  if (weekMatch) return parseInt(weekMatch[1]) * 7;
  
  const monthMatch = text.match(/(\d+)\s*months?/);
  if (monthMatch) return parseInt(monthMatch[1]) * 30;
  
  return 0;
}

function extractPrice(priceText) {
  // Extract number from "₹9/bottle", "₹50,000", "Rs. 10 per piece", etc.
  const cleaned = priceText.replace(/[₹Rs.,]/g, '').trim();
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function extractBudgetMax(budgetText) {
  if (!budgetText || budgetText.toLowerCase().includes("negotiable")) {
    return null;
  }
  
  // Extract max from "₹50,000 - ₹1,00,000" or "₹5 lakh"
  const numbers = budgetText.match(/(\d+(?:,\d+)*)/g);
  if (!numbers || numbers.length === 0) return null;
  
  // Get highest number
  const max = Math.max(...numbers.map(n => parseInt(n.replace(/,/g, ''))));
  
  // Handle lakhs
  if (budgetText.toLowerCase().includes("lakh")) {
    return max * 100000;
  }
  
  return max;
}
```

**Show Summary to Vendor:**
```
📊 *Match Analysis Complete*

Based on your answers:

✓ Can supply: {answer_1}
✓ Certification: {answer_2}
✓ Timeline: {answer_3}
✓ Price: {answer_4}
✓ Additional service: {answer_5}
✓ Experience: {answer_6}

*Compatibility Score:* {score}/100 {getScoreEmoji(score)}

{score >= 70 ? "🌟 *This looks like an excellent match!*" :
 score >= 50 ? "✅ *This could be a good fit.*" :
 "⚠️ *Match score is low. Consider carefully before proceeding.*"}

Would you like to submit your interest to the buyer?

Reply *SUBMIT* or *CANCEL*
```

```javascript
function getScoreEmoji(score) {
  if (score >= 80) return "🌟🌟🌟";
  if (score >= 70) return "🌟🌟";
  if (score >= 50) return "🌟";
  return "⚠️";
}
```

---

### STEP 11: STORE VENDOR INTEREST

**Vendor replies:** SUBMIT

Session step: `VENDOR_SUBMIT`

**Update Lead in ERPNext:**
```javascript
const lead = await erpnext.get("RIFAH Lead", leadId);
const interested = JSON.parse(lead.interested_vendors || "[]");

// Add new vendor interest
interested.push({
  vendor_id: vendor.rifah_id,
  vendor_name: vendor.business_name,
  vendor_phone: vendor.whatsapp_number,
  vendor_city: vendor.city_state,
  vendor_industry: vendor.industry,
  responded_at: new Date().toISOString(),
  ai_qualification: {
    question_1: vendorQuestions[0].q,
    answer_1: vendorAnswers.q1,
    question_2: vendorQuestions[1].q,
    answer_2: vendorAnswers.q2,
    question_3: vendorQuestions[2].q,
    answer_3: vendorAnswers.q3,
    question_4: vendorQuestions[3].q,
    answer_4: vendorAnswers.q4,
    question_5: vendorQuestions[4].q,
    answer_5: vendorAnswers.q5,
    question_6: vendorQuestions[5].q,
    answer_6: vendorAnswers.q6
  },
  compatibility_score: score,
  status: "Pending Admin Approval"
});

await erpnext.update("RIFAH Lead", lead.lead_id, {
  interested_vendors: JSON.stringify(interested),
  status: "Has Interested Vendors"
});
```

**Confirm to Vendor:**
```
✅ *Interest submitted successfully!*

📋 Lead ID: {leadId}
📊 Your Compatibility: {score}/100

Our admin will review and connect you with the buyer within *4 hours*.

Thank you for your interest! 🙏
```

**Update Session:**
```javascript
await erpnext.update("RIFAH Session", sessionName, {
  current_step: "COMPLETED",
  status: "Completed"
});
```

---

### STEP 12: ADMIN APPROVAL (VENDOR MATCH)

**Send WhatsApp to Admin:**
```
🤝 *NEW VENDOR MATCH FOR APPROVAL*

📋 Lead ID: {leadId}
📝 Requirement: {lead.title}
👤 Buyer: {lead.member_name}

*Interested Vendor:*
🏢 {vendor_name} ({vendor_id})
📍 {vendor_city}
🏭 {vendor_industry}

*AI Qualification Results:*
{format_vendor_qa}

*Compatibility Score:* {score}/100 {getScoreEmoji(score)}

*AI Recommendation:* {score >= 70 ? "✅ APPROVE - Excellent match" :
                       score >= 50 ? "⚠️ REVIEW - Good fit" :
                       "❌ REJECT - Low match"}

━━━━━━━━━━━━━━━━━━━━
*Actions (SLA: 4 hours):*

Reply:
CONNECT {leadId} {vendor_id}
DECLINE {leadId} {vendor_id}
```

**Admin Reply Handler:**
```javascript
// In main webhook handler
if (message.from === process.env.ADMIN_WHATSAPP) {
  const connectMatch = message.text.match(/^CONNECT\s+(LEAD-\w+-\d{4}-\d+)\s+(RIF-\w+-\d{4}-\d+)$/i);
  const declineMatch = message.text.match(/^DECLINE\s+(LEAD-\w+-\d{4}-\d+)\s+(RIF-\w+-\d{4}-\d+)$/i);
  
  if (connectMatch) {
    const [_, leadId, vendorId] = connectMatch;
    await approveVendorMatch(leadId, vendorId);
    
    await whatsapp.send(process.env.ADMIN_WHATSAPP,
      `✅ Connection approved. Sharing contacts...`);
  }
  else if (declineMatch) {
    const [_, leadId, vendorId] = declineMatch;
    await declineVendorMatch(leadId, vendorId);
    
    await whatsapp.send(process.env.ADMIN_WHATSAPP,
      `✅ Vendor declined. They've been notified.`);
  }
}
```

---

### STEP 13: SHARE CONTACTS (CONNECTION MADE)

**When admin approves (CONNECT command):**

```javascript
async function approveVendorMatch(leadId, vendorId) {
  const lead = await erpnext.get("RIFAH Lead", leadId);
  const vendor = await erpnext.get("RIFAH Member", vendorId);
  const buyer = await erpnext.get("RIFAH Member", lead.member_id);
  
  // Get vendor interest record
  const interested = JSON.parse(lead.interested_vendors);
  const vendorInterest = interested.find(v => v.vendor_id === vendorId);
  
  // Update vendor status
  vendorInterest.status = "Approved - Connected";
  vendorInterest.approved_at = new Date().toISOString();
  
  await erpnext.update("RIFAH Lead", leadId, {
    interested_vendors: JSON.stringify(interested),
    connection_made: 1,
    status: "Connected"
  });
  
  // Message to BUYER
  await whatsapp.send(buyer.whatsapp_number, 
`🎉 *We found a match for your requirement!*

📋 Lead ID: {leadId}

*Matched Vendor:*
🏢 *Business:* ${vendor.business_name}
📍 *Location:* ${vendor.city_state}
🏭 *Industry:* ${vendor.industry}
📊 *Compatibility:* ${vendorInterest.compatibility_score}/100

*Vendor Details:*
${formatVendorQA(vendorInterest.ai_qualification)}

*Contact Information:*
📞 Phone: ${vendor.whatsapp_number}
👤 Contact: ${vendor.full_name}

Please contact them directly to discuss your requirement.

We'll follow up with you in *7 days* to check progress! 🙏`);
  
  // Message to VENDOR
  await whatsapp.send(vendor.whatsapp_number,
`🎉 *Your interest has been approved!*

📋 Lead ID: {leadId}

*Buyer Details:*
🏢 *Business:* ${buyer.business_name}
📍 *Location:* ${buyer.city_state}
📝 *Requirement:* ${lead.title}
💰 *Budget:* ${lead.budget || 'Negotiable'}
⏰ *Timeline:* ${lead.urgency}

*Contact Information:*
📞 Phone: ${buyer.whatsapp_number}
👤 Contact: ${buyer.full_name}

Please contact them to finalize the deal.

We'll follow up in *7 days*! 🙏`);
  
  // Schedule 7-day follow-up
  const followupDate = new Date();
  followupDate.setDate(followupDate.getDate() + 7);
  
  await erpnext.update("RIFAH Lead", leadId, {
    followup_scheduled: followupDate.toISOString()
  });
}

function formatVendorQA(aiQualification) {
  let formatted = "";
  for (let i = 1; i <= 6; i++) {
    if (aiQualification[`question_${i}`]) {
      formatted += `• ${aiQualification[`question_${i}`].split('?')[0]}: ${aiQualification[`answer_${i}`]}\n`;
    }
  }
  return formatted.trim();
}
```

**If admin declines:**
```javascript
async function declineVendorMatch(leadId, vendorId) {
  const lead = await erpnext.get("RIFAH Lead", leadId);
  const vendor = await erpnext.get("RIFAH Member", vendorId);
  
  // Update vendor status
  const interested = JSON.parse(lead.interested_vendors);
  const vendorInterest = interested.find(v => v.vendor_id === vendorId);
  vendorInterest.status = "Declined by Admin";
  
  await erpnext.update("RIFAH Lead", leadId, {
    interested_vendors: JSON.stringify(interested)
  });
  
  // Notify vendor
  await whatsapp.send(vendor.whatsapp_number,
`Thank you for your interest in Lead ${leadId}.

After review, we found that the match may not be ideal at this time.

We encourage you to respond to other leads that match your expertise better.

Thank you for using RIFAH Connect! 🙏`);
}
```

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
| LEAD_CREATE | (Processing - creating lead) |
| VENDOR_INTRO | YES to start qualification |
| VENDOR_Q1 to VENDOR_Q6 | Vendor qualification answers |
| VENDOR_SCORE | SUBMIT or CANCEL |
| VENDOR_SUBMIT | (Processing - submitting interest) |
| COMPLETED | Flow finished |

---

## N8N WORKFLOW ARCHITECTURE

### Main Webhook Nodes (inherited from Flow 1)
- `WhatsApp Webhook POST` — receives all messages

### Flow 2A Specific Nodes

#### Lead Creation Path
- `IF Share Lead Selected` — condition: menu option 2 selected
- `Check Member Tier` — GET member, verify tier = FREE
- `State Machine Lead` — main logic for Steps 1-5 (basic questions)
- `Call OpenAI - Lead Qualification` — HTTP node to OpenAI API
- `Parse AI Questions` — extract questions from OpenAI response
- `State Machine AI Questions` — handle dynamic Q&A flow
- `Create Lead in ERPNext` — POST new RIFAH Lead
- `Notify Admin - New Lead` — send WhatsApp to admin

#### Admin Approval Path
- `IF Admin Command` — detect APPROVE/REJECT/MORE
- `Parse Admin Action` — extract command, lead ID, reason
- `Switch Admin Action` — route to appropriate handler
- `Approve Lead` — update status to "Approved - Ready for Posting"
- `Reject Lead` — update status, notify user
- `Request More Info` — set status, prompt user

#### Group Posting Path
- `Get All Groups` — GET all RIFAH WhatsApp Groups
- `Run Group Selection Algorithm` — JavaScript code node
- `For Each Group` — loop through selected groups
- `Format Lead Message` — build group post message
- `Post to Group` — HTTP to Meta API (or log for demo)
- `Update Lead Posted Groups` — add to posted_to_groups JSON
- `Notify User Posted` — confirm to user

#### Vendor Response Path
- `IF Lead ID Detected` — regex match LEAD-FREE-XXXX-XXXX
- `Get Lead Details` — GET RIFAH Lead by ID
- `Check Vendor Registration` — GET RIFAH Member by phone
- `IF Vendor Not Registered` — prompt registration
- `Create Vendor Session` — new RIFAH Session for qualification
- `Call OpenAI - Vendor Questions` — generate 6 questions
- `State Machine Vendor Qualification` — handle Q&A flow
- `Calculate Compatibility Score` — JavaScript code node
- `Show Score Summary` — format and send to vendor
- `Store Vendor Interest` — update interested_vendors JSON
- `Notify Admin - Vendor Match` — send WhatsApp to admin

#### Admin Connection Approval Path
- `IF CONNECT Command` — detect CONNECT leadId vendorId
- `Get Buyer Details` — GET RIFAH Member (buyer)
- `Get Vendor Details` — GET RIFAH Member (vendor)
- `Send Contact to Buyer` — WhatsApp with vendor details
- `Send Contact to Vendor` — WhatsApp with buyer details
- `Update Lead Connected` — set connection_made = 1
- `Schedule Followup` — set followup_scheduled date

---

## CRITICAL FIXES — MUST IMPLEMENT

### All fixes from Flow 1 apply:
- ERPNext URL: `http://frontend:8080`
- Host header: `rifah.localhost`
- Session updates use `sessionName` not phone
- Merge node before State Machine
- IF nodes use Loose type validation
- No n8n Variables (paid feature)

### Flow 2A Specific Fixes:

#### Fix 1: OpenAI Rate Limiting & Retries
```javascript
// Add retry logic with exponential backoff
async function callOpenAI(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: prompt,
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      });
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
      
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

#### Fix 2: JSON Response Validation
```javascript
// OpenAI sometimes returns markdown-wrapped JSON, strip it
function parseOpenAIResponse(text) {
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Strip markdown code blocks if present
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned);
  }
}

// Usage
const data = await response.json();
const content = data.choices[0].message.content;
const parsed = parseOpenAIResponse(content);
```

#### Fix 3: Fallback Questions (If OpenAI Fails)
```javascript
// Default questions by lead type if API fails
const FALLBACK_QUESTIONS = {
  "BUY": [
    "What are the exact specifications or technical details?",
    "What quantity do you need per order or per month?",
    "Are there any quality certifications required (ISO, FSSAI, etc.)?",
    "What is your preferred delivery timeline?",
    "What is your budget range?",
    "Any special requirements or customization needed?"
  ],
  "SELL": [
    "What are the product specifications and features?",
    "What is your production capacity per month?",
    "Do you have any certifications (ISO, FSSAI, etc.)?",
    "What is your delivery capability (local/national)?",
    "What is your pricing structure?",
    "What makes your product unique or competitive?"
  ],
  "SERVICE NEED": [
    "What is the exact scope of work required?",
    "What is the project duration or timeline?",
    "What level of expertise or certification is needed?",
    "What is your budget for this service?",
    "Are there any specific tools or technologies required?",
    "What are the deliverables or success criteria?"
  ],
  "SERVICE OFFER": [
    "What specific services do you provide?",
    "What is your capacity (projects per month, team size)?",
    "What certifications or expertise do you have?",
    "What is your typical project timeline?",
    "What is your pricing model (hourly, project-based)?",
    "What industries or clients have you worked with?"
  ]
};

// Use in try-catch
try {
  const aiQuestions = await callOpenAI(prompt);
  return aiQuestions.questions;
} catch (error) {
  console.error('OpenAI API failed, using fallback:', error);
  return FALLBACK_QUESTIONS[lead_type] || FALLBACK_QUESTIONS["BUY"];
}
```

#### Fix 4: Group Posting Requires Special Permissions
Meta Cloud API group messaging requires approval. For demo:
```javascript
// Log instead of actually posting
console.log(`Would post to group ${group.name}:`, message);

// Or post to admin's personal chat as preview
await whatsapp.send(ADMIN_PHONE, 
  `[DEMO] Would post to ${group.name}:\n\n${message}`);
```

#### Fix 3: Handle Multiple Vendor Responses
```javascript
// Check if vendor already responded
const interested = JSON.parse(lead.interested_vendors || "[]");
const alreadyResponded = interested.some(v => v.vendor_id === vendor.rifah_id);

if (alreadyResponded) {
  return await whatsapp.send(vendor.whatsapp_number,
    `You have already submitted interest in this lead. Our admin will contact you soon.`);
}
```

#### Fix 4: Session Timeout for Vendor Qualification
```javascript
// If session older than 30 minutes, expire it
const lastActivity = new Date(session.last_activity);
const now = new Date();
const minutesSince = (now - lastActivity) / 60000;

if (minutesSince > 30) {
  await erpnext.update("RIFAH Session", sessionName, {
    status: "Expired"
  });
  
  return await whatsapp.send(phone,
    `⏰ Your session has expired. Please start again by clicking the lead link.`);
}
```

---

## OPENAI API AUTHENTICATION

All OpenAI API calls use Bearer token authentication:
```
Authorization: Bearer YOUR_API_KEY
```

**Get API key from:** https://platform.openai.com/api-keys

**Steps:**
1. Sign up / Log in to OpenAI Platform
2. Go to API Keys section
3. Click "Create new secret key"
4. Copy key: `sk-proj-xxxxxxxxxxxxx`
5. Add billing: $5-10 initial credit (new accounts get $5 free)

**Rate Limits (Free Tier):**
- 3 requests per minute
- 200 requests per day

**Rate Limits (Paid - Tier 1):**
- 3,500 requests per minute
- 10,000 requests per day

**Pricing:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- ~$0.0003 per lead qualification (2 calls)

**Cost per 1,000 leads:** ~₹50 ($0.60)

---

## SAMPLE GROUP DATA

**Create these in ERPNext manually for testing:**

```javascript
[
  {
    group_id: "GRP-001",
    group_name: "Pune Packaging Suppliers",
    group_jid: "120363XXXXX@g.us",
    city: "Pune",
    state: "Maharashtra",
    industry: "Packaging",
    lead_types: JSON.stringify(["BUY", "SELL"]),
    active_members: 85,
    is_active: 1
  },
  {
    group_id: "GRP-002",
    group_name: "Maharashtra Manufacturing Network",
    group_jid: "120363YYYYY@g.us",
    city: "",
    state: "Maharashtra",
    industry: "Manufacturing",
    lead_types: JSON.stringify(["BUY", "SELL", "SERVICE NEED"]),
    active_members: 120,
    is_active: 1
  },
  {
    group_id: "GRP-003",
    group_name: "Food Industry Vendors Pune",
    group_jid: "120363ZZZZZ@g.us",
    city: "Pune",
    state: "Maharashtra",
    industry: "Food",
    lead_types: JSON.stringify(["BUY", "SELL"]),
    active_members: 65,
    is_active: 1
  },
  {
    group_id: "GRP-004",
    group_name: "Mumbai Textile Traders",
    group_jid: "120363AAAAA@g.us",
    city: "Mumbai",
    state: "Maharashtra",
    industry: "Textile",
    lead_types: JSON.stringify(["BUY", "SELL"]),
    active_members: 95,
    is_active: 1
  },
  {
    group_id: "GRP-005",
    group_name: "All India IT Services",
    group_jid: "120363BBBBB@g.us",
    city: "",
    state: "",
    industry: "IT",
    lead_types: JSON.stringify(["SERVICE NEED", "SERVICE OFFER"]),
    active_members: 150,
    is_active: 1
  }
]
```

---

## TEST SCENARIOS

### Test 1: Complete Free User Lead Flow (Happy Path)
```
Hi → main menu
2 → Share Lead flow starts

[Check: Is user FREE member?]
BUY → lead_type stored
Need 5000 plastic bottles 500ml food-grade PET for juice business → lead_desc
Pune, Maharashtra → lead_location
THIS WEEK → lead_urgency
₹50,000 - ₹1,00,000 → lead_budget

[AI generates 6 questions]
500ml → AI answer 1
Food-grade PET → AI answer 2
5000 per month → AI answer 3
FSSAI required → AI answer 4
Yes → AI answer 5
Pune → AI answer 6

[Lead created: LEAD-FREE-2024-0001]
[Admin notified]

[Admin approves via WhatsApp:]
APPROVE LEAD-FREE-2024-0001

[Groups selected by algorithm]
[Posted to 3 groups]
[User notified]
```

Verify in ERPNext:
- RIFAH Lead: status = Posted to Groups
- posted_to_groups has 3 entries with match scores
- Admin received notification with recommended groups

### Test 2: Vendor Response Flow (Happy Path)
```
[Vendor in group clicks link: wa.me/bot?text=LEAD-FREE-2024-0001]

[Bot checks vendor registration - found]

YES → start qualification

[AI generates 6 vendor validation questions]
YES → can supply
YES → has certification
10 days → timeline
₹9 per bottle → price
YES → custom printing
YES - supplied to 3 companies → experience

[Score calculated: 92/100]

SUBMIT → interest submitted

[Admin notified]

[Admin approves:]
CONNECT LEAD-FREE-2024-0001 RIF-FREE-2024-0002

[Buyer gets vendor contact]
[Vendor gets buyer contact]
[Followup scheduled for 7 days]
```

Verify in ERPNext:
- RIFAH Lead: interested_vendors has 1 entry with score 92
- connection_made = 1
- followup_scheduled = 7 days from now
- Both buyer and vendor received contact info

### Test 3: Admin Rejection Flow
```
[After lead created]

[Admin rejects:]
REJECT LEAD-FREE-2024-0001 Incomplete specifications

[User receives rejection message with reason]
```

Verify:
- RIFAH Lead: status = Rejected
- admin_notes contains reason
- User received WhatsApp notification

### Test 4: Vendor Not Registered
```
[Unregistered number clicks lead link]

[Bot detects not registered]
[Prompts registration]

YES → redirects to Flow 1 Registration
```

### Test 5: Multiple Vendors Respond
```
[Vendor 1 responds → score 92]
[Vendor 2 responds → score 75]
[Vendor 3 responds → score 60]

[Admin sees 3 notifications]
[Admin approves Vendor 1]
CONNECT LEAD-FREE-2024-0001 RIF-FREE-2024-0002

[Only Vendor 1 gets connected]
[Other vendors remain "Pending Admin Approval"]
```

Verify:
- interested_vendors has 3 entries
- Only 1 has status "Approved - Connected"
- Only 1 vendor and buyer received contacts

---

---

## N8N OPENAI INTEGRATION EXAMPLES

### Node 1: Call OpenAI - Lead Qualification

**HTTP Request Node Configuration:**

```json
{
  "method": "POST",
  "url": "https://api.openai.com/v1/chat/completions",
  "authentication": "none",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{$env.OPENAI_API_KEY}}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "contentType": "json",
  "body": {
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "You are a B2B requirement qualification assistant for an Indian marketplace connecting 1 lakh+ businesses. Generate specific follow-up questions to understand buyer requirements better."
      },
      {
        "role": "user",
        "content": "=User's requirement:\nType: {{$json.lead_type}}\nDescription: {{$json.lead_description}}\nLocation: {{$json.lead_location}}\n\nGenerate 3-6 specific follow-up questions. Return ONLY JSON:\n{\n  \"questions\": [\"Question 1?\", \"Question 2?\", ...]\n}"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 500,
    "response_format": {
      "type": "json_object"
    }
  },
  "options": {
    "timeout": 30000
  }
}
```

### Node 2: Parse OpenAI Response

**Function Node (JavaScript):**

```javascript
// Input: OpenAI API response
const response = $input.item.json;

// Extract content
const content = response.choices[0].message.content;

// Parse JSON (with error handling)
let questions = [];
try {
  // Try direct parse
  const parsed = JSON.parse(content);
  questions = parsed.questions || [];
} catch (e) {
  // Strip markdown if present
  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  
  try {
    const parsed = JSON.parse(cleaned);
    questions = parsed.questions || [];
  } catch (e2) {
    // Fallback questions
    questions = [
      "What are the exact specifications?",
      "What quantity do you need?",
      "What is your budget range?",
      "What is your timeline?",
      "Any special requirements?"
    ];
  }
}

// Return structured data
return {
  json: {
    questions: questions,
    question_count: questions.length,
    ai_response_received: true
  }
};
```

### Node 3: Call OpenAI - Vendor Qualification

**HTTP Request Node:**

```json
{
  "method": "POST",
  "url": "https://api.openai.com/v1/chat/completions",
  "authentication": "none",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{$env.OPENAI_API_KEY}}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "contentType": "json",
  "body": {
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "You are validating if a vendor can fulfill a B2B requirement in India. Generate exactly 6 validation questions."
      },
      {
        "role": "user",
        "content": "=Lead: {{$json.lead_description}}\nType: {{$json.lead_type}}\nLocation: {{$json.lead_location}}\nBudget: {{$json.lead_budget}}\nUrgency: {{$json.lead_urgency}}\n\nGenerate 6 validation questions. Return JSON:\n{\n  \"questions\": [\n    {\"q\": \"Can you supply X?\", \"type\": \"yes_no\"},\n    {\"q\": \"Certification?\", \"type\": \"yes_no\"},\n    {\"q\": \"Timeline?\", \"type\": \"text\"},\n    {\"q\": \"Price?\", \"type\": \"text\"},\n    {\"q\": \"Additional service?\", \"type\": \"yes_no\"},\n    {\"q\": \"Past experience?\", \"type\": \"yes_no\"}\n  ]\n}"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 600,
    "response_format": {
      "type": "json_object"
    }
  }
}
```

### Node 4: Error Handling with Retry

**Function Node (JavaScript):**

```javascript
// Retry logic with exponential backoff
async function callOpenAIWithRetry(prompt, retries = 3) {
  const apiKey = $env.OPENAI_API_KEY;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await $http.request({
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: {
          model: 'gpt-4o-mini',
          messages: prompt,
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        }
      });
      
      // Success - return parsed response
      const content = response.body.choices[0].message.content;
      return JSON.parse(content);
      
    } catch (error) {
      // Check if rate limited
      if (error.statusCode === 429) {
        const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Last retry - throw error
      if (i === retries - 1) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Usage
try {
  const result = await callOpenAIWithRetry([
    { role: 'system', content: 'System prompt...' },
    { role: 'user', content: $json.prompt }
  ]);
  
  return { json: result };
  
} catch (error) {
  // Return fallback
  return {
    json: {
      questions: [
        "What are the specifications?",
        "What quantity do you need?",
        "What certifications are required?",
        "What is your timeline?",
        "What is your budget?",
        "Any special requirements?"
      ],
      fallback: true,
      error: error.message
    }
  };
}
```

---

## DELIVERABLES CHECKLIST

- [ ] `doctypes/rifah_lead.json`
- [ ] `doctypes/rifah_whatsapp_group.json`
- [ ] `n8n/rifah_flow2a_workflow.json` — importable workflow
- [ ] `scripts/create_sample_groups.js` — populate test data
- [ ] `test_suite/test_flow2a.js` — automated tests
- [ ] Updated `.env` with OPENAI_API_KEY and ADMIN_WHATSAPP
- [ ] `documents/flow2a_setup_guide.md` — complete setup instructions
- [ ] `documents/flow2a_architecture.md` — technical documentation
- [ ] `documents/group_selection_algorithm.md` — algorithm explanation
- [ ] `documents/openai_integration_guide.md` — OpenAI API usage & best practices

**Reference:** See `/documents/AI_Integration_Guide.md` for detailed cost comparison and alternative AI providers.

---

## ENVIRONMENT VARIABLES (.env additions)

```bash
# OpenAI API (GPT-4o-mini)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7

# Admin Contact
ADMIN_WHATSAPP=919876543210

# Bot Number (for wa.me links)
BOT_WHATSAPP_NUMBER=918765432100
```

---

## INTEGRATION WITH FLOW 1

**Shared Resources:**
- RIFAH Session doctype (manages state for all flows)
- RIFAH Member doctype (user data from registration)
- Main webhook handler (routes to different flows)

**Flow Detection in Main Webhook:**
```javascript
// After user sends "Hi" and sees menu
if (userReply === "2") {
  // Check if registered
  const member = await getMember(phone);
  if (!member) {
    return "Please register first (option 1)";
  }
  
  // Route to Flow 2A or 2B based on tier
  if (member.membership_tier === "FREE") {
    // Flow 2A - this flow
    return startFlow2A(phone, member);
  } else {
    // Flow 2B - next flow
    return startFlow2B(phone, member);
  }
}
```

---

## PHASE 1 HUMAN OVERSIGHT

All AI decisions require admin approval in Phase 1 (first 3-6 months):
- Lead qualification → Admin approves before posting
- Group selection → Admin can override algorithm
- Vendor qualification → Admin approves before connection

This builds confidence in the system and allows manual correction of AI mistakes.

**Phase 2 (Future):** Remove admin approval, let AI handle fully automated.

---

## COST MONITORING & OPTIMIZATION

### Track OpenAI Usage

**OpenAI Platform Dashboard:** https://platform.openai.com/usage

**Monitor:**
- Daily API calls
- Token usage (input + output)
- Cost per day/month
- Rate limit hits

### Expected Costs (Flow 2A Only)

| Scenario | Leads/Month | API Calls/Month | Cost/Month |
|----------|-------------|-----------------|------------|
| Launch | 1,000 | 2,000 | ₹50 |
| Growing | 10,000 | 20,000 | ₹500 |
| Mature | 30,000 | 60,000 | ₹1,500 |
| Peak | 100,000 | 200,000 | ₹5,000 |

### Optimization Tips

**1. Use Caching for Similar Questions**
```javascript
// Cache common question patterns
const questionCache = {};
const cacheKey = `${lead_type}_${industry}`;

if (questionCache[cacheKey]) {
  return questionCache[cacheKey];
}

// Call API only if not cached
const questions = await callOpenAI(prompt);
questionCache[cacheKey] = questions;
```

**2. Reduce Token Usage**
```javascript
// Keep prompts concise
// BAD: Long verbose system prompt (200 tokens)
// GOOD: Short focused prompt (50 tokens)

// Use max_tokens wisely
max_tokens: 300  // Instead of 1000
```

**3. Set Budget Alerts**
- Go to OpenAI Platform → Usage → Budget alerts
- Set alert at ₹1,000/month
- Get email notification before hitting limit

**4. Implement Rate Limiting**
```javascript
// Limit AI calls per user per day
const userCallCount = await redis.incr(`ai_calls:${userId}:${today}`);
if (userCallCount > 5) {
  return FALLBACK_QUESTIONS[lead_type];
}
```

---

END OF FLOW 2A MASTER PROMPT