# RIFAH Connect — Flows Overview

> Complete reference for all WhatsApp automation flows: conversation scripts, state machine steps, ERPNext data written, and n8n workflow structure.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Registration Flow — Menu Option 1](#flow-1--member-registration--profile-update)
3. [Share Lead — Free User — Menu Option 2](#flow-2a--share-lead-free-user)
4. [Share Lead — Premium User — Menu Option 2](#flow-2b--share-lead-premium-user)
5. Find a Lead — Menu Option 3 *(Planned — not yet implemented)*
6. [Shared Infrastructure](#shared-infrastructure)
7. [ERPNext Custom DocTypes Reference](#erpnext-custom-doctypes-reference)

---

## Architecture Overview

```
User (WhatsApp)
      │
      ▼  POST /webhook/whatsapp-webhook
   n8n — RIFAH Connect (single unified workflow)
      │
      ├─ Menu option 1 ──► Registration flow
      │
      ├─ Menu option 2 ──► Share Lead
      │                      ├─ FREE member  ──► Free lead flow (AI questions → post to groups)
      │                      └─ PREMIUM member ► Premium lead flow (AI questions → smart matching)
      │
      ├─ Menu option 3 ──► Find a Lead  [🚧 Planned]
      │
      └─ All steps ────────► ERPNext (session, member, lead records)
                              Meta Cloud API (WhatsApp replies)
```

**Every flow** follows this pattern:
1. WhatsApp message arrives as POST to n8n webhook
2. n8n extracts `phone`, `message`, `message_type` from the Meta payload
3. n8n reads the `RIFAH Session` record for that phone from ERPNext
4. State machine determines which step the user is on and what reply to send
5. Session step is updated in ERPNext
6. Reply sent via Meta Cloud API

---

## Flow 1 — Member Registration / Profile Update

**File:** `n8n/RIFAH Connect - Flow 1 Registration.json`
**Webhook:** `POST /webhook/whatsapp-webhook`
**Status:** ✅ Complete (68/69 tests passing)
**Handles:** New FREE registrations, PREMIUM registrations, returning member profile updates

---

### Entry Point

Any WhatsApp message to the RIFAH number triggers Flow 1. If no session exists, one is created at step `MENU`.

---

### Main Menu (Step: MENU)

Bot sends:

```
Welcome to RIFAH Connect! 🏢

1️⃣ Register/Update Business
2️⃣ Share a Lead
3️⃣ Find Vendors/Buyers
4️⃣ Learn & Grow
5️⃣ Talk to RIFAH Team

Reply with a number (1-5)
```

User replies `1` → step moves to `Q1`
User replies `2` → step moves to `LEAD_TYPE` (hands off to Flow 2A)

---

### Registration Steps (Steps: Q1 → Q6)

| Step | Question | Validation |
|------|----------|------------|
| Q1 | "What's your full name?" | Min 2 chars |
| Q2 | "What's your business name?" | Min 2 chars |
| Q3 | "Which city and state?" | Min 3 chars |
| Q4 | "What industry/business type?" | Min 3 chars |
| Q5 | "How many years in business?" | Must be a number |
| Q6 | "Confirm your WhatsApp number:" (pre-filled) | User confirms |

All answers stored in `RIFAH Session → session_data` as JSON.

---

### Document Upload (Step: DOC_UPLOAD)

Bot asks for Udyam or GST certificate (PDF/JPG/PNG). On receipt, media ID stored in session. Advances to `PRODUCT_UPLOAD`.

---

### Product Upload (Step: PRODUCT_UPLOAD)

Bot asks for product catalogs/images (optional, multiple). User can type "skip". Advances to `TIER_SELECT`.

---

### Tier Selection (Step: TIER_SELECT)

```
Choose your membership tier:

🆓 FREE TIER (₹0/year)
• Manual support • 2-3 WhatsApp groups

⭐ PREMIUM TIER (₹3,000/year)
• 24/7 bot • 5-10 groups • Smart matching • Dashboard

Reply: FREE or PREMIUM
```

---

### FREE Path (Step: FREE_CONFIRM → DONE)

1. Creates `RIFAH Member` in ERPNext with `tier = FREE`, `status = Pending Admin Review`
2. Generates member ID: `RIF-FREE-YYYY-NNNN`
3. Sends admin notification (task: add member to 2-3 groups)
4. Confirms to user with member ID and RifahMart page URL

---

### PREMIUM Path (Step: PREMIUM_PAYMENT → PREMIUM_VERIFY → DONE)

1. Bot sends payment instructions (UPI/bank details)
2. User uploads payment screenshot
3. Admin notified (URGENT, 2-hour SLA)
4. For demo: auto-approved after short delay
5. Creates `RIFAH Member` with `tier = PREMIUM`, `status = Active Premium`
6. Generates `RIF-PREM-YYYY-NNNN` ID
7. Generates dashboard credentials (password stored in `dashboard_password` field)
8. Confirms to user with dashboard URL and login

**Note on password generation:** Uses `Math.random()` (not `crypto.getRandomValues()`) because n8n Task Runner sandbox does not expose the Web Crypto API.

---

### Existing Member Path (Step: EXISTING_CHOICE)

If phone is already registered:
```
Welcome back, [Name]! 👋

1️⃣ View my profile
2️⃣ Update my information
3️⃣ Main menu

Reply with 1, 2, or 3
```

---

### State Machine Summary (Flow 1)

```
MENU → Q1 → Q2 → Q3 → Q4 → Q5 → Q6 → DOC_UPLOAD → PRODUCT_UPLOAD → TIER_SELECT
                                                                           ↓          ↓
                                                                    FREE_CONFIRM  PREMIUM_PAYMENT
                                                                           ↓          ↓
                                                                         DONE   PREMIUM_VERIFY → DONE
```

Returning members: `MENU → EXISTING_CHOICE → (profile/update/menu)`

---

### ERPNext Records Written (Flow 1)

| DocType | When Created | Key Fields |
|---------|-------------|------------|
| RIFAH Session | On first message | phone, step, session_data |
| RIFAH Member | After tier confirmation | member_id, name, business_name, tier, status |
| RIFAH Product Material | During product upload | file references linked to member |

---

## Flow 2A — Share Lead (Free User)

**File:** `n8n/RIFAH Connect - Flow 2A Share Lead.json`
**Webhook:** `POST /webhook/flow2a-webhook`
**Status:** ✅ Complete (40/40 tests passing)
**Handles:** FREE members creating buy/sell/service leads, vendor qualification via AI, vendor matching and scoring

---

### Entry Point

User is an existing FREE member. Session step is set to `LEAD_TYPE` (either by the user texting "2" from the main menu in Flow 1, or by direct entry).

---

### Lead Collection Steps

#### Step: LEAD_TYPE

```
What type of lead would you like to share?

1️⃣ BUY — I want to buy something
2️⃣ SELL — I want to sell something
3️⃣ SERVICE NEED — I need a service
4️⃣ SERVICE OFFER — I offer a service

Reply 1-4
```

Session stores `lead_type` = `BUY` / `SELL` / `SERVICE NEED` / `SERVICE OFFER`.

#### Step: LEAD_DESC

"Please describe what you're looking for / offering (be specific):"

Min 10 characters. Stored in `description`.

#### Step: LEAD_LOC

"What city/region should this lead be posted to?"

Stored in `location`.

#### Step: LEAD_URGENCY

```
How urgent is this?

1️⃣ IMMEDIATE — Need within 48 hours
2️⃣ THIS WEEK — Within 1 week
3️⃣ THIS MONTH — Within 1 month
4️⃣ FLEXIBLE — No fixed timeline
```

#### Step: LEAD_BUDGET

"What is your approximate budget/price range? (e.g., ₹50,000 - ₹1,00,000)"

Stored in `budget`.

---

### AI Question Generation (Steps: AI_Q1 → AI_Q6)

After budget is collected, the workflow calls OpenAI (`gpt-4o-mini`) to generate 3–6 qualification questions tailored to the lead type and description.

**Prompt pattern:**
```
Generate 3-6 qualification questions for a [LEAD_TYPE] lead: "[description]"
Return as JSON: {"questions": ["q1", "q2", ...]}
```

**Fallback questions** (used if OpenAI fails):
- BUY: quantity, quality grade, delivery timeline, payment terms
- SELL: quantity available, packaging, minimum order, certifications
- SERVICE NEED: frequency, contract duration, existing vendor, budget flexibility
- SERVICE OFFER: team size, past clients, turnaround time, geographic coverage

Questions stored in session as `ai_questions` array. Bot sends one question at a time. Answers accumulated in `ai_answers`.

---

### Lead Creation (Step: LEAD_CREATE → action: create_lead)

After all AI questions answered:
1. n8n creates `RIFAH Lead` in ERPNext:
   - `lead_id`: `LEAD-[phone]-[timestamp]`
   - All collected data (type, description, location, urgency, budget, ai_qualification)
   - `status = Pending Admin Approval`
2. Admin notified via WhatsApp:
   ```
   🔔 New Lead from [Member Name]
   Type: BUY | Location: Mumbai
   Description: [...]
   Please review and approve posting.
   ```
3. User confirmation sent:
   ```
   ✅ Your lead has been submitted!
   Lead ID: LEAD-919...
   Our team will review and post to relevant groups within 4 hours.
   ```

---

### Vendor Response Flow

When a vendor (PREMIUM or FREE member) is matched to a lead, Flow 2A handles their qualification:

#### Step: VENDOR_INTRO (action: vendor_lead_lookup)

Bot sends lead summary to vendor:
```
📋 Opportunity Match!

A member is looking for: [description]
Location: [location]
Budget: [budget]

Are you interested? Reply YES to proceed or NO to pass.
```

#### Steps: VENDOR_Q1 → VENDOR_Q6 (action: generate_vendor_questions → send questions)

OpenAI generates 6 qualification questions for the vendor based on the lead type.

**Fallback vendor questions:**
- Years of experience
- Location and delivery radius
- Past clients / references
- Pricing model
- Certifications or compliance
- Availability

#### Step: VENDOR_SCORE (action: calculate_vendor_score)

After all vendor answers, compatibility score calculated (0–100):
- Base: 50 points
- +10 per direct answer to each of 5 key criteria
- Stored in session as `vendor_score`

Score sent to vendor:
```
📊 Your compatibility score: [score]/100

[Score >= 80]: Excellent match! 🎯
[Score 60-79]: Good match 👍
[Score < 60]:  Moderate match
```

#### Step: VENDOR_SUBMIT (action: submit_vendor_interest)

Vendor interest stored in `RIFAH Lead → interested_vendors` JSON array:
```json
{
  "vendor_id": "...",
  "vendor_name": "...",
  "compatibility_score": 85,
  "submitted_at": "2026-03-16 10:00:00"
}
```

Admin notified with vendor details. Vendor confirmation sent.

---

### State Machine Summary (Flow 2A)

```
LEAD_TYPE → LEAD_DESC → LEAD_LOC → LEAD_URGENCY → LEAD_BUDGET
                                                        ↓
                                              [OpenAI call]
                                                        ↓
                                              AI_Q1 → AI_Q2 → ... → AI_Q6
                                                        ↓
                                                  LEAD_CREATE ──→ DONE

Vendor path (parallel):
VENDOR_INTRO → [OpenAI call] → VENDOR_Q1 → ... → VENDOR_Q6 → VENDOR_SCORE → VENDOR_SUBMIT
```

**Non-Flow-2A steps** (MENU, Q1–Q6, DOC_UPLOAD, etc.) return `skip: true` so Flow 1 handles them.

---

### ERPNext Records Written (Flow 2A)

| DocType | When | Key Fields |
|---------|------|------------|
| RIFAH Session | Updated each step | step, session_data (ai_questions, ai_answers, lead_type, etc.) |
| RIFAH Lead | After AI questions answered | lead_id, member_id, lead_type, description, location, urgency, budget, ai_qualification, interested_vendors (JSON) |

---

### n8n Workflow Nodes (Flow 2A — 36 nodes)

| Node | Role |
|------|------|
| WhatsApp Webhook | Entry point (POST /webhook/flow2a-webhook) |
| Extract Message | Parse Meta payload → phone, message, message_type |
| IF Valid Message | Skip status updates, reactions, delivery receipts |
| Get Session | ERPNext GET /api/resource/RIFAH Session/{phone} |
| Get Member | ERPNext GET /api/resource/RIFAH Member — filter by phone |
| Merge | Combine session + member data |
| State Machine Lead | Code node — determines action + next step + reply text |
| IF Should Send Message | Skip if skip=true |
| Prepare Session Upsert | Build ERPNext PUT/POST body |
| Switch Action | Route by action field (6 outputs) |
| Create Lead in ERPNext | POST /api/resource/RIFAH Lead |
| Call OpenAI Lead Questions | HTTP POST to api.openai.com with gpt-4o-mini |
| Parse AI Lead Questions | Extract questions array from JSON response |
| Store AI Questions in Session | Update session_data with questions |
| Send AI Q1 to User | Meta Graph API send message |
| Get Lead for Vendor | ERPNext GET to find lead by ID in session |
| Build Vendor Intro | Format lead summary for vendor |
| Send Vendor Intro | Meta Graph API send message |
| Call OpenAI Vendor Questions | HTTP POST for vendor qualification questions |
| Parse AI Vendor Questions | Extract vendor questions |
| Store Vendor Questions in Session | Update session_data |
| Send Vendor Q1 to User | Meta Graph API send message |
| Calculate Vendor Score | Code node — 0-100 scoring algorithm |
| Update Session Score | Store score in session_data |
| Send Score to Vendor | Meta Graph API send message |
| Store Vendor Interest | Update RIFAH Lead interested_vendors JSON |
| Notify Admin Vendor Match | Meta Graph API to ADMIN_WHATSAPP |
| Send Vendor Confirmation | Meta Graph API send message |
| Notify Admin New Lead | Meta Graph API to ADMIN_WHATSAPP |
| Send Lead Confirmation | Meta Graph API send message to buyer |

---

## Flow 2B — Share Lead (Premium User)

**Status:** ✅ Complete
**Menu Option:** 2 (PREMIUM members only)
**Master prompt:** `master_prompts/flow2b_share_lead_premium.md`

### Key Differences from Flow 2A

| Feature | Flow 2A (FREE) | Flow 2B (PREMIUM) |
|---------|----------------|-------------------|
| Processing | Admin approval required | Instant auto-processing |
| Matching | Group posting only | Smart algorithm — top 10 vendors shown immediately |
| Results | Passive (wait for responses) | Active: user selects from list |
| Fallback | None | Auto-post to groups if no matches |
| Group badge | Regular post | "⭐ PREMIUM REQUEST" |
| Priority | Normal (4-hour SLA) | High (2-hour SLA) |

### Planned State Machine

```
LEAD_TYPE → LEAD_DESC → LEAD_LOC → LEAD_URGENCY → LEAD_BUDGET
                                                        ↓
                                              [Instant smart match]
                                                        ↓
                                     VENDOR_LIST (show top 10) → USER_SELECT
                                                        ↓
                                     [Admin approval → connection made]
                                                        ↓
                                              FALLBACK (if no matches)
                                                        ↓
                                              [Post to groups]
```

---

## Flow 4 — Learn & Grow

**Status:** 🚧 Planned
**Master prompt:** `master_prompts/flow4_learn_grow.md`

### Purpose

Provide members access to educational resources, training programs, webinars, and events curated by the chamber. No AI required — all content is pre-curated.

### Tier Access

| Feature | FREE | PREMIUM |
|---------|------|---------|
| Business Tips | Basic (10 articles) | Full library (100+ articles) |
| Video Tutorials | 5 basic videos | 50+ videos |
| Webinars | No access | Live + recordings |
| Training Programs | No access | Paid programs (discounted) |
| Certifications | No access | Chamber certificates |
| Events | Public events only | Exclusive member events |
| Mentorship | No access | 1-on-1 matching |

### Planned Doctypes

- **RIFAH Resource** — articles, videos, PDFs, webinars, events, training; fields: resource_id, title, type, category, access_tier, content_url
- **RIFAH Event** — event listings with date, venue, capacity, registrations

---

## Flow 5 — Talk to RIFAH Team

**Status:** 🚧 Planned
**Master prompt:** `master_prompts/flow5_talk_to_rifah_team.md`

### Purpose

Customer support ticketing, FAQ handling, and direct routing to RIFAH staff. Rule-based, no AI.

### SLA by Tier

| Feature | FREE | PREMIUM |
|---------|------|---------|
| Response SLA | 24-48 hours | 4-8 hours |
| Channels | Bot only | Bot + Phone + Email |
| Dedicated support | No | Yes |
| Escalation | No | Auto after 4 hours |

### Planned Doctype

- **RIFAH Support Ticket** — ticket_id, member_id, ticket_type, priority, status, assigned_to, conversation_log (JSON), sla_breached, escalated

---

## Shared Infrastructure

### n8n Credentials Required

| Credential Name | Type | Used By |
|----------------|------|---------|
| Meta_API_Auth | HTTP Header Auth (`Authorization: Bearer <token>`) | All flows |
| ERPNext auth (ID: TrXdy0OKoZPaxLo0) | HTTP Basic Auth | All flows |
| OpenAI_API_Auth | HTTP Header Auth (`Authorization: Bearer sk-...`) | Flow 2A, 2B |

### Webhook Paths

| Flow | Webhook Path | Method |
|------|-------------|--------|
| Flow 1 | `/webhook/whatsapp-webhook` | POST |
| Flow 2A | `/webhook/flow2a-webhook` | POST |
| Flow 2B | `/webhook/flow2b-webhook` (planned) | POST |
| Flow 4 | `/webhook/flow4-webhook` (planned) | POST |
| Flow 5 | `/webhook/flow5-webhook` (planned) | POST |

**Important:** n8n does not allow two active workflows to share the same webhook path + method.

### Session Step Ownership

Each flow owns a specific set of steps. Steps not owned by a flow return `skip: true`:

| Steps | Owned By |
|-------|---------|
| MENU, Q1–Q6, DOC_UPLOAD, PRODUCT_UPLOAD, TIER_SELECT, FREE_CONFIRM, PREMIUM_PAYMENT, PREMIUM_VERIFY, DONE, EXISTING_CHOICE | Flow 1 |
| LEAD_TYPE, LEAD_DESC, LEAD_LOC, LEAD_URGENCY, LEAD_BUDGET, AI_Q1–AI_Q6, LEAD_CREATE, VENDOR_INTRO, VENDOR_Q1–Q6, VENDOR_SCORE, VENDOR_SUBMIT | Flow 2A |

---

## ERPNext Custom DocTypes Reference

### RIFAH Member

| Field | Type | Notes |
|-------|------|-------|
| member_id | Data (unique) | RIF-FREE-YYYY-NNNN or RIF-PREM-YYYY-NNNN |
| full_name | Data | |
| business_name | Data | |
| phone | Data | E.164 format (91xxxxxxxxxx) |
| city_state | Data | |
| industry | Data | |
| years_in_business | Int | |
| tier | Select | FREE / PREMIUM |
| status | Select | Pending Admin Review / Active / Active Premium / Inactive |
| dashboard_password | Password | PREMIUM only; generated with Math.random() |
| doc_media_id | Data | WhatsApp media ID for verification doc |
| created_at | Datetime | YYYY-MM-DD HH:MM:SS format |

### RIFAH Session

| Field | Type | Notes |
|-------|------|-------|
| phone | Data (unique, name) | Lookup key |
| step | Data | Current state machine step |
| session_data | Long Text | JSON blob — all collected data |
| updated_at | Datetime | |

### RIFAH Lead

| Field | Type | Notes |
|-------|------|-------|
| lead_id | Data (unique, name) | LEAD-{phone}-{timestamp} |
| member_id | Data | Submitting member |
| member_name | Data | |
| member_phone | Data | |
| tier | Select | FREE / PREMIUM |
| lead_type | Select | BUY / SELL / SERVICE NEED / SERVICE OFFER |
| title | Data | Auto-generated summary |
| description | Text | User's description |
| location | Data | City/region |
| urgency | Select | IMMEDIATE / THIS WEEK / THIS MONTH / FLEXIBLE |
| budget | Data | Free-text budget range |
| ai_qualification | Long Text | JSON: AI questions + answers |
| status | Select | Pending Admin Approval / Approved / Active / Closed / Rejected |
| posted_to_groups | Check | |
| interested_vendors | Long Text | JSON array of vendor interest objects |
| connection_made | Check | |
| followup_scheduled | Datetime | |
| created_at | Datetime | |

### RIFAH WhatsApp Group

| Field | Type | Notes |
|-------|------|-------|
| group_id | Data (unique, name) | |
| group_name | Data | |
| group_jid | Data (unique) | WhatsApp JID (e.g. `120363...@g.us`) |
| city | Data | |
| state | Data | |
| industry | Data | Industry focus |
| lead_types | Data | JSON array of supported lead types |
| active_members | Int | |
| is_active | Check | |
| created_at | Datetime | |

### RIFAH Product Material

| Field | Type | Notes |
|-------|------|-------|
| member_id | Link (RIFAH Member) | |
| file_name | Data | |
| file_type | Select | PDF / JPG / PNG |
| media_id | Data | WhatsApp media ID |
| uploaded_at | Datetime | |

---

## Common Bugs & Solutions

| Bug | Symptom | Fix |
|-----|---------|-----|
| `crypto is not defined` in n8n Code node | Build Premium Member Data node fails | Use `Math.random()` — Task Runner sandbox blocks crypto API |
| ERPNext `CannotCreateStandardDoctypeError` | Doctype creation fails | Add `"custom": 1` and `"module": "Custom"` to doctype JSON |
| `ValidationError: Non administrator user can not set the role All` | Doctype creation fails | Only include `System Manager` in permissions, remove `All` role |
| `OperationalError: Incorrect datetime value` | ERPNext rejects datetime | Use `YYYY-MM-DD HH:MM:SS` format, not ISO 8601 with `Z` suffix |
| Two workflows conflict on same webhook path | Second workflow returns 404 | Give each flow a unique webhook path |
| ERPNext Password field returns `***` | Test can't verify password format | Check field is non-empty instead of checking format |
| `compatibility_score` appears as `undefined` | Vendor score not saved | Field was named `score` in Store Vendor Interest node — rename to `compatibility_score` |
