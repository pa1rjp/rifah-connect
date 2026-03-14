# RIFAH Connect — Automated Test Suite

## How It Works

The test script **bypasses WhatsApp entirely** and sends fake message payloads directly to the n8n webhook endpoint. This is the same JSON format Meta sends, so n8n processes it identically to a real WhatsApp message.

```
Test Script → POST fake payload → n8n webhook
                                       ↓
                              n8n runs full flow
                                       ↓
                         ERPNext session/member updated
                                       ↓
                      Test script reads ERPNext to verify
```

No real WhatsApp, no Meta API calls, no cost.

---

## Setup

### 1. No dependencies needed
The script uses Node.js built-in `http` module only — no npm install required.

### 2. Fill in CONFIG values
Open `test_flow1.js` and fill in the top section:

```javascript
const CONFIG = {
  erpnext_api_key: 'YOUR_API_KEY',        // from ERPNext → My Profile → API Access
  erpnext_api_secret: 'YOUR_API_SECRET',  // same place
  meta_phone_number_id: 'YOUR_PHONE_ID',  // from Meta Developer Console
  ...
}
```

### 3. Make sure services are running
```bash
docker compose up -d
ngrok http --domain=YOUR-DOMAIN.ngrok-free.app 5678
```

---

## Running Tests

```bash
# Run all test suites
node test_flow1.js

# Run specific suite only
node test_flow1.js --free       # FREE registration flow
node test_flow1.js --premium    # PREMIUM registration flow
node test_flow1.js --existing   # Returning user flow
node test_flow1.js --edge       # Edge cases / invalid inputs

# Clean all test data from ERPNext
node test_flow1.js --clean
```

---

## What Each Suite Tests

### Suite 1: FREE Registration Flow
- Hi → main menu appears (session created at MENU)
- Select 1 → Q1 step
- Answer each question → step advances correctly
- All answers saved in session_data JSON
- Reaches DOC_UPLOAD step

### Suite 2: PREMIUM Registration Flow
- Same 6 questions as FREE
- Verifies step transitions identical to FREE until tier selection
- File upload and payment tested manually

### Suite 3: Existing User Flow
- Creates a member in ERPNext directly
- Sends Hi from same number
- Verifies bot detects existing member (EXISTING_CHOICE step)
- Tests view profile option

### Suite 4: Edge Cases
- Invalid menu option → stays at MENU
- Single character name → rejected, stays at Q1
- Text for years field → rejected, stays at Q5

### Suite 5: ERPNext Connectivity (always runs first)
- ERPNext API reachable and authenticated
- RIFAH Member doctype exists
- RIFAH Session doctype exists
- n8n webhook verification endpoint working

---

## What Cannot Be Automated

These require a real file upload via WhatsApp and cannot be simulated:

| Step | Why manual |
|------|-----------|
| GST document upload | Meta media API needed to get real media ID |
| Product materials upload | Same reason |
| Payment screenshot upload | Same reason |

**Workaround for these:** Test them manually once after each deployment.
Use the automated suite for all text-based step verification.

---

## Example Output

```
╔════════════════════════════════════════╗
║   RIFAH Connect — Flow 1 Test Suite   ║
╚════════════════════════════════════════╝

▶ TEST SUITE 5: ERPNext API Connectivity
──────────────────────────────────────────────────
  → Checking ERPNext is reachable...
  ✓ ERPNext reachable — logged in as: Administrator
  ✓ RIFAH Member doctype accessible
  ✓ RIFAH Session doctype accessible
  ✓ n8n webhook verification endpoint working

▶ TEST SUITE 1: FREE Registration Flow
──────────────────────────────────────────────────
  → Cleaning up previous test data...
  → Step 1: Send "Hi" → expect main menu
  ✓ Session created with step = MENU
  → Step 2: Send "1" → expect Q1
  ✓ Step moved to Q1 after selecting 1
  ...
  ✓ full_name saved correctly in session
  ✓ business_name saved correctly
  ✓ city_state saved correctly

══════════════════════════════════════════════════
  TEST SUMMARY
══════════════════════════════════════════════════
  ✓ Passed: 24
  ✗ Failed: 0

  Score: 100% (24/24)
══════════════════════════════════════════════════
```

---

## Integrating with Your Workflow

Run before every demo:
```bash
node test_flow1.js && echo "✅ All good, ready to demo"
```

Run after every workflow change in n8n:
```bash
node test_flow1.js --free --edge
```

Clean and full re-test:
```bash
node test_flow1.js --clean && node test_flow1.js
```
