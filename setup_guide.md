# RIFAH Connect — Complete Mac Setup Guide
### Intel MacBook → Docker → Live WhatsApp Bot → AWS-Ready

---

## WHAT YOU'LL HAVE AT THE END

- ✅ ERPNext running at `http://localhost:8080`
- ✅ n8n running at `http://localhost:5678`
- ✅ WhatsApp bot live on your Meta number
- ✅ Customers message → ERPNext gets populated automatically
- ✅ Admin gets WhatsApp notification on each registration
- ✅ Same setup migrates to AWS with zero changes

**Total time: ~90 minutes (60 min waiting for downloads)**

---

## BEFORE YOU START — 2 CHECKS

### Check 1: Docker RAM allocation
ERPNext needs at least 6GB RAM. By default Docker Desktop on Mac only gets 2GB.

1. Open **Docker Desktop**
2. Click **Settings** (gear icon, top right)
3. Click **Resources**
4. Set Memory to **8 GB** (if your Mac has 16GB) or **6 GB** (if 8GB Mac)
5. Click **Apply & Restart**

To check your Mac's RAM:
```bash
system_profiler SPHardwareDataType | grep Memory
```

### Check 2: Free disk space
ERPNext images are ~3GB. You need at least **10GB free**.
```bash
df -h ~
```

---

## STEP 1: GET THE FILES

Download the RIFAH Connect zip and extract it. You should have this structure:
```
rifah-connect/
├── docker-compose.yml
├── .env
├── setup_guide.md          ← this file
├── doctypes/
│   ├── rifah_member.json
│   ├── rifah_session.json
│   └── rifah_product_material.json
└── n8n/
    └── rifah_flow1_workflow.json
```

Open Terminal and navigate to the folder:
```bash
cd ~/Downloads/rifah-connect
```

---

## STEP 2: INSTALL ngrok

ngrok creates a permanent HTTPS tunnel to your local machine.
Meta Cloud API REQUIRES HTTPS — this is not optional.

```bash
# Install via Homebrew
brew install ngrok/ngrok/ngrok
```

No Homebrew? Install it first:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Create free ngrok account:**
1. Go to https://ngrok.com → Sign up (free)
2. Copy your Auth Token from: https://dashboard.ngrok.com/get-started/your-authtoken
3. Run:
```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

**Get your free static domain:**
1. Go to: https://dashboard.ngrok.com/cloud-edge/domains
2. Click **"Create Domain"** → you'll get something like `lucky-fox-42.ngrok-free.app`
3. Save this URL — it never changes, even after restarts

---

## STEP 3: SETUP META CLOUD API (20 min)

You need this BEFORE starting Docker because n8n needs your Meta credentials.

### 3.1 Create Meta App
1. Go to: https://developers.facebook.com
2. Click **My Apps → Create App**
3. Use case: **"Other"** → Next
4. App type: **"Business"** → Next
5. App name: `RIFAH Connect Demo`
6. Click **Create App**

### 3.2 Add WhatsApp Product
1. Inside your app → Find **"WhatsApp"** → Click **Set Up**
2. Connect to a WhatsApp Business Account (create one if needed — it's free)

### 3.3 Get Your Credentials
Go to: **WhatsApp → API Setup**

Copy these two values — you'll need them in the next step:
- **Phone Number ID** (looks like: `123456789012345`)
- **Temporary Access Token** (starts with `EAAG...`)

> ⚠️ The temporary token expires in 24 hours. For demo use it's fine.
> For production, create a System User Token — covered in the AWS migration guide.

### 3.4 Add a Test Phone Number
In WhatsApp → API Setup, you'll see a test phone number is given to you.
Add your personal WhatsApp number under "To" field → Click Send → verify the test message arrives.

---

## STEP 4: CONFIGURE YOUR .env FILE

Open the `.env` file in any text editor:
```bash
nano .env
```

Fill in these values:
```
META_PHONE_NUMBER_ID=your_phone_number_id_from_step_3
META_ACCESS_TOKEN=your_access_token_from_step_3
ADMIN_WHATSAPP=91XXXXXXXXXX   ← your WhatsApp number (for admin alerts)
NGROK_URL=https://your-static-domain.ngrok-free.app   ← from step 2
```

Save: `Ctrl+X → Y → Enter`

---

## STEP 5: START DOCKER SERVICES

```bash
# Make sure you're in the rifah-connect folder
cd ~/Downloads/rifah-connect

# Pull all images first (this takes 10-15 min, only once)
docker compose pull

# Start everything EXCEPT the site creator
docker compose up -d mariadb redis-cache redis-queue backend frontend websocket queue-short queue-long scheduler n8n
```

Check everything is running:
```bash
docker compose ps
```

All services should show `Up` or `running`. If any show `Exit`, run:
```bash
docker compose logs [service-name]
```

---

## STEP 6: CREATE THE ERPNEXT SITE (15 min wait)

This runs once and creates your ERPNext database site:

```bash
docker compose up create-site
```

Watch the logs — it will show:
```
Waiting for sites/common_site_config.json...
Site creation complete
```

**This takes 10-15 minutes.** Get a coffee.

Verify it worked:
```bash
docker compose logs create-site | tail -5
```
Should show: `✓ Site created successfully`

---

## STEP 7: CONFIGURE ERPNEXT

### 7.1 Open ERPNext
Go to: **http://localhost:8080**

Login:
- Username: `Administrator`
- Password: `admin123`

### 7.2 Complete Setup Wizard
1. Language: English
2. Country: **India**
3. Timezone: **Asia/Kolkata**
4. Currency: **INR**
5. Company Name: **RIFAH Chamber of Commerce**
6. Skip employee setup → click through to finish

### 7.3 Generate API Key (IMPORTANT)
1. Top right → click your avatar → **My Account**
2. Click **API Access** section
3. Click **Generate Keys**
4. **SAVE BOTH VALUES** — API Key and API Secret. You cannot see the secret again.

You'll use them in n8n as:
```
token YOUR_API_KEY:YOUR_API_SECRET
```

### 7.4 Import Custom Doctypes

In ERPNext: Go to **Customization → DocType → (menu) → Import**

Import in this exact order (child table must come first):

1. Upload `doctypes/rifah_product_material.json` → Import
2. Upload `doctypes/rifah_member.json` → Import
3. Upload `doctypes/rifah_session.json` → Import

Verify they exist:
- http://localhost:8080/app/rifah-member → should load list view
- http://localhost:8080/app/rifah-session → should load list view

---

## STEP 8: CONFIGURE n8n

### 8.1 Open n8n
Go to: **http://localhost:5678**

Login:
- Username: `rifah_admin`
- Password: `rifah@n8n2024`

### 8.2 Import Workflow
1. Left sidebar → **Workflows**
2. Top right → **Add Workflow → Import from File**
3. Upload `n8n/rifah_flow1_workflow.json`
4. Workflow appears with 28 nodes

### 8.3 Add Credentials

Go to: **Credentials** (left sidebar) → **Add Credential**

**Credential 1 — ERPNext:**
- Type: `HTTP Header Auth`
- Name: `ERPNext API Auth`
- Header Name: `Authorization`
- Header Value: `token YOUR_API_KEY:YOUR_API_SECRET`
- Save

**Credential 2 — Meta WhatsApp:**
- Type: `HTTP Header Auth`
- Name: `Meta WhatsApp Auth`
- Header Name: `Authorization`
- Header Value: `Bearer YOUR_META_ACCESS_TOKEN`
- Save

### 8.4 Attach Credentials to Workflow

Open the imported workflow:

1. Click **"Get Session"** node → Credentials → select `ERPNext API Auth`
2. Click **"Get Member"** node → select `ERPNext API Auth`
3. Click **"Create Session"** node → select `ERPNext API Auth`
4. Click **"Update Session"** node → select `ERPNext API Auth`
5. Click **"Create Free Member in ERPNext"** node → select `ERPNext API Auth`
6. Click **"Create Premium Pending in ERPNext"** node → select `ERPNext API Auth`
7. Click **"Get Free Member Count"** node → select `ERPNext API Auth`
8. Click **"Get Premium Member Count"** node → select `ERPNext API Auth`
9. Click **"Upload File to ERPNext"** node → select `ERPNext API Auth`
10. Click **"Send WhatsApp Message"** node → select `Meta WhatsApp Auth`
11. Click **"Send Free Confirmation"** node → select `Meta WhatsApp Auth`
12. Click **"Notify Admin Free"** node → select `Meta WhatsApp Auth`
13. Click **"Notify Admin Premium"** node → select `Meta WhatsApp Auth`
14. Click **"Get Media URL from Meta"** node → select `Meta WhatsApp Auth`
15. Click **"Download Media from Meta"** node → select `Meta WhatsApp Auth`

### 8.5 Set n8n Variables

Go to: **Settings** (bottom left) → **Variables** → **Add Variable**

| Name | Value |
|------|-------|
| `ERPNEXT_URL` | `http://backend:8000` |
| `META_PHONE_NUMBER_ID` | your phone number ID |
| `META_VERIFY_TOKEN` | `rifah_verify_token_2024` |
| `ADMIN_WHATSAPP` | `91XXXXXXXXXX` |

### 8.6 Activate Workflow

Top right of workflow → toggle **Inactive → Active**

---

## STEP 9: START ngrok

Open a **new Terminal tab** — keep this running permanently while demoing:

```bash
ngrok http --domain=YOUR-STATIC-DOMAIN.ngrok-free.app 5678
```

You'll see:
```
Forwarding  https://your-static-domain.ngrok-free.app → http://localhost:5678
```

---

## STEP 10: CONFIGURE META WEBHOOK

### 10.1 Set Webhook URL
1. Meta Developer Console → Your App → WhatsApp → Configuration
2. **Webhook URL:** `https://your-static-domain.ngrok-free.app/webhook/whatsapp-webhook`
3. **Verify Token:** `rifah_verify_token_2024`
4. Click **Verify and Save** → should show green checkmark

### 10.2 Subscribe to Messages
Under Webhook Fields:
- Click **Subscribe** next to `messages`

---

## STEP 11: TEST IT

Send **"Hi"** from your WhatsApp to your Meta test number.

Within 3 seconds you should receive:
```
👋 Welcome to RIFAH Connect!
Connecting 1 Lakh+ Businesses
...
```

If nothing comes back → check n8n Executions (left sidebar) for errors.

---

## DAILY STARTUP (after first setup)

When you open your Mac and want to demo:

```bash
# Terminal 1 — Start Docker services
cd ~/Downloads/rifah-connect
docker compose up -d

# Terminal 2 — Start ngrok tunnel
ngrok http --domain=YOUR-STATIC-DOMAIN.ngrok-free.app 5678
```

That's it. ERPNext: http://localhost:8080 | n8n: http://localhost:5678

---

## DAILY SHUTDOWN

```bash
docker compose stop
```
Data is preserved in Docker volumes — nothing is lost.

---

## TROUBLESHOOTING

| Problem | What to check |
|---------|--------------|
| ERPNext not loading at :8080 | `docker compose logs frontend` |
| Webhook not verified in Meta | Is ngrok running? Is verify token exact? |
| n8n not getting messages | Check Meta webhook subscription to `messages` |
| ERPNext API 403 error in n8n | Re-generate API keys, update n8n credential |
| "Site not found" in ERPNext | `docker compose logs create-site` — may need to rerun |
| Docker memory errors | Increase Docker Desktop RAM to 8GB |
| n8n workflow not firing | Is workflow toggled to Active? |

---

## MOVING TO AWS (when client confirms)

This entire setup moves to AWS in ~2 hours:

```bash
# On your AWS EC2 instance (t3.large recommended, ~₹7,000/month)
# Or t3.medium for start (~₹3,500/month)

# 1. Install Docker on EC2
sudo apt update && sudo apt install -y docker.io docker-compose-plugin

# 2. Copy your rifah-connect folder to EC2
scp -r rifah-connect/ ubuntu@YOUR_EC2_IP:~/

# 3. Update .env:
#    - Replace NGROK_URL with your domain/EC2 IP
#    - Update META_ACCESS_TOKEN with permanent token

# 4. Start
cd rifah-connect
docker compose up -d

# 5. Point your domain DNS → EC2 IP
# 6. Add SSL with Certbot (free)
# 7. Update Meta webhook URL to new domain
```

**Client pays for:** EC2 instance + domain (₹3,500-7,000/month)
**You charge for:** Setup + maintenance

---

## FOLDER STRUCTURE REFERENCE

```
rifah-connect/
├── docker-compose.yml      ← All services defined here
├── .env                    ← Your credentials (never commit this)
├── doctypes/               ← Import into ERPNext
│   ├── rifah_member.json
│   ├── rifah_session.json
│   └── rifah_product_material.json
└── n8n/
    └── rifah_flow1_workflow.json   ← Import into n8n
```
