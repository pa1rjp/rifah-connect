# RIFAH Connect

WhatsApp Business Automation Platform built on **n8n**, **ERPNext (Frappe)**, and the **Meta Cloud API**.

---

## Overview

RIFAH Connect automates member registration, lead sharing, and engagement flows via WhatsApp. It integrates with ERPNext as the backend CRM/ERP and uses n8n for workflow orchestration.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Messaging | WhatsApp Cloud API (Meta) |
| Workflow Engine | n8n |
| Backend / CRM | ERPNext v15 (Frappe) |
| Infrastructure | Docker Compose |
| Tunnel (dev) | ngrok |

---

## Project Structure

```
rifah-connect-version1/
├── n8n/                    # n8n workflow exports (JSON)
├── master_prompts/         # AI prompt templates for each flow
├── documents/              # Guides, setup docs, AI integration reference
├── doctypes/               # ERPNext custom DocType definitions (JSON)
├── scripts/                # Reusable CLI + module utilities
│   ├── github.js           #   GitHub API (issues, labels, assignments)
│   └── erpnext.js          #   ERPNext API (sessions, members, cleanup)
├── test_suite/             # Integration tests for flows
├── misc/                   # Scratch data and utilities
├── docker-compose.yml      # Docker stack definition
├── package.json            # Node dependencies (dotenv)
└── push-to-github.sh       # Helper script to push changes
```

---

## Flows

| Flow | Description | Status |
|------|-------------|--------|
| Flow 1 | Member Registration / Profile Update (Free User) | ✅ Complete |
| Flow 2A | Share Lead — Free User | 🚧 In Progress |
| Flow 2B | Share Lead — Premium User | 🚧 In Progress |
| Flow 4 | Learn & Grow | 🚧 In Progress |
| Flow 5 | Talk to RIFAH Team | 🚧 In Progress |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- n8n instance (self-hosted or cloud)
- Meta WhatsApp Business account with a verified phone number
- ERPNext v15 site

### Environment Variables

Create a `.env` file in the project root:

```env
# Meta Cloud API
META_PHONE_NUMBER_ID=your_phone_number_id
META_ACCESS_TOKEN=your_access_token

# ERPNext
ERPNEXT_URL=http://localhost:8080
ERPNEXT_API_KEY=your_api_key
ERPNEXT_API_SECRET=your_api_secret
ERPNEXT_SITE=rifah.localhost

# Admin
ADMIN_WHATSAPP=91xxxxxxxxxx
NGROK_URL=https://your-ngrok-domain.ngrok-free.app

# GitHub (for scripts/github.js)
GITHUB_TOKEN=your_personal_access_token
GITHUB_REPO=your_username/rifah-connect
```

> Never commit `.env` to version control — it is git-ignored.

### Run with Docker

```bash
docker compose up -d
```

---

## n8n Workflows

Import the JSON files from the `n8n/` folder into your n8n instance:

1. Open n8n → **Workflows** → **Import from file**
2. Select the desired workflow JSON
3. Configure credentials (Meta API, ERPNext API)
4. Activate the workflow

---

## ERPNext Custom DocTypes

The `doctypes/` folder contains custom DocType definitions:

- `rifah_member.json` — Member profile
- `rifah_product_material.json` — Product/material catalogue
- `rifah_session.json` — Conversation session tracking

Import via Frappe bench:

```bash
bench import-doc [site] doctypes/rifah_member.json
```

---

## Testing

Install dependencies first:

```bash
npm install
```

Run the Flow 1 test suite:

```bash
node test_suite/test_flow1.js              # all suites
node test_suite/test_flow1.js --free       # FREE registration only
node test_suite/test_flow1.js --premium    # PREMIUM registration only
node test_suite/test_flow1.js --existing   # returning member flow
node test_suite/test_flow1.js --edge       # edge cases & validation
node test_suite/test_flow1.js --product    # product upload flow
node test_suite/test_flow1.js --clean      # wipe all test data
```

See [test_suite/README.md](test_suite/README.md) for details.

---

## Scripts

Reusable CLI utilities — also importable as Node modules.

**GitHub:**

```bash
node scripts/github.js list-issues
node scripts/github.js create-issue --title "..." --body "..." --labels "bug,flow-1"
node scripts/github.js close-issues 20 21 22
node scripts/github.js assign 25 26 --to pa1rjp
node scripts/github.js create-label --name "flow-3" --color "0075ca"
```

**ERPNext:**

```bash
node scripts/erpnext.js whoami
node scripts/erpnext.js list-sessions
node scripts/erpnext.js list-members
node scripts/erpnext.js get-session 919000000001
node scripts/erpnext.js clean 919000000001       # delete session + member
node scripts/erpnext.js clean-test-phones        # wipe all 5 test phone records
```

---

## License

Private — All rights reserved.
