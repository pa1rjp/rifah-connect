# RIFAH Connect

WhatsApp Business Automation Platform built on **n8n**, **ERPNext (Frappe)**, and the **Meta Cloud API**.

---

## Overview

RIFAH Connect automates member registration, lead sharing, and engagement flows via WhatsApp for a chamber of commerce connecting 1 lakh+ businesses across India. It integrates with ERPNext as the backend CRM and uses n8n for workflow orchestration.

See [documents/flows_overview.md](documents/flows_overview.md) for a full explanation of every flow, step-by-step logic, and state machine details.

---

## Tech Stack

| Component | Technology |
| --------- | --------- |
| Messaging | WhatsApp Cloud API (Meta) |
| Workflow Engine | n8n (self-hosted) |
| Backend / CRM | ERPNext v15 (Frappe) |
| AI | OpenAI GPT-4o-mini |
| Infrastructure | Docker Compose |
| Tunnel (dev) | ngrok static domain |

---

## Project Structure

```text
rifah-connect-version1/
├── n8n/                    # n8n workflow exports (JSON)
│   ├── RIFAH Connect - Flow 1 Registration.json
│   └── RIFAH Connect - Flow 2A Share Lead.json
├── master_prompts/         # AI prompt templates for each flow
├── documents/              # Guides, setup docs, flow documentation
│   ├── flows_overview.md   #   ← Complete flow reference (start here)
│   ├── setup_guide.md
│   ├── rifah-production-guide.md
│   └── AI_Integration_Guide.md
├── doctypes/               # ERPNext custom DocType definitions (JSON)
│   ├── rifah_member.json
│   ├── rifah_session.json
│   ├── rifah_product_material.json
│   ├── rifah_lead.json
│   └── rifah_whatsapp_group.json
├── scripts/                # Reusable CLI + module utilities
│   ├── github.js           #   GitHub API (issues, labels, assignments)
│   └── erpnext.js          #   ERPNext API (sessions, members, leads, cleanup)
├── test_suite/             # Integration tests for flows
│   ├── test_flow1.js       #   Flow 1 test suite (68/69 passing)
│   ├── test_flow2a.js      #   Flow 2A test suite (40/40 passing)
│   └── README.md
├── misc/                   # Scratch data and utilities
├── docker-compose.yml      # Docker stack definition
├── package.json            # Node dependencies (dotenv)
└── push-to-github.sh       # Helper script to push changes
```

---

## Flows

| Flow | Description | Status | Test Score |
| ---- | ----------- | ------ | ---------- |
| Flow 1 | Member Registration / Profile Update | ✅ Complete | 68/69 (99%) |
| Flow 2A | Share Lead — Free User | ✅ Complete | 40/40 (100%) |
| Flow 2B | Share Lead — Premium User | 🚧 Planned | — |
| Flow 4 | Learn & Grow | 🚧 Planned | — |
| Flow 5 | Talk to RIFAH Team | 🚧 Planned | — |

> For detailed flow descriptions, conversation scripts, and state machine diagrams, see [documents/flows_overview.md](documents/flows_overview.md).

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Meta WhatsApp Business account with a verified phone number
- ERPNext v15 site (included in Docker stack)
- ngrok account with a static domain (for dev webhook)

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

# OpenAI (required for Flow 2A/2B AI questions)
OPENAI_API_KEY=sk-...

# Admin
ADMIN_WHATSAPP=91xxxxxxxxxx
NGROK_URL=https://your-ngrok-domain.ngrok-free.app

# GitHub (for scripts/github.js)
GITHUB_TOKEN=your_personal_access_token
GITHUB_REPO=your_username/rifah-connect

# Test webhook URLs
N8N_WEBHOOK_URL=https://your-ngrok-domain.ngrok-free.app/webhook/whatsapp-webhook
N8N_FLOW2A_WEBHOOK_URL=https://your-ngrok-domain.ngrok-free.app/webhook/flow2a-webhook
```

> Never commit `.env` to version control — it is git-ignored.

### Run with Docker

```bash
docker compose up -d
docker compose ps        # verify all services are healthy
```

### Import n8n Workflows

```bash
# Copy and import Flow 1
docker cp "n8n/RIFAH Connect - Flow 1 Registration.json" rifah_n8n:/tmp/flow1.json
docker exec rifah_n8n n8n import:workflow --input=/tmp/flow1.json
docker exec rifah_n8n n8n publish:workflow --id=rifah-connect-flow1

# Copy and import Flow 2A
docker cp "n8n/RIFAH Connect - Flow 2A Share Lead.json" rifah_n8n:/tmp/flow2a.json
docker exec rifah_n8n n8n import:workflow --input=/tmp/flow2a.json
docker exec rifah_n8n n8n publish:workflow --id=flow2a-share-lead-001

docker restart rifah_n8n
```

---

## ERPNext Custom DocTypes

The `doctypes/` folder contains all custom DocType definitions. They are created automatically via the ERPNext REST API — no bench commands needed.

| DocType | Purpose |
| ------- | ------- |
| `rifah_member.json` | Member profile (FREE/PREMIUM) |
| `rifah_session.json` | Conversation session & step tracking |
| `rifah_product_material.json` | Product/material catalogue |
| `rifah_lead.json` | Lead records (buy/sell/service needs) |
| `rifah_whatsapp_group.json` | WhatsApp group registry for lead posting |

To create doctypes via API (requires ERPNext API key):

```bash
node scripts/erpnext.js create-doctypes   # creates all missing custom doctypes
```

---

## Testing

```bash
npm install          # install dotenv dependency
```

### Flow 1 Tests

```bash
node test_suite/test_flow1.js              # all suites
node test_suite/test_flow1.js --free       # FREE registration only
node test_suite/test_flow1.js --premium    # PREMIUM registration only
node test_suite/test_flow1.js --existing   # returning member flow
node test_suite/test_flow1.js --edge       # edge cases & validation
node test_suite/test_flow1.js --product    # product upload flow
node test_suite/test_flow1.js --clean      # wipe all test data
```

### Flow 2A Tests

```bash
node test_suite/test_flow2a.js             # all suites
node test_suite/test_flow2a.js --infra     # infrastructure check only
node test_suite/test_flow2a.js --buyer     # buyer lead happy path
node test_suite/test_flow2a.js --variants  # lead type variants
node test_suite/test_flow2a.js --vendor    # vendor response flow
node test_suite/test_flow2a.js --edge      # edge cases
node test_suite/test_flow2a.js --clean     # wipe all Flow 2A test data
```

See [test_suite/README.md](test_suite/README.md) for details on the testing approach.

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
node scripts/erpnext.js clean 919000000001       # delete session + member + leads
node scripts/erpnext.js clean-test-phones        # wipe all test phone records
```

---

## Known Limitations (Dev Environment)

| Limitation | Details |
| ---------- | ------- |
| Crypto API in n8n Task Runner | `crypto.getRandomValues()` is not available in the n8n sandboxed Code node — use `Math.random()` instead |
| ERPNext Password fields | GET API returns `***` for Password fields; field presence is verified instead of value format |
| Webhook GET verification | Meta sends a GET request to verify webhooks; n8n workflows only handle POST — verified separately |
| Group posting algorithm | Flow 2A marks leads as `posted_to_groups: 1` but actual group message distribution is not yet implemented |
| Admin approval commands | `APPROVE`/`REJECT`/`MORE` commands from admin WhatsApp are not yet wired to update RIFAH Lead status |

---

## License

Private — All rights reserved.
