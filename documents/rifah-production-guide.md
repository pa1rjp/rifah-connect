# RIFAH Connect — Complete Production Setup Guide
### Mac (Demo) → AWS (Production) | Includes All Fixes

---

## OVERVIEW

This guide documents the complete working setup for RIFAH Connect Flow 1 (Registration/Update). Every fix encountered during setup is included so you can replicate this cleanly on a new machine or move to production.

**What gets deployed:**
- ERPNext v15 (member database + admin dashboard)
- n8n (WhatsApp workflow automation)
- Meta Cloud API (WhatsApp Business)
- ngrok (HTTPS tunnel for local) or domain + SSL (production)

**Architecture:**
```
Customer WhatsApp
      ↓
Meta Cloud API (Webhook)
      ↓
ngrok HTTPS tunnel → n8n (localhost:5678)
      ↓
ERPNext (localhost:8080) ← stores sessions + members
```

---

## PART 1: PRE-REQUISITES

### 1.1 Docker Desktop (Mac)
- Install from: https://www.docker.com/products/docker-desktop
- After install: Docker Desktop → Settings → Resources → **set Memory to 8GB minimum**
- Apply & Restart

### 1.2 ngrok
```bash
brew install ngrok/ngrok/ngrok
```
- Sign up at https://ngrok.com (free)
- Get auth token from: https://dashboard.ngrok.com/get-started/your-authtoken
```bash
ngrok config add-authtoken YOUR_TOKEN
```
- Get free static domain: https://dashboard.ngrok.com/cloud-edge/domains → New Domain
- Save the domain (e.g. `lucky-fox-42.ngrok-free.app`) — it never changes

### 1.3 Meta Cloud API
1. Go to: https://developers.facebook.com → Create App → Other → Business
2. App name: `RIFAH Connect Demo`
3. Add product: **WhatsApp** → Set Up
4. Go to **WhatsApp → API Setup**
5. Copy and save:
   - **Phone Number ID** (e.g. `1051021614753488`)
   - **Temporary Access Token** (starts with `EAAG...`)

> ⚠️ Temporary token expires every 24 hours. Create a permanent token after setup (see Part 6).

---

## PART 2: PROJECT FILES

### 2.1 Folder Structure
```
rifah-connect/
├── docker-compose.yml
├── .env
├── doctypes/
│   ├── rifah_product_material.json
│   ├── rifah_member.json
│   └── rifah_session.json
└── n8n/
    └── rifah_flow1_workflow.json
```

### 2.2 Prepare the n8n Workflow JSON
Before importing, replace all variable placeholders with real values:

```bash
cd rifah-connect

sed -i '' \
  's|$vars.ERPNEXT_URL|http://frontend:8080|g; \
   s|http://backend:8000|http://frontend:8080|g; \
   s|\$vars.META_PHONE_NUMBER_ID|YOUR_PHONE_NUMBER_ID|g; \
   s|\$vars.META_VERIFY_TOKEN|rifah_verify_token_2024|g; \
   s|\$vars.ADMIN_WHATSAPP|91XXXXXXXXXX|g' \
  n8n/rifah_flow1_workflow.json
```

> **Mac note:** Use `sed -i ''` (with empty string) on Mac. Linux uses `sed -i` without quotes.

### 2.3 Fill in .env File
```
DB_ROOT_PASSWORD=rifah@db2024
ERPNEXT_ADMIN_PASSWORD=admin123
N8N_USER=rifah_admin
N8N_PASSWORD=rifah@n8n2024
META_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID
META_ACCESS_TOKEN=YOUR_META_ACCESS_TOKEN
ADMIN_WHATSAPP=91XXXXXXXXXX
NGROK_URL=https://YOUR-STATIC-DOMAIN.ngrok-free.app
```

---

## PART 3: DOCKER SETUP

### 3.1 Key Fix — FRAPPE_SITE_NAME_HEADER
The frontend nginx uses the Host header to find the site. By default it uses `$host` which is `localhost`, but the site is named `rifah.localhost`. This causes a 404.

**Fix in docker-compose.yml:**
```yaml
frontend:
  environment:
    - FRAPPE_SITE_NAME_HEADER=rifah.localhost   # ← hardcode this, never use $$host
```

### 3.2 Key Fix — Websocket Redis Connection
The websocket container crashes with `ECONNREFUSED 127.0.0.1:6379` if `common_site_config.json` doesn't exist when it starts. A `configurator` service must run first to create this file.

**Required service in docker-compose.yml:**
```yaml
configurator:
  image: frappe/erpnext:v15
  restart: "no"
  entrypoint:
    - bash
    - -c
    - |
      ls -1 apps > sites/apps.txt;
      bench set-config -g db_host mariadb;
      bench set-config -g db_port 3306;
      bench set-config -g redis_cache redis://redis-cache:6379;
      bench set-config -g redis_queue redis://redis-queue:6379;
      bench set-config -g redis_socketio redis://redis-cache:6379;
      bench set-config -g socketio_port 9000;
  volumes:
    - erpnext_sites:/home/frappe/frappe-bench/sites
  depends_on:
    mariadb:
      condition: service_healthy
```

**Websocket must use full Redis URLs and depend on configurator:**
```yaml
websocket:
  environment:
    - REDIS_CACHE=redis://redis-cache:6379      # ← full URL, not just host:port
    - REDIS_QUEUE=redis://redis-queue:6379
    - REDIS_SOCKETIO=redis://redis-cache:6379
  depends_on:
    backend:
      condition: service_started
    configurator:
      condition: service_completed_successfully  # ← wait for configurator
```

### 3.3 Start Services — Correct Order

```bash
# Step 1 — Infrastructure first
docker compose up -d mariadb redis-cache redis-queue

# Step 2 — Wait ~15 seconds for MariaDB to be healthy
docker compose ps   # mariadb should show (healthy)

# Step 3 — Run configurator (exits after writing config)
docker compose up -d configurator

# Step 4 — Wait for configurator to finish
docker compose ps -a | grep configurator
# Must show: Exited (0)   ← exit code 0 means success

# Step 5 — Start all other services
docker compose up -d backend frontend websocket queue-short queue-long scheduler n8n

# Step 6 — Create ERPNext site (10-15 min, watch until complete)
docker compose up create-site
# Wait for: "Site creation complete" + "exited with code 0"
```

### 3.4 Key Fix — MariaDB User IP Mismatch
If you ever run `docker compose down -v` and restart, ERPNext may show:
```
Access denied for user '_70dee1ce91aeac25'@'172.x.x.x'
```

This happens because the MariaDB user is locked to the old container IP. Fix:

```bash
# Get the db credentials
docker compose exec backend cat /home/frappe/frappe-bench/sites/rifah.localhost/site_config.json
# Note the db_name and db_password

# Recreate the user with wildcard host
docker compose exec mariadb mysql -uroot -prifah@db2024 -e "
DROP USER 'YOUR_DB_NAME'@'OLD_IP';
CREATE USER 'YOUR_DB_NAME'@'%' IDENTIFIED BY 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON \`YOUR_DB_NAME\`.* TO 'YOUR_DB_NAME'@'%';
FLUSH PRIVILEGES;
"

docker compose restart backend
```

---

## PART 4: ERPNEXT CONFIGURATION

### 4.1 Access ERPNext
- URL: **http://localhost:8080**
- Username: `Administrator`
- Password: `admin123`

### 4.2 Complete Setup Wizard
- Country: India
- Currency: INR
- Timezone: Asia/Kolkata
- Company Name: RIFAH Chamber of Commerce

### 4.3 Generate API Keys
1. Top right → click avatar → **My Profile**
2. Scroll to **API Access** → click **Generate Keys**
3. Save both values:
   - API Key: `abc123...`
   - API Secret: `xyz789...`
4. Format for n8n: `token API_KEY:API_SECRET`

### 4.4 Create Custom Doctypes (UI Method)

Import in this exact order — child table must be created first.

#### Doctype 1: RIFAH Product Material (Child Table)
URL: `http://localhost:8080/app/doctype/new-doctype-1`

- Name: `RIFAH Product Material`
- Module: `Core`
- Settings tab → tick **Is Child Table** ✅

Fields:
| Label | Fieldname | Fieldtype |
|-------|-----------|-----------|
| File Name | file_name | Data |
| File Type | file_type | Select (options: PDF, JPG, PNG, Other) |
| File | file_attachment | Attach |
| Meta Media ID | meta_media_id | Data |
| Uploaded On | uploaded_on | Datetime |

Save.

#### Doctype 2: RIFAH Session
URL: `http://localhost:8080/app/doctype/new-doctype-1`

- Name: `RIFAH Session`
- Module: `Core`
- Is Child Table: **NOT ticked**

Fields:
| Label | Fieldname | Fieldtype | Required | Unique |
|-------|-----------|-----------|----------|--------|
| Phone Number | phone_number | Data | ✅ | ✅ |
| Current Step | current_step | Data | | |
| Status | status | Select (Active, Completed, Expired) | | |
| Last Activity | last_activity | Datetime | | |
| Session Data | session_data | Long Text | | |
| Chat History | chat_history | Long Text | | |

Save.

#### Doctype 3: RIFAH Member
URL: `http://localhost:8080/app/doctype/new-doctype-1`

- Name: `RIFAH Member`
- Module: `Core`
- Is Child Table: **NOT ticked**

Fields:
| Label | Fieldname | Fieldtype | Notes |
|-------|-----------|-----------|-------|
| RIFAH ID | rifah_id | Data | Required, Unique |
| Full Name | full_name | Data | Required |
| WhatsApp Number | whatsapp_number | Data | Required, Unique |
| Business Name | business_name | Data | Required |
| City & State | city_state | Data | |
| Industry | industry | Data | |
| Years Operating | years_operating | Int | |
| Membership Tier | membership_tier | Select | Options: FREE, PREMIUM |
| Status | status | Select | Options: Pending Admin Review, Active Free, Pending Payment, Payment Uploaded, Active Premium, Suspended |
| RifahMart URL | rifahmart_url | Data | |
| RifahMart Status | rifahmart_status | Select | Options: Not Created, Published, Featured, Suspended |
| Dashboard Username | dashboard_username | Data | |
| Dashboard Password | dashboard_password | Password | |
| GST Document | gst_document | Attach | |
| Payment Screenshot | payment_screenshot | Attach | |
| Payment Transaction ID | payment_transaction_id | Data | |
| Product Materials | product_materials | Table | Options: RIFAH Product Material |
| Admin Notes | admin_notes | Text | |
| Groups Assigned | groups_assigned | Text | |
| Registration Date | registration_date | Datetime | |

Save.

---

## PART 5: n8n CONFIGURATION

### 5.1 Access n8n
- URL: **http://localhost:5678**
- Username: `rifah_admin`
- Password: `rifah@n8n2024`

### 5.2 Import Workflow
1. Left sidebar → Workflows
2. Top right → Add Workflow → Import from File
3. Upload `n8n/rifah_flow1_workflow.json`

### 5.3 Add Credentials
Go to: http://localhost:5678/home/credentials → Create credential

**Credential 1 — ERPNext API Auth:**
- Type: `Header Auth`
- Name: `Authorization`
- Value: `token YOUR_API_KEY:YOUR_API_SECRET`
- Rename credential to: `ERPNext API Auth`

**Credential 2 — Meta WhatsApp Auth:**
- Type: `Header Auth`
- Name: `Authorization`
- Value: `Bearer YOUR_META_ACCESS_TOKEN`
- Rename credential to: `Meta WhatsApp Auth`

### 5.4 Key Fix — Add Host Header to All ERPNext Nodes
ERPNext nginx needs to know which site to serve. Without this, API calls return 404.

For **every node** that calls ERPNext (Get Session, Get Member, Create Session, Update Session, Get/Create Free Member, Get/Create Premium Member, Upload File):

1. Click node → **Send Headers** toggle → ON
2. Add header:
   - Name: `Host`
   - Value: `rifah.localhost`

### 5.5 Key Fix — IF Node Conditions Lost on Re-import
After importing the workflow, all IF node conditions are empty. Add them manually:

**IF Valid Message:**
- Left value (fx): `{{ $json.skip }}`
- Operator: Boolean → `is false`
- Options → Add option → Type Validation → `Loose`

**IF Should Send Message:**
- Left value (fx): `{{ $json.shouldSendMsg }}`
- Operator: Boolean → `is true`

**IF New Session:**
- Left value (fx): `{{ $json.isNew }}`
- Operator: Boolean → `is true`

**Switch Action (3 rules):**
- Rule 1: `{{ $('State Machine').item.json.action }}` equals `create_free_member`
- Rule 2: `{{ $('State Machine').item.json.action }}` equals `create_premium_pending`
- Rule 3: `{{ $('State Machine').item.json.action }}` equals `download_doc`

### 5.6 Key Fix — Add Merge Node
Get Session and Get Member run in parallel. State Machine must wait for both. Without a Merge node, it crashes with "Node hasn't been executed".

1. Add a **Merge** node between them
2. Set Mode: `Append`
3. Connect: Get Session → Merge (input 1)
4. Connect: Get Member → Merge (input 2)
5. Connect: Merge → State Machine
6. Remove direct connections from Get Session/Get Member to State Machine

### 5.7 Key Fix — Update Session URL
The Update Session node URL must use `sessionName` (ERPNext document ID), not `phone`:

**Wrong:**
```
http://frontend:8080/api/resource/RIFAH Session/{{ $json.phone }}
```

**Correct:**
```
http://frontend:8080/api/resource/RIFAH Session/{{ $json.sessionName }}
```

### 5.8 Key Fix — n8n Variables Not Available
n8n Variables feature requires a paid plan. Instead, values are hardcoded directly in the workflow JSON using `sed` before import (see Part 2.2).

### 5.9 Reconnect Nodes After Re-import
After re-importing the workflow, verify all connections:

- WhatsApp Webhook POST → Extract Message
- Extract Message → IF Valid Message
- IF Valid Message (True) → Get Session
- IF Valid Message (True) → Get Member
- Get Session → Merge
- Get Member → Merge
- Merge → State Machine
- State Machine → IF Should Send Message
- State Machine → Prepare Session Upsert
- State Machine → Switch Action
- IF Should Send Message (True) → Send WhatsApp Message
- Prepare Session Upsert → IF New Session
- IF New Session (True) → Create Session
- IF New Session (False) → Update Session
- Switch Action (create_free) → Get Free Member Count
- Switch Action (create_premium) → Get Premium Member Count
- Switch Action (download_doc) → Get Media URL from Meta
- Get Free Member Count → Build Free Member Data → Create Free Member in ERPNext → Send Free Confirmation + Notify Admin Free
- Get Premium Member Count → Build Premium Member Data → Create Premium Pending in ERPNext → Notify Admin Premium
- Get Media URL from Meta → Download Media from Meta → Upload File to ERPNext

### 5.10 Activate Workflow
Top right → toggle **Inactive → Active** (turns green/Published)

---

## PART 6: META WEBHOOK SETUP

### 6.1 Start ngrok
```bash
ngrok http --domain=YOUR-STATIC-DOMAIN.ngrok-free.app 5678
```
Keep this terminal open at all times when running.

### 6.2 Configure Webhook in Meta
1. developers.facebook.com → Your App → WhatsApp → Configuration
2. Callback URL: `https://YOUR-STATIC-DOMAIN.ngrok-free.app/webhook/whatsapp-webhook`
3. Verify Token: `rifah_verify_token_2024`
4. Click **Verify and Save** → should show green checkmark

> ⚠️ Workflow must be **Active** in n8n before clicking Verify and Save, otherwise verification fails.

### 6.3 Key Fix — Webhook Verification Response
Meta expects a plain text response to the challenge. The Respond Webhook Verification node must be configured as:
- Respond With: `Text`
- Response Body: `{{ $json.challenge }}`
- Response Code: `200`
- Header: `Content-Type: text/plain`

### 6.4 Subscribe to Messages
On Meta Configuration page → Webhook Fields → click **Subscribe** next to `messages`.

### 6.5 Create Permanent Token (No Expiry)
The default token expires every 24 hours. Create a permanent one:

1. Go to: https://business.facebook.com → Settings → Users → System Users
2. Click **Add** → Name: `RIFAH Bot` → Role: Admin
3. Click **Assign assets** → Apps → select RIFAH Connect Demo → **Manage app** → Assign assets
4. Click **Generate token** → select app → expiration: **Never**
5. Permissions: `whatsapp_business_messaging` + `whatsapp_business_management`
6. Generate → copy token immediately
7. Update n8n credential: Meta WhatsApp Auth → Value: `Bearer NEW_TOKEN`

---

## PART 7: TESTING

### 7.1 Test the Full FREE Flow
Send from WhatsApp to your Meta test number:

| Step | Send | Expected Response |
|------|------|-------------------|
| 1 | `Hi` | Welcome menu with 5 options |
| 2 | `1` | Question 1: Full name |
| 3 | `Your Name` | Question 2: Business name |
| 4 | `Business Name` | Question 3: City & State |
| 5 | `Pune, Maharashtra` | Question 4: Industry |
| 6 | `Manufacturing` | Question 5: Years operating |
| 7 | `10` | Question 6: Confirm number |
| 8 | `YES` | Upload GST document |
| 9 | *(upload PDF/JPG)* | Upload product materials |
| 10 | `SKIP` | Membership tier selection |
| 11 | `FREE` | ✅ Registration complete with RIFAH ID |

### 7.2 Verify in ERPNext
- Sessions: http://localhost:8080/app/rifah-session
- Members: http://localhost:8080/app/rifah-member

### 7.3 Session State Reference
| current_step | Bot is waiting for |
|---|---|
| NEW | Initial message |
| MENU | Option 1-5 |
| Q1 | Full name |
| Q2 | Business name |
| Q3 | City & State |
| Q4 | Industry |
| Q5 | Years operating |
| Q6 | Phone confirmation |
| DOC_UPLOAD | GST/Udyam document |
| PRODUCT_UPLOAD | Product materials |
| TIER_SELECT | FREE or PREMIUM |
| PAYMENT_WAIT | Payment screenshot/transaction ID |

### 7.4 Reset a Session (for re-testing)
1. Go to: http://localhost:8080/app/rifah-session
2. Open the record for your phone number
3. Delete it
4. Send "Hi" again — starts fresh

---

## PART 8: DAILY USAGE

### Start Everything
```bash
# Terminal 1
cd rifah-connect
docker compose up -d

# Terminal 2
ngrok http --domain=YOUR-STATIC-DOMAIN.ngrok-free.app 5678
```

### Stop Everything
```bash
docker compose stop
```
Data is safe — stored in Docker volumes.

### Check All Services Running
```bash
docker compose ps
```
All services should show `Up`.

---

## PART 9: MOVING TO AWS PRODUCTION

### 9.1 AWS EC2 Recommended Specs
| Environment | Instance | RAM | Cost (approx) |
|---|---|---|---|
| Demo/Staging | t3.medium | 4GB | ₹3,500/month |
| Production | t3.large | 8GB | ₹7,000/month |

### 9.2 Migration Steps
```bash
# 1. Launch EC2 (Ubuntu 22.04)
# 2. Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu

# 3. Copy project files to EC2
scp -r rifah-connect/ ubuntu@YOUR_EC2_IP:~/

# 4. Update .env on EC2
# - Remove NGROK_URL line
# - Update META_ACCESS_TOKEN with permanent token
# - Change all passwords to strong production values

# 5. Start services
cd rifah-connect
docker compose up -d

# 6. Run site creation
docker compose up create-site
```

### 9.3 Add Domain + SSL
```bash
# Install Nginx + Certbot on EC2
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx reverse proxy for n8n
sudo nano /etc/nginx/sites-available/rifah

# Add SSL cert (free)
sudo certbot --nginx -d yourdomain.com

# Update Meta webhook URL to new domain
# https://yourdomain.com/webhook/whatsapp-webhook
```

### 9.4 What Client Pays For
- EC2 instance: ₹3,500-7,000/month
- Domain: ₹500-1,000/year
- Meta Cloud API: Free (up to 1,000 conversations/month)

---

## PART 10: TROUBLESHOOTING REFERENCE

| Problem | Cause | Fix |
|---------|-------|-----|
| ERPNext 404 | FRAPPE_SITE_NAME_HEADER is `$host` not `rifah.localhost` | Set to `rifah.localhost` in docker-compose.yml, recreate frontend |
| ERPNext 500 | DB user IP mismatch after restart | Recreate MariaDB user with `@'%'` wildcard host |
| Websocket crashes | `common_site_config.json` missing when websocket starts | Add configurator service, make websocket depend on it |
| Webhook not verified | Workflow not Active, or wrong verify token | Activate workflow first, check token matches exactly |
| Meta token expired | Temporary token used | Create permanent system user token |
| Session not updating | Update Session using `$json.phone` instead of `$json.sessionName` | Change URL to use `{{ $json.sessionName }}` |
| Bot resets every message | IF New Session condition empty | Add `{{ $json.isNew }}` is true condition |
| Flow goes to False branch | IF Valid Message condition empty | Add `{{ $json.skip }}` is false with Loose type validation |
| State Machine crashes | Get Member not executed before State Machine | Add Merge node, connect Get Session + Get Member → Merge → State Machine |
| ERPNext API 404 | Host header missing on API calls | Add `Host: rifah.localhost` header to all ERPNext HTTP nodes |
| n8n Variables not working | Paid feature on n8n | Hardcode values in workflow JSON using sed before import |
| ngrok URL changes | Free ngrok with dynamic URL | Use static domain from ngrok dashboard |

---

## APPENDIX: KEY URLS

| Service | URL | Credentials |
|---------|-----|-------------|
| ERPNext | http://localhost:8080 | Administrator / admin123 |
| n8n | http://localhost:5678 | rifah_admin / rifah@n8n2024 |
| ngrok Inspector | http://localhost:4040 | - |
| RIFAH Members | http://localhost:8080/app/rifah-member | - |
| RIFAH Sessions | http://localhost:8080/app/rifah-session | - |
| Meta Developer Console | https://developers.facebook.com | - |
| ngrok Dashboard | https://dashboard.ngrok.com | - |
