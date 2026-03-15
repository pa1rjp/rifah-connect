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
├── test_suite/             # Integration tests for flows
├── misc/                   # Scratch data and utilities
├── docker-compose.yml      # Docker stack definition
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

Copy `.env.example` to `.env` and fill in your values:

```env
META_PHONE_NUMBER_ID=your_phone_number_id
META_ACCESS_TOKEN=your_access_token
ERPNEXT_URL=https://your-erpnext-site
ERPNEXT_API_KEY=your_api_key
ERPNEXT_API_SECRET=your_api_secret
```

> Never commit `.env` to version control.

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

```bash
cd test_suite
node test_flow1.js
```

See [test_suite/README.md](test_suite/README.md) for details.

---

## License

Private — All rights reserved.
