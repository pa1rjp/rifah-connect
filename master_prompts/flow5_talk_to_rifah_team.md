# RIFAH Connect — Master Prompt: Flow 5 Talk to RIFAH Team

## CONTEXT FOR CLAUDE CODE

You are building Flow 5 (Talk to RIFAH Team) for RIFAH Connect — a WhatsApp Business automation
platform for a chamber of commerce connecting 1 lakh+ businesses in India.

**Purpose:** Provide customer support, handle inquiries, manage support tickets, and enable 
communication between members and chamber staff.

**Prerequisites:**
- Flow 1 (Registration/Update) in production
- User must be registered member (FREE or PREMIUM)
- Support team WhatsApp numbers configured

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
| Tunnel | ngrok static domain | URL in .env as NGROK_URL |
| OS | Intel Mac (Docker Desktop) | - |

**No AI required for this flow** — rule-based routing and ticket management

---

## SUPPORT TIERS & SLA

| Feature | FREE | PREMIUM |
|---------|------|---------|
| Response Time SLA | 24-48 hours | 4-8 hours |
| Support Channels | WhatsApp bot only | Bot + Phone + Email |
| Priority | Normal | High priority |
| Dedicated Support | ❌ General queue | ✅ Dedicated manager |
| After Hours | ❌ Business hours only | ✅ 24/7 emergency line |
| Escalation | ❌ No escalation | ✅ Auto-escalate after 4 hours |

---

## ERPNEXT CUSTOM DOCTYPES REQUIRED

### 1. RIFAH Support Ticket

**Fields:**
```
ticket_id (Data, Unique, Read Only) — TICKET-YYYY-######
member_id (Link: RIFAH Member)
member_name (Data, from member)
member_phone (Data, from member)
member_tier (Data, from member)
ticket_type (Select) — TECHNICAL, BILLING, GENERAL, COMPLAINT, FEATURE_REQUEST, MEMBERSHIP
priority (Select) — LOW, MEDIUM, HIGH, URGENT
subject (Data, 150 chars)
description (Text)
status (Select) — OPEN, IN_PROGRESS, WAITING_USER, RESOLVED, CLOSED
assigned_to (Link: User) — Support staff member
created_at (Datetime, Default Now)
first_response_at (Datetime)
resolved_at (Datetime)
closed_at (Datetime)
resolution_notes (Text)
rating (Int) — 1-5 stars (after resolution)
feedback (Text) — User feedback (after resolution)
response_time_hours (Float) — SLA tracking
sla_breached (Check) — Auto-set if exceeded
escalated (Check) — Premium auto-escalation
escalation_reason (Text)
conversation_log (Long Text) — JSON array of messages
attachments (Text) — JSON array of file URLs
```

**Naming:** Auto-increment `TICKET-2024-000001`

### 2. RIFAH FAQ

**Fields:**
```
faq_id (Data, Unique, Read Only) — FAQ-####
category (Select) — REGISTRATION, MEMBERSHIP, LEADS, PAYMENTS, EVENTS, TECHNICAL, GENERAL
question (Data, 200 chars)
answer (Text)
keywords (Small Text) — Comma-separated for search
language (Select) — English, Hindi, Marathi, etc.
access_tier (Select) — FREE, PREMIUM, ALL
view_count (Int, Default 0)
helpful_count (Int, Default 0) — "Was this helpful? YES" count
is_active (Check, Default 1)
created_at (Datetime)
updated_at (Datetime)
```

**Naming:** Auto-increment `FAQ-0001`

### 3. RIFAH Support Agent

**Fields:**
```
agent_id (Data, Unique, Read Only) — AGENT-###
agent_name (Data)
agent_phone (Data) — WhatsApp number
agent_email (Data)
department (Select) — TECHNICAL, BILLING, GENERAL, MEMBERSHIP
is_active (Check, Default 1)
max_concurrent_tickets (Int, Default 5)
current_ticket_count (Int, Default 0)
availability_status (Select) — AVAILABLE, BUSY, OFFLINE
languages (Small Text) — Comma-separated
rating (Float) — Average rating from resolved tickets
total_tickets_resolved (Int, Default 0)
```

**Naming:** `AGENT-001`, `AGENT-002`, etc.

---

## COMPLETE CONVERSATION FLOW

### Entry Point

User sends "Hi" → Bot shows main menu → User selects "5️⃣ Talk to RIFAH Team"

**Bot Message:**
```
💬 *TALK TO RIFAH TEAM*

How can we help you today?

1️⃣ Browse FAQs (Quick answers)
2️⃣ Create Support Ticket
3️⃣ My Support Tickets
4️⃣ Contact Information
5️⃣ Emergency Support {PREMIUM only}
0️⃣ Back to Main Menu

_Reply with a number (1-5)_
```

Session step: `SUPPORT_CATEGORY`

---

### OPTION 1: BROWSE FAQs

**User Input:** `1`

**Show FAQ Categories:**
```javascript
const faqCategories = await erpnext.query("RIFAH FAQ", {
  is_active: 1,
  access_tier: ["in", member.membership_tier === "PREMIUM" ? 
    ["FREE", "PREMIUM", "ALL"] : 
    ["FREE", "ALL"]
  ]
});

// Group by category
const categories = {};
faqCategories.forEach(faq => {
  categories[faq.category] = (categories[faq.category] || 0) + 1;
});
```

**Bot Message:**
```
❓ *FREQUENTLY ASKED QUESTIONS*

Browse by category:

1️⃣ Registration & Setup (8 FAQs)
2️⃣ Membership & Billing (12 FAQs)
3️⃣ Posting & Managing Leads (15 FAQs)
4️⃣ Events & Training (6 FAQs)
5️⃣ Technical Issues (10 FAQs)
6️⃣ General Questions (9 FAQs)
7️⃣ Search FAQs (type keywords)
0️⃣ Back

_Reply with a number or type your question_
```

Session step: `FAQ_CATEGORY`

**User selects category (e.g., 3 - Leads):**

```javascript
const faqs = await erpnext.query("RIFAH FAQ", {
  category: "LEADS",
  is_active: 1,
  access_tier: ["in", accessTiers]
}, {
  order_by: "view_count DESC",
  limit: 10
});
```

**Bot Message:**
```
📋 *POSTING & MANAGING LEADS - FAQs*

1. How do I post a new lead?
2. What's the difference between FREE and PREMIUM lead posting?
3. How long does it take for leads to be approved?
4. Can I edit or delete a lead after posting?
5. How do vendors respond to my leads?
6. What happens after a vendor shows interest?
7. How many leads can I post per month?
8. Why was my lead rejected?
9. How do I track my posted leads?
10. Can I post the same lead to multiple groups?

_Reply with FAQ number for answer_
Or *BACK* to change category
Or *SEARCH [keywords]* to find specific FAQ
```

Session step: `FAQ_SELECT`

**User selects FAQ (e.g., 2):**

```javascript
const faq = faqs[1]; // Index 1 for option 2

// Increment view count
await erpnext.setValue("RIFAH FAQ", faq.faq_id, 
  "view_count", faq.view_count + 1);

// Send answer
await whatsapp.send(userPhone, `
❓ *${faq.question}*

💡 ${faq.answer}

━━━━━━━━━━━━━━━━━━━━━━

*Was this helpful?*
Reply *YES* or *NO*

Or *BACK* for more FAQs
Or *TICKET* to create support ticket
`);
```

Session step: `FAQ_FEEDBACK`

**User feedback:**
```javascript
if (userInput === "YES") {
  await erpnext.setValue("RIFAH FAQ", faq.faq_id,
    "helpful_count", faq.helpful_count + 1);
  
  await whatsapp.send(userPhone, `
✅ Thank you for your feedback!

Need more help? Reply:
*BACK* - More FAQs
*TICKET* - Create support ticket
*MENU* - Main menu
  `);
}

if (userInput === "NO") {
  await whatsapp.send(userPhone, `
Sorry this wasn't helpful.

Would you like to:
1️⃣ Talk to a support agent
2️⃣ Browse other FAQs
0️⃣ Back to menu

_Reply with a number_
  `);
}
```

---

**FAQ Search:**
```
User Input: SEARCH payment issues
or
User Input: how to cancel membership
```

**Search Implementation:**
```javascript
function searchFAQs(query, accessTiers) {
  const keywords = query.toLowerCase().split(' ');
  
  const faqs = await erpnext.query("RIFAH FAQ", {
    is_active: 1,
    access_tier: ["in", accessTiers]
  });
  
  // Score each FAQ
  const scored = faqs.map(faq => {
    let score = 0;
    const searchText = `${faq.question} ${faq.answer} ${faq.keywords}`.toLowerCase();
    
    keywords.forEach(keyword => {
      if (searchText.includes(keyword)) {
        score += 1;
        // Boost score if in question
        if (faq.question.toLowerCase().includes(keyword)) {
          score += 2;
        }
      }
    });
    
    return { faq, score };
  });
  
  // Return top 5 matches
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.faq);
}
```

**Bot Response:**
```
🔍 *Search Results: "payment issues"*

Found 3 matching FAQs:

1. How do I make a payment for Premium membership?
   Category: Membership & Billing
   
2. What payment methods are accepted?
   Category: Membership & Billing
   
3. I made a payment but it's not reflected. What should I do?
   Category: Technical Issues

_Reply with FAQ number for full answer_
Or *TICKET* to create support ticket
```

---

### OPTION 2: CREATE SUPPORT TICKET

**User Input:** `2`

**Bot Message:**
```
🎫 *CREATE SUPPORT TICKET*

What type of support do you need?

1️⃣ Technical Issue (app not working, errors)
2️⃣ Billing & Payments
3️⃣ Membership Questions
4️⃣ General Inquiry
5️⃣ Complaint
6️⃣ Feature Request
0️⃣ Back

_Reply with a number_
```

Session step: `TICKET_TYPE`

**User selects type (e.g., 1 - Technical):**

```
Please describe your issue in detail.

Include:
• What were you trying to do?
• What happened instead?
• Any error messages you saw?

_Type your message below_
```

Session step: `TICKET_DESC`

**User provides description:**

```javascript
const userDescription = userInput; // User's detailed message

// Determine priority based on keywords and tier
function determinePriority(description, memberTier, ticketType) {
  let priority = "MEDIUM";
  
  const urgentKeywords = ["urgent", "emergency", "critical", "not working", "broken", "error", "crash"];
  const lowKeywords = ["question", "how to", "feature request", "suggestion"];
  
  const desc = description.toLowerCase();
  
  if (urgentKeywords.some(kw => desc.includes(kw))) {
    priority = "HIGH";
  } else if (lowKeywords.some(kw => desc.includes(kw))) {
    priority = "LOW";
  }
  
  // Upgrade priority for premium users
  if (memberTier === "PREMIUM" && priority !== "URGENT") {
    const priorityLevels = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    const currentIndex = priorityLevels.indexOf(priority);
    priority = priorityLevels[Math.min(currentIndex + 1, priorityLevels.length - 1)];
  }
  
  // Technical issues default to HIGH
  if (ticketType === "TECHNICAL" && priority === "MEDIUM") {
    priority = "HIGH";
  }
  
  return priority;
}

const priority = determinePriority(userDescription, member.membership_tier, selectedTicketType);
```

**Optional: Attach Screenshot/File:**
```
Would you like to attach a screenshot or file?

Reply *YES* to attach
Or *NO* to skip

_This helps our team resolve your issue faster_
```

Session step: `TICKET_ATTACH`

**If YES, wait for file upload:**
```javascript
// User sends image/document
const attachmentUrl = await saveAttachment(message.media);

session_data.attachments = [attachmentUrl];
```

**Create Ticket:**
```javascript
// Auto-assign to available agent
const availableAgent = await findAvailableAgent(selectedTicketType, priority);

const ticketCount = await erpnext.count("RIFAH Support Ticket", {
  created_at: [">=", "2024-01-01"]
});

const ticketId = `TICKET-2024-${String(ticketCount + 1).padStart(6, '0')}`;

const ticket = await erpnext.create("RIFAH Support Ticket", {
  ticket_id: ticketId,
  member_id: member.rifah_id,
  member_name: member.business_name,
  member_phone: member.whatsapp_number,
  member_tier: member.membership_tier,
  ticket_type: selectedTicketType,
  priority: priority,
  subject: userDescription.substring(0, 100) + "...", // First 100 chars
  description: userDescription,
  status: "OPEN",
  assigned_to: availableAgent?.agent_id || null,
  created_at: new Date().toISOString(),
  conversation_log: JSON.stringify([{
    timestamp: new Date().toISOString(),
    from: "user",
    message: userDescription,
    attachments: session_data.attachments || []
  }]),
  attachments: JSON.stringify(session_data.attachments || [])
});

// Update agent ticket count
if (availableAgent) {
  await erpnext.setValue("RIFAH Support Agent", availableAgent.agent_id,
    "current_ticket_count", availableAgent.current_ticket_count + 1);
}
```

**Confirmation to User:**
```
✅ *Support ticket created!*

🎫 Ticket ID: *${ticketId}*
📋 Type: ${ticketType}
⚡ Priority: ${priority}
👤 Assigned to: ${availableAgent?.agent_name || 'Support team'}

*Expected Response Time:*
${member.membership_tier === "PREMIUM" ? "4-8 hours" : "24-48 hours"}

We'll notify you here when our team responds.

Track your ticket: Reply *TICKETS*
```

**Notify Assigned Agent:**
```javascript
if (availableAgent) {
  await whatsapp.send(availableAgent.agent_phone, `
🎫 *NEW SUPPORT TICKET ASSIGNED*

Ticket: ${ticketId}
Priority: ${priority} ${priority === "URGENT" ? "🔴" : priority === "HIGH" ? "🟠" : "🟢"}
Type: ${ticketType}
Member: ${member.business_name} (${member.membership_tier})

Issue:
${userDescription}

${session_data.attachments?.length > 0 ? 
  `Attachments: ${session_data.attachments.length} file(s)` : ''}

SLA: ${member.membership_tier === "PREMIUM" ? "4-8 hours" : "24-48 hours"}

Reply to this ticket: 
RESPOND ${ticketId} [your message]
  `);
  
  // Send attachments to agent if any
  if (session_data.attachments && session_data.attachments.length > 0) {
    for (const url of session_data.attachments) {
      await whatsapp.sendDocument(availableAgent.agent_phone, url);
    }
  }
}
```

**Notify Admin Dashboard:**
```javascript
// Also send to admin for monitoring
await whatsapp.send(ADMIN_WHATSAPP, `
📊 *New Ticket Created*

Ticket: ${ticketId}
Priority: ${priority}
Type: ${ticketType}
Member: ${member.business_name} (${member.membership_tier})
Assigned: ${availableAgent?.agent_name || 'Unassigned'}

Dashboard: ${ERPNEXT_URL}/app/rifah-support-ticket/${ticketId}
`);
```

---

### AGENT RESPONSE TO TICKET

**Agent sends response via WhatsApp:**
```
From: agent_phone (e.g., +919999999999)
Input: RESPOND TICKET-2024-000001 We're looking into this. Can you confirm your ERPNext version?
```

**Bot Handler:**
```javascript
if (message.from === agentPhone && text.startsWith("RESPOND")) {
  const match = text.match(/^RESPOND\s+(TICKET-\d{4}-\d{6})\s+(.+)$/s);
  
  if (match) {
    const [, ticketId, response] = match;
    
    // Get ticket
    const ticket = await erpnext.getDoc("RIFAH Support Ticket", ticketId);
    
    // Update conversation log
    const conversationLog = JSON.parse(ticket.conversation_log || "[]");
    conversationLog.push({
      timestamp: new Date().toISOString(),
      from: "agent",
      agent_name: agent.agent_name,
      message: response
    });
    
    // Update ticket
    await erpnext.update("RIFAH Support Ticket", ticketId, {
      status: "IN_PROGRESS",
      conversation_log: JSON.stringify(conversationLog),
      first_response_at: ticket.first_response_at || new Date().toISOString()
    });
    
    // Calculate response time for SLA
    const responseTimeHours = (new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60);
    const slaLimit = ticket.member_tier === "PREMIUM" ? 8 : 48;
    
    if (responseTimeHours > slaLimit && !ticket.first_response_at) {
      // SLA breached
      await erpnext.setValue("RIFAH Support Ticket", ticketId, "sla_breached", 1);
    }
    
    // Forward to user
    await whatsapp.send(ticket.member_phone, `
🎫 *Update on Ticket ${ticketId}*

👤 ${agent.agent_name} (Support Team):

${response}

━━━━━━━━━━━━━━━━━━━━━━

Reply to continue the conversation.
    `);
    
    // Confirm to agent
    await whatsapp.send(agentPhone, `
✅ Response sent to ${ticket.member_name}

Ticket ${ticketId} status: IN_PROGRESS
    `);
  }
}
```

**User Replies to Ticket:**
```javascript
// Detect if user has active ticket in session or recent conversation
if (session_data.active_ticket_id) {
  const ticketId = session_data.active_ticket_id;
  
  // Add user reply to conversation
  const ticket = await erpnext.getDoc("RIFAH Support Ticket", ticketId);
  const conversationLog = JSON.parse(ticket.conversation_log);
  
  conversationLog.push({
    timestamp: new Date().toISOString(),
    from: "user",
    message: userInput
  });
  
  await erpnext.update("RIFAH Support Ticket", ticketId, {
    status: "IN_PROGRESS",
    conversation_log: JSON.stringify(conversationLog)
  });
  
  // Forward to assigned agent
  const agent = await erpnext.getDoc("RIFAH Support Agent", ticket.assigned_to);
  
  await whatsapp.send(agent.agent_phone, `
🎫 *Reply on Ticket ${ticketId}*

👤 ${ticket.member_name}:

${userInput}

━━━━━━━━━━━━━━━━━━━━━━

Reply: RESPOND ${ticketId} [your message]
Or: RESOLVE ${ticketId} [resolution notes]
  `);
  
  await whatsapp.send(userPhone, `
✅ Message sent to support team.

We'll respond as soon as possible.
  `);
}
```

---

### AGENT RESOLVES TICKET

```
From: agent_phone
Input: RESOLVE TICKET-2024-000001 Issue resolved. Updated your ERPNext version to latest. Please verify.
```

**Bot Handler:**
```javascript
if (text.startsWith("RESOLVE")) {
  const match = text.match(/^RESOLVE\s+(TICKET-\d{4}-\d{6})\s+(.+)$/s);
  
  if (match) {
    const [, ticketId, resolutionNotes] = match;
    
    const ticket = await erpnext.getDoc("RIFAH Support Ticket", ticketId);
    
    // Update ticket
    const resolvedAt = new Date();
    const responseTimeHours = (resolvedAt - new Date(ticket.created_at)) / (1000 * 60 * 60);
    
    await erpnext.update("RIFAH Support Ticket", ticketId, {
      status: "RESOLVED",
      resolved_at: resolvedAt.toISOString(),
      resolution_notes: resolutionNotes,
      response_time_hours: responseTimeHours
    });
    
    // Decrement agent ticket count
    const agent = await erpnext.getDoc("RIFAH Support Agent", ticket.assigned_to);
    await erpnext.setValue("RIFAH Support Agent", ticket.assigned_to,
      "current_ticket_count", Math.max(0, agent.current_ticket_count - 1));
    
    // Notify user
    await whatsapp.send(ticket.member_phone, `
✅ *Ticket ${ticketId} RESOLVED*

👤 ${agent.agent_name}:

${resolutionNotes}

━━━━━━━━━━━━━━━━━━━━━━

*Is this issue resolved?*

Reply:
*YES* - Close ticket
*NO* - Reopen ticket

If resolved, please rate your experience (1-5 stars)
    `);
    
    // Confirm to agent
    await whatsapp.send(agentPhone, `
✅ Ticket ${ticketId} marked as RESOLVED

Waiting for user confirmation.
    `);
  }
}
```

**User Confirms Resolution:**
```javascript
if (userInput === "YES" || parseInt(userInput) >= 1 && parseInt(userInput) <= 5) {
  const ticketId = session_data.active_ticket_id;
  
  if (parseInt(userInput) >= 1 && parseInt(userInput) <= 5) {
    // User rated
    const rating = parseInt(userInput);
    
    await erpnext.update("RIFAH Support Ticket", ticketId, {
      status: "CLOSED",
      closed_at: new Date().toISOString(),
      rating: rating
    });
    
    // Update agent stats
    const ticket = await erpnext.getDoc("RIFAH Support Ticket", ticketId);
    const agent = await erpnext.getDoc("RIFAH Support Agent", ticket.assigned_to);
    
    const totalResolved = agent.total_tickets_resolved + 1;
    const newAvgRating = ((agent.rating * agent.total_tickets_resolved) + rating) / totalResolved;
    
    await erpnext.update("RIFAH Support Agent", ticket.assigned_to, {
      total_tickets_resolved: totalResolved,
      rating: newAvgRating
    });
    
    await whatsapp.send(userPhone, `
⭐⭐⭐⭐⭐ (${rating}/5)

Thank you for your feedback!

Your ticket ${ticketId} is now closed.

Need more help? Reply *MENU*
    `);
    
    // Clear active ticket from session
    delete session_data.active_ticket_id;
    
  } else {
    // Just YES without rating
    await whatsapp.send(userPhone, `
Great! Please rate your experience (1-5 stars):

5 ⭐⭐⭐⭐⭐ Excellent
4 ⭐⭐⭐⭐ Good
3 ⭐⭐⭐ Average
2 ⭐⭐ Below Average
1 ⭐ Poor

_Reply with a number 1-5_
    `);
  }
}

if (userInput === "NO") {
  // Reopen ticket
  await erpnext.setValue("RIFAH Support Ticket", ticketId, "status", "OPEN");
  
  await whatsapp.send(userPhone, `
Ticket ${ticketId} has been reopened.

Please describe what's still not working:
  `);
  
  // Notify agent
  await whatsapp.send(agent.agent_phone, `
⚠️ Ticket ${ticketId} REOPENED by user

User says issue not fully resolved.
  `);
}
```

---

### OPTION 3: MY SUPPORT TICKETS

**User Input:** `3`

**Query User's Tickets:**
```javascript
const tickets = await erpnext.query("RIFAH Support Ticket", {
  member_id: member.rifah_id
}, {
  order_by: "created_at DESC",
  limit: 10
});

// Group by status
const openTickets = tickets.filter(t => ["OPEN", "IN_PROGRESS", "WAITING_USER"].includes(t.status));
const resolvedTickets = tickets.filter(t => ["RESOLVED", "CLOSED"].includes(t.status));
```

**Bot Message:**
```
🎫 *MY SUPPORT TICKETS*

━━━━━━━━━━━━━━━━━━━━━━
*OPEN TICKETS (${openTickets.length})*

${openTickets.length === 0 ? "No open tickets" : ""}

${openTickets.map((t, i) => `
${i+1}. ${t.ticket_id}
   ${t.subject.substring(0, 50)}...
   Status: ${t.status}
   Priority: ${t.priority}
   Created: ${formatDate(t.created_at)}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━
*RESOLVED (${resolvedTickets.length})*

${resolvedTickets.slice(0, 3).map((t, i) => `
${i+1}. ${t.ticket_id} - ${t.status}
   Resolved: ${formatDate(t.resolved_at)}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━

Reply with ticket ID for details
Or *BACK* to go back
```

Session step: `TICKET_VIEW`

**User Views Ticket Details:**
```
Input: TICKET-2024-000001
```

```javascript
const ticket = await erpnext.getDoc("RIFAH Support Ticket", ticketId);
const conversationLog = JSON.parse(ticket.conversation_log);

await whatsapp.send(userPhone, `
🎫 *TICKET ${ticket.ticket_id}*

📋 Type: ${ticket.ticket_type}
⚡ Priority: ${ticket.priority}
📊 Status: ${ticket.status}
👤 Assigned: ${ticket.assigned_to || 'Unassigned'}

*Created:* ${formatDateTime(ticket.created_at)}
${ticket.resolved_at ? `*Resolved:* ${formatDateTime(ticket.resolved_at)}` : ''}

*Issue:*
${ticket.description}

━━━━━━━━━━━━━━━━━━━━━━
*CONVERSATION HISTORY:*

${conversationLog.map(msg => `
[${formatTime(msg.timestamp)}] ${msg.from === 'user' ? '👤 You' : '👨‍💼 ' + (msg.agent_name || 'Support')}:
${msg.message}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━

${ticket.status === "RESOLVED" ? 
  "Reply YES to close, NO to reopen" :
  "Reply to continue conversation"
}
`);

// Set as active ticket
session_data.active_ticket_id = ticketId;
```

---

### OPTION 4: CONTACT INFORMATION

**User Input:** `4`

**Bot Message:**
```
📞 *CONTACT RIFAH SUPPORT*

*WhatsApp (Bot):*
This number: ${BOT_WHATSAPP_NUMBER}

*Office Hours:*
Monday - Friday: 9:00 AM - 6:00 PM
Saturday: 10:00 AM - 4:00 PM
Sunday: Closed

*Phone Support:*
${member.membership_tier === "PREMIUM" ? 
  `📞 Premium Helpline: ${PREMIUM_SUPPORT_PHONE}\n   (24/7 for urgent issues)` :
  `📞 General Support: ${GENERAL_SUPPORT_PHONE}\n   (Business hours only)`
}

*Email:*
📧 support@rifah.org
📧 ${member.membership_tier === "PREMIUM" ? `premium@rifah.org (Priority inbox)` : ''}

*Office Address:*
RIFAH Chamber of Commerce
123 Business Tower, MG Road
Pune, Maharashtra - 411001

*Website:*
🌐 https://rifah.org
📚 Knowledge Base: https://help.rifah.org

━━━━━━━━━━━━━━━━━━━━━━

Reply *TICKET* to create support ticket
Or *MENU* for main menu
```

---

### OPTION 5: EMERGENCY SUPPORT (Premium Only)

**User Input:** `5`

**Check Tier:**
```javascript
if (member.membership_tier !== "PREMIUM") {
  await whatsapp.send(userPhone, `
🚨 *EMERGENCY SUPPORT*

24/7 emergency support is available for *PREMIUM members only*.

*Premium Benefits:*
✓ 24/7 emergency hotline
✓ Immediate response
✓ Priority escalation
✓ Dedicated support manager

💡 *Upgrade to Premium* for:
• Emergency support access
• 4-hour response SLA
• Phone + WhatsApp support
• And more...

Reply *UPGRADE* for details
Or call ${GENERAL_SUPPORT_PHONE} (business hours)
  `);
  
  return;
}
```

**For Premium Users:**
```
🚨 *EMERGENCY SUPPORT*

⭐ Premium 24/7 Support

Is this a critical issue that requires immediate attention?

Examples:
• System completely down
• Payment processing failed for large order
• Security breach suspected
• Unable to access critical business data

━━━━━━━━━━━━━━━━━━━━━━

Reply *YES* to create urgent ticket
Or *CALL* for phone number

_Emergency support is for critical issues only._
_Non-urgent issues may be downgraded to normal priority._
```

**If YES:**
```javascript
// Create urgent ticket
const ticketId = await createTicket({
  ...ticketData,
  priority: "URGENT",
  escalated: 1,
  escalation_reason: "User requested emergency support"
});

// Immediately notify senior support + admin
await whatsapp.send(SENIOR_SUPPORT_PHONE, `
🚨 *EMERGENCY TICKET CREATED*

Ticket: ${ticketId}
Member: ${member.business_name} (PREMIUM)
Phone: ${member.whatsapp_number}

Issue:
${ticketData.description}

━━━━━━━━━━━━━━━━━━━━━━
*IMMEDIATE ACTION REQUIRED*

Reply: RESPOND ${ticketId} [message]
Or call member directly: ${member.whatsapp_number}
`);

await whatsapp.send(userPhone, `
🚨 *URGENT TICKET CREATED*

Ticket: ${ticketId}

Our senior support team has been alerted.

You should receive a response within 15-30 minutes.

For immediate assistance, call:
📞 ${EMERGENCY_PHONE} (24/7)

We're here to help!
`);
}
```

---

## AUTO-ESCALATION (Premium SLA Breach)

**Cron Job - Run every hour:**
```javascript
async function checkSLABreaches() {
  const now = new Date();
  
  // Get all open premium tickets
  const premiumTickets = await erpnext.query("RIFAH Support Ticket", {
    member_tier: "PREMIUM",
    status: ["in", ["OPEN", "IN_PROGRESS"]],
    sla_breached: 0
  });
  
  for (const ticket of premiumTickets) {
    const hoursOpen = (now - new Date(ticket.created_at)) / (1000 * 60 * 60);
    
    // Premium SLA: 4 hours for first response, 8 hours total
    const slaLimit = ticket.first_response_at ? 8 : 4;
    
    if (hoursOpen > slaLimit) {
      // Breach detected!
      await erpnext.update("RIFAH Support Ticket", ticket.ticket_id, {
        sla_breached: 1,
        escalated: 1,
        escalation_reason: `SLA breached: ${hoursOpen.toFixed(1)} hours without ${ticket.first_response_at ? 'resolution' : 'first response'}`,
        priority: "URGENT"
      });
      
      // Notify senior support
      await whatsapp.send(SENIOR_SUPPORT_PHONE, `
⚠️ *SLA BREACH - AUTO-ESCALATION*

Ticket: ${ticket.ticket_id}
Member: ${ticket.member_name} (PREMIUM)
Type: ${ticket.ticket_type}
Assigned: ${ticket.assigned_to || 'Unassigned'}

Hours Open: ${hoursOpen.toFixed(1)} hrs
SLA Limit: ${slaLimit} hrs

Issue:
${ticket.description}

━━━━━━━━━━━━━━━━━━━━━━
*IMMEDIATE ACTION REQUIRED*

Dashboard: ${ERPNEXT_URL}/app/rifah-support-ticket/${ticket.ticket_id}
      `);
      
      // Notify member
      await whatsapp.send(ticket.member_phone, `
⚠️ *Premium SLA Protection Activated*

Ticket: ${ticket.ticket_id}

We noticed your ticket hasn't been resolved within our premium SLA.

Your ticket has been escalated to senior support and will be prioritized.

Expected resolution: Within 2 hours

For immediate assistance, call:
📞 ${PREMIUM_SUPPORT_PHONE}

We apologize for the delay.
      `);
    }
  }
}

// Run every hour
setInterval(checkSLABreaches, 60 * 60 * 1000);
```

---

## AGENT AVAILABILITY & ROUTING

**Find Available Agent Algorithm:**
```javascript
async function findAvailableAgent(ticketType, priority) {
  // Get all active agents for this department
  const agents = await erpnext.query("RIFAH Support Agent", {
    department: ticketType,
    is_active: 1,
    availability_status: ["in", ["AVAILABLE", "BUSY"]]
  }, {
    order_by: "current_ticket_count ASC"  // Least loaded first
  });
  
  // Filter available agents (not at capacity)
  const available = agents.filter(a => 
    a.current_ticket_count < a.max_concurrent_tickets
  );
  
  if (available.length === 0) {
    // All agents busy - assign to least loaded
    return agents[0] || null;
  }
  
  // For urgent tickets, prefer agents with lower ticket count
  if (priority === "URGENT") {
    return available[0];
  }
  
  // Otherwise, distribute evenly
  return available[Math.floor(Math.random() * available.length)];
}
```

---

## SESSION STATE REFERENCE

| current_step | Bot is waiting for |
|---|---|
| SUPPORT_CATEGORY | Main support option (1-5) |
| FAQ_CATEGORY | FAQ category or search query |
| FAQ_SELECT | FAQ number |
| FAQ_FEEDBACK | YES/NO feedback |
| TICKET_TYPE | Ticket type (1-6) |
| TICKET_DESC | Issue description |
| TICKET_ATTACH | YES/NO for attachment |
| TICKET_VIEW | Ticket ID or BACK |
| ACTIVE_CONVERSATION | User replying to open ticket |
| COMPLETED | Flow finished |

---

## N8N WORKFLOW ARCHITECTURE

### Main Support Path
- `IF Support Selected` — Menu option 5
- `Show Support Options` — 5 main options
- `Route by Option` — FAQ/Ticket/View/Contact/Emergency

### FAQ Path
- `Show FAQ Categories` — Query categories
- `IF Search Query` — Detect SEARCH keyword
- `Search FAQs` — Keyword matching algorithm
- `Display FAQs` — Numbered list
- `Send FAQ Answer` — Full answer
- `Collect Feedback` — YES/NO helpful
- `Update FAQ Stats` — Increment view/helpful counts

### Ticket Creation Path
- `Collect Ticket Type` — User selects category
- `Collect Description` — User types issue
- `IF Attach File` — Optional file upload
- `Determine Priority` — Algorithm based on keywords + tier
- `Find Available Agent` — Query agents, assign
- `Create Ticket` — POST to ERPNext
- `Notify User` — Confirmation with ticket ID
- `Notify Agent` — WhatsApp to assigned agent
- `Notify Admin` — Dashboard alert

### Ticket Conversation Path
- `Detect Active Ticket` — Check session data
- `IF User Reply` — Add to conversation log
- `Forward to Agent` — WhatsApp to agent
- `IF Agent Response` — RESPOND command
- `Forward to User` — WhatsApp to member
- `Update Ticket Status` — IN_PROGRESS

### Ticket Resolution Path
- `IF Agent Resolves` — RESOLVE command
- `Update Ticket` — Mark RESOLVED
- `Request User Confirmation` — YES/NO + rating
- `IF Confirmed` — Close ticket, update stats
- `IF Reopened` — Change status back to OPEN
- `Collect Rating` — 1-5 stars
- `Update Agent Stats` — Average rating, total resolved

### View Tickets Path
- `Query User Tickets` — GET by member_id
- `Format Ticket List` — Group by status
- `IF Ticket Selected` — Show full details
- `Load Conversation` — Display history
- `Set Active Ticket` — Enable conversation mode

### SLA Monitoring (Cron)
- `Check SLA Breaches` — Run hourly
- `IF Premium Breach` — Auto-escalate
- `Notify Senior Support` — Urgent alert
- `Notify Member` — Apology + escalation message
- `Update Ticket Priority` — Mark URGENT

---

## CRITICAL FIXES

### Fix 1: Agent Assignment Race Condition
```javascript
// Use database-level locking for concurrent ticket creation

async function assignTicketToAgent(ticketId, ticketType, priority) {
  // Start transaction
  await erpnext.db.sql("START TRANSACTION");
  
  try {
    const agent = await findAvailableAgent(ticketType, priority);
    
    if (agent) {
      // Lock agent row for update
      await erpnext.db.sql(`
        UPDATE \`tabRIFAH Support Agent\`
        SET current_ticket_count = current_ticket_count + 1
        WHERE agent_id = '${agent.agent_id}'
        AND current_ticket_count < max_concurrent_tickets
      `);
      
      // Commit transaction
      await erpnext.db.sql("COMMIT");
      
      return agent;
    }
    
    await erpnext.db.sql("ROLLBACK");
    return null;
    
  } catch (error) {
    await erpnext.db.sql("ROLLBACK");
    throw error;
  }
}
```

### Fix 2: Conversation Context Timeout
```javascript
// Clear active ticket from session after 30 minutes of inactivity

if (session_data.active_ticket_id) {
  const lastActivity = new Date(session_data.last_activity || session_data.created_at);
  const now = new Date();
  const minutesInactive = (now - lastActivity) / (1000 * 60);
  
  if (minutesInactive > 30) {
    // Clear active ticket
    delete session_data.active_ticket_id;
    
    await whatsapp.send(userPhone, `
Your ticket conversation has timed out due to inactivity.

To continue, reply *TICKETS* and select your ticket.
    `);
  }
}
```

### Fix 3: Handle Agent Offline
```javascript
// If no agents available, queue ticket and notify admin

if (!availableAgent) {
  await erpnext.create("RIFAH Support Ticket", {
    ...ticketData,
    assigned_to: null,
    status: "OPEN"
  });
  
  await whatsapp.send(userPhone, `
✅ Ticket ${ticketId} created.

All support agents are currently busy.

Your ticket is in the queue and will be assigned as soon as an agent becomes available.

Expected wait: ${priority === "URGENT" ? "15-30 minutes" : "1-2 hours"}
  `);
  
  // Alert admin about unassigned ticket
  await whatsapp.send(ADMIN_WHATSAPP, `
⚠️ Unassigned Ticket

Ticket: ${ticketId}
Priority: ${priority}
Type: ${ticketType}

All agents busy. Manual assignment may be needed.
  `);
}
```

---

## ENVIRONMENT VARIABLES

```bash
# Support Phone Numbers
GENERAL_SUPPORT_PHONE=18001234567
PREMIUM_SUPPORT_PHONE=919876543210
EMERGENCY_PHONE=919876543211
SENIOR_SUPPORT_PHONE=919876543212

# Email (optional)
SUPPORT_EMAIL=support@rifah.org
PREMIUM_EMAIL=premium@rifah.org
```

---

## TEST SCENARIOS

### Test Suite Overview

**Total Test Cases:** 10  
**Coverage:** FAQs, ticket creation, agent workflow, SLA monitoring  
**Execution Time:** ~20 minutes (manual) or ~3 minutes (automated)

---

### TEST 1: Browse and View FAQ

**Objective:** Verify FAQ browsing and tracking

**Prerequisites:**
- At least 20 FAQs in database across 3+ categories

**Test Steps:**

```
Step 1: Select Support
  Input: Hi → 5
  Expected: "💬 TALK TO RIFAH TEAM" with 5 options
  
Step 2: Browse FAQs
  Input: 1
  Expected: "❓ FREQUENTLY ASKED QUESTIONS"
  Expected: List of categories with counts
  
Step 3: Select category
  Input: 3 (Leads)
  Expected: List of top 10 FAQs in Leads category
  
Step 4: Select FAQ
  Input: 2
  Expected: FAQ question and full answer
  Expected: "Was this helpful? YES or NO"
  
Step 5: Mark helpful
  Input: YES
  Expected: "✅ Thank you for your feedback!"
```

**Verify in ERPNext:**
```sql
-- View count incremented
SELECT view_count FROM `tabRIFAH FAQ`
WHERE faq_id = 'FAQ-0002';
Expected: Increased by 1

-- Helpful count incremented
SELECT helpful_count FROM `tabRIFAH FAQ`
WHERE faq_id = 'FAQ-0002';
Expected: Increased by 1
```

---

### TEST 2: Search FAQs

**Test Steps:**

```
Step 1: Browse FAQs
  Input: Hi → 5 → 1
  
Step 2: Search
  Input: SEARCH payment issues
  Expected: "🔍 Search Results: 'payment issues'"
  Expected: Shows 3-5 matching FAQs
  Expected: FAQs contain keywords "payment" or "issues"
  
Step 3: Select result
  Input: 1
  Expected: Shows full FAQ answer
```

---

### TEST 3: Create Support Ticket (Technical Issue)

**Objective:** Complete ticket creation flow

**Prerequisites:**
- User registered as FREE member
- At least 1 active support agent

**Test Steps:**

```
Step 1: Create ticket
  Input: Hi → 5 → 2
  Expected: "🎫 CREATE SUPPORT TICKET"
  Expected: Shows 6 ticket types
  
Step 2: Select type
  Input: 1 (Technical Issue)
  Expected: "Please describe your issue in detail"
  
Step 3: Describe issue
  Input: App is showing error "500 Internal Server Error" when I try to post a lead. I've tried restarting but same problem.
  Expected: "Would you like to attach a screenshot?"
  
Step 4: Skip attachment
  Input: NO
  Expected: "✅ Support ticket created!"
  Expected: Shows ticket ID (TICKET-2024-XXXXXX)
  Expected: Shows priority (HIGH due to "error" keyword)
  Expected: "Expected Response Time: 24-48 hours" (free user)
  Expected: "Assigned to: [Agent Name]"
```

**Verify in ERPNext:**
```sql
-- Ticket created
SELECT * FROM `tabRIFAH Support Ticket`
WHERE member_id = 'RIF-FREE-2024-0001'
ORDER BY created_at DESC LIMIT 1;

Expected:
- ticket_type: TECHNICAL
- priority: HIGH
- status: OPEN
- assigned_to: Not null
- description contains "500 Internal Server Error"

-- Agent notified
Expected: Agent received WhatsApp with ticket details

-- Agent ticket count incremented
SELECT current_ticket_count FROM `tabRIFAH Support Agent`
WHERE agent_id = [assigned agent];
Expected: Increased by 1
```

---

### TEST 4: Agent Responds to Ticket

**Prerequisites:** Test 3 completed

**Test Steps:**

```
Step 1: Agent responds
  From: Agent phone
  Input: RESPOND TICKET-2024-000001 Thank you for reporting. Can you tell me which page you were on when this happened?
  
Step 2: User receives response
  Expected (to user): "🎫 Update on Ticket TICKET-2024-000001"
  Expected: Shows agent name and message
  Expected: "Reply to continue the conversation"
  
Step 3: User replies
  Input: I was on the "Share Lead" page, after selecting lead type
  
Step 4: Agent receives reply
  Expected (to agent): "🎫 Reply on Ticket TICKET-2024-000001"
  Expected: Shows user's message
  Expected: "Reply: RESPOND ... or RESOLVE ..."
```

**Verify:**
```sql
-- Conversation logged
SELECT conversation_log FROM `tabRIFAH Support Ticket`
WHERE ticket_id = 'TICKET-2024-000001';

Expected JSON:
[
  { from: "user", message: "App is showing error...", timestamp: "..." },
  { from: "agent", agent_name: "...", message: "Thank you for reporting...", timestamp: "..." },
  { from: "user", message: "I was on the Share Lead page...", timestamp: "..." }
]

-- Status updated
Expected: status = "IN_PROGRESS"
```

---

### TEST 5: Agent Resolves Ticket

**Prerequisites:** Test 4 completed

**Test Steps:**

```
Step 1: Agent resolves
  From: Agent phone
  Input: RESOLVE TICKET-2024-000001 Fixed! There was a server configuration issue. Please try posting a lead now and let me know if it works.
  
Step 2: User receives resolution
  Expected: "✅ Ticket TICKET-2024-000001 RESOLVED"
  Expected: Shows resolution notes
  Expected: "Is this issue resolved? Reply YES or NO"
  Expected: "If resolved, please rate your experience (1-5 stars)"
  
Step 3: User confirms and rates
  Input: 5
  Expected: "⭐⭐⭐⭐⭐ (5/5)"
  Expected: "Thank you for your feedback!"
  Expected: "Your ticket ... is now closed"
```

**Verify:**
```sql
-- Ticket closed
SELECT status, rating, resolved_at, closed_at 
FROM `tabRIFAH Support Ticket`
WHERE ticket_id = 'TICKET-2024-000001';

Expected:
- status: CLOSED
- rating: 5
- resolved_at: Not null
- closed_at: Not null

-- Agent stats updated
SELECT total_tickets_resolved, rating
FROM `tabRIFAH Support Agent`
WHERE agent_id = [assigned agent];

Expected:
- total_tickets_resolved: Increased by 1
- rating: Updated average (includes new 5-star rating)

-- Agent ticket count decremented
SELECT current_ticket_count FROM `tabRIFAH Support Agent`
WHERE agent_id = [assigned agent];
Expected: Decreased by 1
```

---

### TEST 6: User Reopens Ticket

**Prerequisites:** Test 5 completed

**Test Steps:**

```
Step 1: User says not resolved
  Input (when asked "Is this issue resolved?"): NO
  Expected: "Ticket ... has been reopened"
  Expected: "Please describe what's still not working"
  
Step 2: User provides details
  Input: Still showing the same error
  Expected: "Message sent to support team"
  
Step 3: Agent notified
  Expected (to agent): "⚠️ Ticket ... REOPENED by user"
```

**Verify:**
```sql
Expected: status changed from RESOLVED back to OPEN
```

---

### TEST 7: View My Tickets

**Prerequisites:** User has 2-3 tickets (open and resolved)

**Test Steps:**

```
Step 1: View tickets
  Input: Hi → 5 → 3
  Expected: "🎫 MY SUPPORT TICKETS"
  Expected: Shows "OPEN TICKETS (2)"
  Expected: Shows "RESOLVED (1)"
  Expected: Lists tickets with IDs, subjects, statuses
  
Step 2: Select ticket
  Input: TICKET-2024-000001
  Expected: Full ticket details
  Expected: Shows type, priority, status, assigned agent
  Expected: Shows complete conversation history
  Expected: "Reply to continue conversation" (if open)
```

---

### TEST 8: Premium User Creates Urgent Ticket

**Prerequisites:** Premium user registered

**Test Steps:**

```
Step 1: Create ticket
  Input: Hi → 5 → 2 → 1 (Technical)
  Input: URGENT: Payment gateway is down, we can't process orders!
  
  Expected: Priority automatically set to URGENT (keyword "urgent" + premium)
  Expected: "Expected Response Time: 4-8 hours" (premium SLA)
  
Step 2: Verify premium benefits
  Expected: Assigned to best available agent
  Expected: Admin receives high-priority alert
```

**Verify:**
```sql
Expected:
- priority: URGENT
- member_tier: PREMIUM
- SLA tracked with 4-8 hour limit
```

---

### TEST 9: SLA Breach Auto-Escalation (Premium)

**Objective:** Verify auto-escalation for premium SLA breach

**Test Setup:**
- Create premium ticket
- Wait 4+ hours (or mock system time)
- No agent response

**Test Steps:**

```
Step 1: Create premium ticket (same as Test 8)

Step 2: Wait 4 hours (mock time forward)

Step 3: Cron job runs
  Expected: System detects SLA breach (no first response in 4 hours)
  
Step 4: Auto-escalation triggered
  Expected (to senior support): "⚠️ SLA BREACH - AUTO-ESCALATION"
  Expected: Contains ticket details, hours open, member info
  Expected: "IMMEDIATE ACTION REQUIRED"
  
Step 5: User notified
  Expected (to user): "⚠️ Premium SLA Protection Activated"
  Expected: "Your ticket has been escalated to senior support"
  Expected: "Expected resolution: Within 2 hours"
```

**Verify:**
```sql
SELECT sla_breached, escalated, escalation_reason, priority
FROM `tabRIFAH Support Ticket`
WHERE ticket_id = 'TICKET-2024-XXXXXX';

Expected:
- sla_breached: 1
- escalated: 1
- escalation_reason: Contains "SLA breached: 4.X hours"
- priority: URGENT (upgraded if it wasn't already)
```

---

### TEST 10: Emergency Support (Premium Only)

**Test Steps:**

```
Step 1: Premium user requests emergency support
  Input: Hi → 5 → 5 (Emergency Support)
  Expected: "🚨 EMERGENCY SUPPORT"
  Expected: "Reply YES to create urgent ticket or CALL for phone number"
  
Step 2: Create emergency ticket
  Input: YES
  [Describe critical issue]
  
  Expected: Ticket created with priority URGENT
  Expected: escalated = 1
  Expected: "🚨 URGENT TICKET CREATED"
  Expected: "You should receive a response within 15-30 minutes"
  Expected: Shows emergency phone number
  
Step 3: Senior support notified
  Expected: "🚨 EMERGENCY TICKET CREATED"
  Expected: Marked for immediate action
```

**Test 10b: Free User Tries Emergency**
```
Step 1: Free user selects emergency
  Input: Hi → 5 → 5
  Expected: "🚨 EMERGENCY SUPPORT"
  Expected: "24/7 emergency support is available for PREMIUM members only"
  Expected: Shows upgrade prompt
  Expected: NO option to create emergency ticket
```

---

## AUTOMATED TEST SCRIPT

**File:** `test_suite/test_flow5.js`

```javascript
const assert = require('assert');
const { createTicket, respondAsAgent, resolveTicket } = require('./helpers');

describe('Flow 5: Talk to RIFAH Team', function() {
  this.timeout(30000);
  
  describe('FAQs', () => {
    it('should search FAQs by keywords', async () => {
      const results = await searchFAQs("payment issues");
      
      assert.ok(results.length > 0);
      assert.ok(results.every(faq => 
        faq.question.toLowerCase().includes('payment') ||
        faq.answer.toLowerCase().includes('payment')
      ));
    });
    
    it('should track FAQ views', async () => {
      const faq = await viewFAQ('FAQ-0001', 'RIF-FREE-2024-0001');
      
      assert.ok(faq.view_count > 0);
    });
  });
  
  describe('Ticket Management', () => {
    it('should create ticket with correct priority', async () => {
      const ticket = await createTicket({
        phone: '919876543210',
        type: 'TECHNICAL',
        description: 'ERROR: App is crashing when I click submit',
        tier: 'FREE'
      });
      
      assert.strictEqual(ticket.priority, 'HIGH');
      assert.strictEqual(ticket.status, 'OPEN');
      assert.ok(ticket.assigned_to);
    });
    
    it('should log conversation correctly', async () => {
      const ticket = await createTicket({...});
      
      await respondAsAgent(ticket.ticket_id, 'Can you provide more details?');
      
      const updated = await getTicket(ticket.ticket_id);
      const log = JSON.parse(updated.conversation_log);
      
      assert.strictEqual(log.length, 2);
      assert.strictEqual(log[0].from, 'user');
      assert.strictEqual(log[1].from, 'agent');
    });
    
    it('should update agent stats on resolution', async () => {
      const ticket = await createTicket({...});
      const agentBefore = await getAgent(ticket.assigned_to);
      
      await resolveTicket(ticket.ticket_id, 'Issue fixed', 5);
      
      const agentAfter = await getAgent(ticket.assigned_to);
      
      assert.strictEqual(
        agentAfter.total_tickets_resolved,
        agentBefore.total_tickets_resolved + 1
      );
      assert.ok(agentAfter.rating >= agentBefore.rating);
    });
  });
  
  describe('SLA Monitoring', () => {
    it('should detect SLA breach for premium tickets', async () => {
      const ticket = await createTicket({
        tier: 'PREMIUM',
        type: 'TECHNICAL'
      });
      
      // Mock time forward 5 hours
      await mockTimeForward(5 * 60 * 60 * 1000);
      
      // Run SLA check
      await checkSLABreaches();
      
      const updated = await getTicket(ticket.ticket_id);
      
      assert.strictEqual(updated.sla_breached, 1);
      assert.strictEqual(updated.escalated, 1);
      assert.strictEqual(updated.priority, 'URGENT');
    });
  });
});
```

---

## TEST DATA SETUP

**Script:** `scripts/setup_support_data.js`

```javascript
// Create 30 FAQs
const faqs = [
  {
    category: "REGISTRATION",
    question: "How do I register on RIFAH Connect?",
    answer: "Send 'Hi' to our WhatsApp number...",
    keywords: "register, signup, join, new member"
  },
  // ... 29 more
];

// Create 3 support agents
const agents = [
  {
    agent_name: "Rajesh Kumar",
    agent_phone: "919999999991",
    department: "TECHNICAL",
    max_concurrent_tickets: 5
  },
  {
    agent_name: "Priya Sharma",
    agent_phone: "919999999992",
    department: "BILLING",
    max_concurrent_tickets: 5
  },
  {
    agent_name: "Amit Patel",
    agent_phone: "919999999993",
    department: "GENERAL",
    max_concurrent_tickets: 10
  }
];
```

---

## TESTING CHECKLIST

**Before Testing:**
- [ ] ERPNext running
- [ ] At least 20 FAQs in database
- [ ] 3 support agents configured
- [ ] Agent WhatsApp numbers accessible
- [ ] SLA monitoring cron job deployed
- [ ] Free and premium users registered

**Core Functionality:**
- [ ] Test 1: Browse and view FAQ
- [ ] Test 2: Search FAQs
- [ ] Test 3: Create ticket (technical)
- [ ] Test 4: Agent responds
- [ ] Test 5: Agent resolves ticket
- [ ] Test 7: View my tickets

**Premium Features:**
- [ ] Test 8: Premium urgent ticket
- [ ] Test 9: SLA breach auto-escalation
- [ ] Test 10: Emergency support (premium vs free)

**Edge Cases:**
- [ ] Test 6: Reopen ticket
- [ ] Agent unavailable handling
- [ ] Concurrent ticket creation

**After Testing:**
- [ ] Conversation logs accurate
- [ ] Agent stats updated correctly
- [ ] SLA tracking working
- [ ] Escalations triggered properly
- [ ] Ratings stored

---

## DELIVERABLES CHECKLIST

- [ ] `doctypes/rifah_support_ticket.json`
- [ ] `doctypes/rifah_faq.json`
- [ ] `doctypes/rifah_support_agent.json`
- [ ] `n8n/rifah_flow5_workflow.json`
- [ ] `scripts/populate_faqs.js`
- [ ] `scripts/setup_support_agents.js`
- [ ] `scripts/sla_monitoring_cron.js`
- [ ] `test_suite/test_flow5.js`
- [ ] `documents/flow5_setup_guide.md`
- [ ] `documents/support_agent_handbook.md`
- [ ] `documents/sla_monitoring_guide.md`

---

END OF FLOW 5 MASTER PROMPT
