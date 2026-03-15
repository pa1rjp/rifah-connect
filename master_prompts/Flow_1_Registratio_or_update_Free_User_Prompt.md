I need to build a fully functioning end-to-end demo for RIFAH Connect's Registration/Update Flow (Flow 1). This will be demonstrated to the client, so it needs to work properly.

## PROJECT CONTEXT

RIFAH Connect is a WhatsApp Business Automation Platform for a chamber of commerce connecting 1 lakh+ businesses. The system has two membership tiers:
- FREE: ₹0/year - Manual support, 2-3 groups, basic features
- PREMIUM: ₹3,000/year - 24/7 bot, 5-10 groups, smart matching, dashboard access

## TECH STACK

- WhatsApp: Gupshup/WATI Business API
- Automation: n8n workflows
- Database: ERPNext (custom doctypes)
- Business Pages: RifahMart.com integration
- Server: VPS/Cloud (DigitalOcean/AWS)

## FLOW 1: REGISTRATION/UPDATE - COMPLETE SPECIFICATIONS

### USER ENTRY
User sends "Hi" to RIFAH WhatsApp number → Bot shows 5 options → User selects "1️⃣ Register/Update Business"

### STEP 1: CHECK PHONE NUMBER
- Check if phone number exists in ERPNext
- IF EXISTS: Ask "Update your profile or view current info?"
- IF NEW: Proceed to registration

### STEP 2: COLLECT DATA (6 QUESTIONS)
Ask one by one:
1. "What's your full name?"
2. "What's your business name?"
3. "Which city and state are you located in?"
4. "What industry/business type? (e.g., Manufacturing, Trading, Services)"
5. "How many years has your business been operating?"
6. "Confirm your WhatsApp contact number" (pre-filled, user confirms)

### STEP 3: DOCUMENT UPLOAD
Ask: "Please upload your business verification document:"
- "Udyam Registration Certificate OR GST Certificate"
- Accept: PDF, JPG, PNG
- Validate file received
- Store document reference in ERPNext

### STEP 4: PRODUCT MATERIALS UPLOAD (NEW FEATURE)
Ask: "Upload your product materials (optional but recommended):"
Options to upload:
- Product catalogs (PDF)
- Product images (JPG/PNG)
- Brochures/marketing materials (PDF)
- Allow multiple uploads
- User can skip or upload later
- Store all files with user profile

### STEP 5: CHOOSE MEMBERSHIP TIER
Present options:
Choose your membership tier:

🆓 FREE TIER (₹0/year) • Manual support • 2-3 WhatsApp groups • Basic RifahMart listing • 24-48 hour response

⭐ PREMIUM TIER (₹3,000/year) • 24/7 automated bot • 5-10 WhatsApp groups • Smart vendor matching • Dashboard access • Featured RifahMart listing • 2-4 hour response

Reply: FREE or PREMIUM


### STEP 6A: FREE TIER PROCESSING
If user chooses FREE:
1. Create profile in ERPNext
   - Generate ID: RIF-FREE-2024-XXXX (auto-increment)
   - Store all collected data
   - Status: "Pending Admin Review"
   
2. Auto-create RifahMart business page:
   - URL format: rifahmart.com/[RIFAH_ID]/[business-name-slug]
   - Populate with: Name, business, city, industry, contact
   - Include uploaded product catalogs/images
   - Status: "Published"
   
3. Notify admin:
   - Send task to admin queue (Priority: NORMAL, SLA: 24 hours)
   - Task: "Add [Business Name] to 2-3 relevant groups"
   - Include: City, Industry for group selection
   
4. Confirm to user:
✅ Registration Complete!

Your RIFAH ID: RIF-FREE-2024-XXXX

✓ Profile created ✓ RifahMart business page: rifahmart.com/RIF-FREE-2024-XXXX/[business-name] ✓ Admin will add you to 2-3 relevant WhatsApp groups within 24 hours

You'll receive a notification once added to groups.


### STEP 6B: PREMIUM TIER PROCESSING
If user chooses PREMIUM:
1. Request payment:
💳 Premium Membership: ₹3,000/year

Please make payment to: UPI: rifah@upi Bank: [Bank details]

After payment, upload screenshot or send transaction ID


2. Wait for payment proof upload

3. Notify admin for verification:
- Priority: URGENT, SLA: 2 hours
- Task: "Verify payment for [Business Name]"

4. Once admin approves (for demo, auto-approve after 5 seconds):
- Create profile in ERPNext
- Generate ID: RIF-PREM-2024-XXXX (auto-increment)
- Status: "Active Premium"

5. Auto-create RifahMart business page (same as free but "Featured"):
- URL: rifahmart.com/[RIFAH_ID]/[business-name-slug]
- Badge: "⭐ PREMIUM MEMBER"
- Higher visibility in listings

6. Create dashboard access:
- Generate login credentials
- Dashboard URL: dashboard.rifahmart.com

7. Notify admin:
- Priority: HIGH, SLA: 2 hours
- Task: "Add [Business Name] to 5-10 premium groups"

8. Confirm to user:
⭐ Premium Registration Complete!

Your RIFAH ID: RIF-PREM-2024-XXXX

✓ Premium profile activated ✓ Featured RifahMart page: rifahmart.com/RIF-PREM-2024-XXXX/[business-name] ✓ Dashboard access: dashboard.rifahmart.com Username: [phone] Password: [sent separately] ✓ Admin will add you to 5-10 groups within 2 hours

Welcome to RIFAH Premium! 🎉


## EXPECTED DELIVERABLES

Before you start building, please:

1. **VERIFY REQUIREMENTS** - Confirm you understand:
- The complete flow from "Hi" to final confirmation
- Difference between FREE and PREMIUM paths
- All 6 data collection questions
- Document upload requirements
- NEW: Product materials upload feature
- NEW: Auto-create RifahMart page feature
- ERPNext data structure needed
- Admin notification system

2. **ASK CLARIFYING QUESTIONS** - About:
- Any unclear steps
- Technical implementation choices
- Mock data vs real integration
- Demo scope (what can be simulated)

3. **AFTER CONFIRMATION, PROVIDE**:
- Complete n8n workflow JSON (importable)
- ERPNext custom doctype structure (JSON/SQL)
- Simulated WhatsApp interface (for demo)
- Mock RifahMart page template (HTML)
- Mock admin dashboard view
- Test scenarios with sample data
- Step-by-step setup instructions

## DEMO REQUIREMENTS

The demo should:
- ✅ Run end-to-end without errors
- ✅ Show both FREE and PREMIUM paths
- ✅ Display realistic messages and confirmations
- ✅ Generate proper IDs (RIF-FREE-XXXX, RIF-PREM-XXXX)
- ✅ Show mock RifahMart page creation
- ✅ Handle file uploads (at least simulate)
- ✅ Work on local machine or test server
- ✅ Be impressive for client presentation

## MY QUESTION TO YOU

Please start by:
1. Confirming you understand all requirements above
2. Asking any clarifying questions about the flow
3. Proposing the technical approach (n8n + ERPNext + mocks)
4. Outlining what will be real vs simulated for demo
5. Estimating setup time

Once I confirm, then provide the detailed implementation steps.

Ready? Let's verify first before building!