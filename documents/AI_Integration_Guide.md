# AI Integration Guide for RIFAH Connect
## Model Comparison, Pricing & Implementation

**Last Updated:** March 2026  
**Project:** RIFAH Connect WhatsApp Business Automation Platform  
**Use Case:** AI-powered lead qualification and vendor matching

---

## 📋 TABLE OF CONTENTS

1. [Use Case Overview](#use-case-overview)
2. [Cost Comparison](#cost-comparison)
3. [Detailed Analysis](#detailed-analysis)
4. [Recommendations](#recommendations)
5. [Implementation Guides](#implementation-guides)
6. [Cost Projections](#cost-projections)
7. [Migration Guide](#migration-guide)

---

## 🎯 USE CASE OVERVIEW

### What We Need AI For:

**Lead Qualification (Flow 2A & 2B):**
- Generate 3-6 intelligent follow-up questions based on user's requirement description
- Example: User says "Need plastic bottles" → AI asks about capacity, material, quantity, certifications
- Format: Must return valid JSON with questions array

**Vendor Qualification (Flow 2A & 2B):**
- Generate 6 validation questions to check if vendor can fulfill the requirement
- Example: For plastic bottles → AI asks about FSSAI certification, production capacity, pricing
- Format: Must return JSON with questions and answer types (yes_no or text)

**Requirements:**
- Indian B2B business context (lakhs, crores, rupees, Indian certifications)
- Structured JSON output (critical for n8n automation)
- Fast response time (< 3 seconds)
- Reliable and consistent quality
- Cost-effective at scale

**Volume Estimates:**
- Conservative: 100-500 leads/day
- Medium: 1,000-2,000 leads/day  
- Peak: 5,000-10,000 leads/day
- Each lead = 2 AI calls (buyer + vendor qualification)

---

## 💰 COST COMPARISON

### Per-Request Pricing (March 2026)

| Provider | Model | Input (per 1M tokens) | Output (per 1M tokens) | Total per Request* |
|----------|-------|----------------------|------------------------|-------------------|
| **OpenAI** | GPT-4o-mini | $0.15 | $0.60 | $0.0003 |
| **OpenAI** | GPT-4o | $2.50 | $10.00 | $0.0040 |
| **OpenAI** | GPT-3.5-turbo | $0.50 | $1.50 | $0.0007 |
| **Google** | Gemini 1.5 Flash | $0.075 | $0.30 | $0.0001 |
| **Google** | Gemini 1.5 Pro | $1.25 | $5.00 | $0.0020 |
| **Anthropic** | Claude Sonnet 4 | $3.00 | $15.00 | $0.0060 |
| **Anthropic** | Claude Haiku 4 | $0.25 | $1.25 | $0.0005 |
| **Self-hosted** | Llama 3.1 8B | FREE | FREE | $0.00** |

\* Assumes ~200 input tokens + ~300 output tokens per qualification  
\** Hardware/electricity costs not included

### Cost per 1,000 Leads (2 AI calls each)

| Model | Cost per Lead | Cost per 1K Leads | Cost per 10K Leads | Cost per Month (30K leads) |
|-------|---------------|-------------------|--------------------|-----------------------------|
| **GPT-4o-mini** ⭐ | $0.0006 | $0.60 | $6.00 | $18.00 (₹1,500) |
| **Gemini Flash** 🏆 | $0.0002 | $0.20 | $2.00 | $6.00 (₹500) |
| **Claude Haiku 4** | $0.0010 | $1.00 | $10.00 | $30.00 (₹2,500) |
| **GPT-4o** | $0.0080 | $8.00 | $80.00 | $240.00 (₹20,000) |
| **Claude Sonnet 4** | $0.0120 | $12.00 | $120.00 | $360.00 (₹30,000) |

**Exchange Rate:** $1 = ₹83 (approx)

---

## 📊 DETAILED ANALYSIS

### 🥇 OPTION 1: OpenAI GPT-4o-mini (RECOMMENDED)

**Pricing:**
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- **Cost per lead qualification: ₹0.025** (two calls)

**Pros:**
- ✅ Excellent cost-performance ratio
- ✅ Very reliable and consistent
- ✅ Great JSON structured output support
- ✅ Fast response time (1-2 seconds)
- ✅ 128K context window (huge)
- ✅ Understands Indian business context well
- ✅ Extensive documentation and community support
- ✅ n8n has native OpenAI integration
- ✅ Proven at scale (millions of requests/day)

**Cons:**
- ❌ Requires internet connection
- ❌ Data sent to OpenAI servers (privacy concern for some)
- ❌ Subject to OpenAI's rate limits (reasonable for our scale)

**Best For:**
- Production deployment with moderate to high volume
- When reliability and consistency matter most
- Teams without deep ML expertise
- Budget-conscious but quality-focused projects

**Free Tier:**
- New accounts: $5 free credit (~16,000 lead qualifications)
- Trial period: 3 months

---

### 🥈 OPTION 2: Google Gemini 1.5 Flash (CHEAPEST)

**Pricing:**
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- **Cost per lead qualification: ₹0.008** (two calls)

**Pros:**
- ✅ **70% cheaper** than GPT-4o-mini
- ✅ Very fast response time
- ✅ Good enough for simple question generation
- ✅ 1M token context window (massive)
- ✅ Free tier available (1,500 requests/day)
- ✅ Excellent for high-volume use cases

**Cons:**
- ❌ Sometimes inconsistent JSON formatting
- ❌ Smaller community / fewer examples
- ❌ Requires additional parsing/validation
- ❌ Less reliable for complex prompts
- ❌ May need prompt engineering tweaks

**Best For:**
- Extremely high volume (100K+ leads/month)
- When budget is the primary concern
- Simpler use cases (basic question generation)
- Experimenting/testing before committing

**Free Tier:**
- 1,500 requests/day free (enough for testing)
- Rate limit: 15 requests/minute

---

### 🥉 OPTION 3: Anthropic Claude Haiku 4

**Pricing:**
- Input: $0.25 per 1M tokens
- Output: $1.25 per 1M tokens
- **Cost per lead qualification: ₹0.042** (two calls)

**Pros:**
- ✅ Best understanding of nuanced requirements
- ✅ Excellent at Indian business context
- ✅ Great JSON output (very structured)
- ✅ Strong reasoning capabilities
- ✅ Good balance of cost and quality

**Cons:**
- ❌ 67% more expensive than GPT-4o-mini
- ❌ 5x more expensive than Gemini Flash
- ❌ No significant quality gain for our use case
- ❌ Smaller context window (200K vs 128K GPT-4o-mini)

**Best For:**
- When you need best-in-class reasoning
- Complex industry-specific qualifications
- High-value transactions (enterprise B2B)

---

### 💻 OPTION 4: Self-Hosted Llama 3.1 8B (FREE)

**Pricing:**
- API calls: FREE
- Hardware: Your existing Mac or VPS
- Electricity: ~₹500-1000/month (if running 24/7)

**Setup Requirements:**
- Mac M1/M2/M3 (recommended) OR Intel Mac with 16GB+ RAM
- OR Cloud GPU instance (AWS g4dn.xlarge ~$0.50/hr = $360/month)
- Ollama or LocalAI for serving
- 5-10GB disk space for model

**Pros:**
- ✅ **Zero API costs** after setup
- ✅ Complete data privacy (nothing leaves your server)
- ✅ No rate limits
- ✅ Works offline
- ✅ Break-even after ~20,000 leads vs GPT-4o-mini
- ✅ Full control over model behavior

**Cons:**
- ❌ Requires technical setup (2-4 hours)
- ❌ Slower inference on CPU (5-10 seconds)
- ❌ Need to maintain/update infrastructure
- ❌ Lower quality than commercial models
- ❌ May need fine-tuning for best results
- ❌ Your Intel Mac will struggle (needs M1+ for speed)

**Best For:**
- Very high volume (500K+ leads/month)
- Privacy-critical deployments
- Long-term cost optimization
- Teams with ML/DevOps expertise

**Break-Even Analysis:**

| Scenario | GPT-4o-mini Cost | Self-hosted Cost | Break-even Volume |
|----------|------------------|------------------|-------------------|
| Mac M1/M2 (you own) | $0.0006/lead | $0/lead | Immediate |
| Cloud GPU (rent) | $0.0006/lead | $360/month | 600,000 leads/month |

**Verdict:** Only worth it if:
- You have Mac M1+ already
- Expecting 500K+ leads/month long-term
- Have DevOps resources to manage it

---

### ❌ OPTION 5: Premium Models (NOT RECOMMENDED)

**GPT-4o ($0.004/lead) & Claude Sonnet 4 ($0.006/lead)**

**Why NOT recommended:**
- 10-20x more expensive
- Overkill for simple question generation
- No significant quality improvement
- Your budget won't sustain at scale

**Only consider if:**
- Extremely complex requirements (rare in B2B)
- High-value enterprise clients (₹10L+ deals)
- Need best reasoning for critical decisions

---

## 🎯 RECOMMENDATIONS

### DECISION MATRIX

| Your Situation | Recommended Model | Monthly Cost (30K leads) |
|----------------|-------------------|--------------------------|
| **Just starting, need reliability** | GPT-4o-mini ⭐ | ₹1,500 |
| **Budget extremely tight** | Gemini Flash 🏆 | ₹500 |
| **High volume (100K+ leads/month)** | Gemini Flash | ₹1,500 |
| **Privacy critical** | Self-hosted Llama | ₹500-1,000 (electricity) |
| **Enterprise B2B (high-value)** | Claude Haiku | ₹2,500 |

---

### RECOMMENDED APPROACH: START WITH GPT-4o-mini

**Phase 1: Launch (Month 1-3)**
- Use: **GPT-4o-mini**
- Why: Proven, reliable, good cost-performance
- Budget: ₹500-2,000/month
- Focus: Get product-market fit

**Phase 2: Scale (Month 4-6)**
- If volume > 50K leads/month: Consider **Gemini Flash**
- Why: 70% cost savings at scale
- Budget: ₹500-1,500/month even at 100K leads

**Phase 3: Optimize (Month 7+)**
- If volume > 500K leads/month: Evaluate **Self-hosted**
- Why: Significant cost savings
- Investment: ₹50,000-1,00,000 setup + ₹10,000/month

---

## 🔧 IMPLEMENTATION GUIDES

### OPTION 1: OpenAI GPT-4o-mini Integration

#### Step 1: Get API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up / Log in
3. Click "Create new secret key"
4. Copy key: `sk-proj-xxxxxxxxxxxxx`
5. Add $5-10 credit (get $5 free for new accounts)

#### Step 2: Add to Environment

```bash
# Add to .env file
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
```

#### Step 3: Test API Connection

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "You are a B2B requirement qualification assistant for Indian businesses."
      },
      {
        "role": "user",
        "content": "Generate 3 questions about plastic bottle requirements. Return JSON."
      }
    ],
    "temperature": 0.7,
    "max_tokens": 500,
    "response_format": { "type": "json_object" }
  }'
```

#### Step 4: n8n Integration

**HTTP Request Node Configuration:**

```javascript
// Node: "Call OpenAI - Lead Qualification"
{
  "method": "POST",
  "url": "https://api.openai.com/v1/chat/completions",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "openAiApi",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "model",
        "value": "gpt-4o-mini"
      },
      {
        "name": "messages",
        "value": [
          {
            "role": "system",
            "content": "You are helping qualify B2B business requirements for an Indian marketplace connecting 1 lakh+ businesses."
          },
          {
            "role": "user",
            "content": "User's requirement:\nType: {{ $json.lead_type }}\nDescription: {{ $json.lead_description }}\nLocation: {{ $json.lead_location }}\n\nGenerate 3-6 specific follow-up questions to understand:\n- Exact specifications\n- Quantity requirements\n- Quality standards or certifications\n- Timeline\n- Special requirements\n\nReturn ONLY valid JSON:\n{\n  \"questions\": [\n    \"Question 1?\",\n    \"Question 2?\",\n    ...\n  ]\n}"
          }
        ]
      },
      {
        "name": "temperature",
        "value": 0.7
      },
      {
        "name": "max_tokens",
        "value": 500
      },
      {
        "name": "response_format",
        "value": {
          "type": "json_object"
        }
      }
    ]
  }
}
```

**Parse Response Node:**

```javascript
// Node: "Parse OpenAI Response"
const response = $input.item.json;
const content = response.choices[0].message.content;
const questions = JSON.parse(content).questions;

return {
  questions: questions,
  question_count: questions.length
};
```

#### Step 5: Error Handling

```javascript
// Add Try-Catch in n8n
try {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [...],
      response_format: { type: 'json_object' }
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
  
} catch (error) {
  console.error('OpenAI error:', error);
  
  // Fallback to default questions
  return {
    questions: [
      "What are the exact specifications or size?",
      "What quantity do you need per order or per month?",
      "Are there any quality certifications required?",
      "What is your delivery timeline?",
      "What is your budget range?",
      "Any special requirements or customization needed?"
    ]
  };
}
```

---

### OPTION 2: Google Gemini Flash Integration

#### Step 1: Get API Key

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Get API key"
4. Create new project or use existing
5. Copy key: `AIzaSyxxxxxxxxxx`

#### Step 2: Add to Environment

```bash
# Add to .env file
GOOGLE_AI_KEY=AIzaSyxxxxxxxxxx
GOOGLE_AI_MODEL=gemini-1.5-flash
```

#### Step 3: Test API Connection

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GOOGLE_AI_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Generate 3 questions about plastic bottle requirements for B2B. Return as JSON array."
      }]
    }],
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 500
    }
  }'
```

#### Step 4: n8n Integration

```javascript
// HTTP Request Node
{
  "method": "POST",
  "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={{ $env.GOOGLE_AI_KEY }}",
  "sendBody": true,
  "bodyParameters": {
    "contents": [{
      "parts": [{
        "text": "User requirement:\nType: {{ $json.lead_type }}\nDescription: {{ $json.lead_description }}\n\nGenerate 3-6 follow-up questions. Return ONLY JSON:\n{\"questions\": [\"Q1?\", \"Q2?\", ...]}"
      }]
    }],
    "generationConfig": {
      "temperature": 0.7,
      "maxOutputTokens": 500
    }
  }
}

// Parse Response
const response = $input.item.json;
const text = response.candidates[0].content.parts[0].text;

// Gemini sometimes adds markdown formatting, strip it
const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
const parsed = JSON.parse(cleanText);

return { questions: parsed.questions };
```

---

### OPTION 3: Self-Hosted Llama 3.1 (Advanced)

#### Prerequisites

- Mac M1/M2/M3 (or Linux server with GPU)
- 16GB+ RAM
- 10GB free disk space

#### Step 1: Install Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or via Homebrew (macOS)
brew install ollama
```

#### Step 2: Download Model

```bash
# Pull Llama 3.1 8B model (~4.7GB)
ollama pull llama3.1:8b

# Test locally
ollama run llama3.1:8b "Generate 3 questions about plastic bottles"
```

#### Step 3: Run as API Server

```bash
# Start Ollama server (runs on port 11434)
ollama serve

# Test API
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Generate 3 questions about plastic bottle requirements. Return JSON format."
}'
```

#### Step 4: n8n Integration

```javascript
// HTTP Request Node
{
  "method": "POST",
  "url": "http://localhost:11434/api/generate",
  "sendBody": true,
  "bodyParameters": {
    "model": "llama3.1:8b",
    "prompt": "You are a B2B qualification assistant.\n\nUser requirement:\nType: {{ $json.lead_type }}\nDescription: {{ $json.lead_description }}\n\nGenerate 3-6 follow-up questions. Return ONLY valid JSON:\n{\"questions\": [\"Q1?\", \"Q2?\", ...]}\n\nJSON:",
    "stream": false,
    "format": "json"
  }
}

// Parse Response
const response = $input.item.json;
const text = response.response;
const parsed = JSON.parse(text);
return { questions: parsed.questions };
```

#### Step 5: Production Deployment (Optional)

```bash
# Run Ollama in Docker
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama_data:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama

# Pull model inside container
docker exec ollama ollama pull llama3.1:8b
```

---

## 📈 COST PROJECTIONS FOR RIFAH CONNECT

### Scenario Analysis

#### Conservative Scenario (10% Active Users)

**Assumptions:**
- Total businesses: 100,000
- Monthly active: 10,000 (10%)
- Leads per active user: 1 per month
- Total leads/month: 10,000
- AI calls: 20,000 (2 per lead)

| Model | Monthly Cost (₹) | Annual Cost (₹) |
|-------|------------------|-----------------|
| GPT-4o-mini | 500 | 6,000 |
| Gemini Flash | 165 | 2,000 |
| Claude Haiku | 830 | 10,000 |
| Self-hosted | 500 (electricity) | 6,000 |

---

#### Medium Scenario (30% Active Users)

**Assumptions:**
- Monthly active: 30,000
- Total leads/month: 30,000
- AI calls: 60,000

| Model | Monthly Cost (₹) | Annual Cost (₹) |
|-------|------------------|-----------------|
| GPT-4o-mini | 1,500 | 18,000 |
| Gemini Flash | 500 | 6,000 |
| Claude Haiku | 2,500 | 30,000 |
| Self-hosted | 500-1,000 | 6,000-12,000 |

---

#### Peak Scenario (50% Active Users)

**Assumptions:**
- Monthly active: 50,000
- Total leads/month: 50,000
- AI calls: 100,000

| Model | Monthly Cost (₹) | Annual Cost (₹) |
|-------|------------------|-----------------|
| GPT-4o-mini | 2,500 | 30,000 |
| Gemini Flash | 830 | 10,000 |
| Claude Haiku | 4,150 | 50,000 |
| Self-hosted | 500-1,000 | 6,000-12,000 |

---

#### Aggressive Growth (100K+ Leads/Month)

**Assumptions:**
- Monthly active: 100,000
- Total leads/month: 100,000
- AI calls: 200,000

| Model | Monthly Cost (₹) | Annual Cost (₹) | Break-even Point |
|-------|------------------|-----------------|------------------|
| GPT-4o-mini | 5,000 | 60,000 | - |
| Gemini Flash | 1,650 | 20,000 | **Recommended at this scale** |
| Self-hosted | 1,000-2,000 | 12,000-24,000 | Worth considering |

---

### ROI Analysis

**Revenue per Connected Lead:** ₹500 (estimated membership revenue + transaction fees)

**Cost per Connected Lead:**

| Model | AI Cost | % of Revenue |
|-------|---------|--------------|
| GPT-4o-mini | ₹0.05 | 0.01% |
| Gemini Flash | ₹0.017 | 0.003% |
| Claude Haiku | ₹0.083 | 0.017% |

**Verdict:** Even at peak volume, AI costs are **negligible** compared to revenue (< 0.02%)

---

## 🔄 MIGRATION GUIDE

### Switching Between Providers

All models use similar prompt structure. Only API endpoint and auth change.

#### From Claude to OpenAI

**1. Update .env:**
```bash
# OLD
ANTHROPIC_API_KEY=sk-ant-xxxxx

# NEW
OPENAI_API_KEY=sk-proj-xxxxx
OPENAI_MODEL=gpt-4o-mini
```

**2. Update n8n HTTP Node:**
```javascript
// OLD
url: "https://api.anthropic.com/v1/messages"
headers: {
  "x-api-key": "...",
  "anthropic-version": "2023-06-01"
}
body: {
  model: "claude-sonnet-4-20250514",
  messages: [...]
}

// NEW
url: "https://api.openai.com/v1/chat/completions"
headers: {
  "Authorization": "Bearer ...",
  "Content-Type": "application/json"
}
body: {
  model: "gpt-4o-mini",
  messages: [...],
  response_format: { type: "json_object" }
}
```

**3. Update Response Parser:**
```javascript
// OLD
const text = response.content[0].text;

// NEW
const text = response.choices[0].message.content;
```

**4. Test thoroughly:** Run 50-100 test leads before switching production

---

#### From OpenAI to Gemini

**1. Update .env:**
```bash
GOOGLE_AI_KEY=AIzaSyxxxxx
```

**2. Update endpoint:**
```javascript
url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_KEY}`

body: {
  contents: [{
    parts: [{ text: "Your prompt" }]
  }]
}
```

**3. Update parser (Gemini adds markdown sometimes):**
```javascript
const text = response.candidates[0].content.parts[0].text;
const clean = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
const parsed = JSON.parse(clean);
```

---

## ✅ FINAL RECOMMENDATIONS

### For RIFAH Connect Specifically:

**START HERE:** 
```
Provider: OpenAI
Model: gpt-4o-mini
Monthly Budget: ₹500-2,000
```

**REASONS:**
1. Best balance of cost, quality, and reliability
2. Proven at scale (production-ready)
3. Excellent n8n integration
4. Great documentation and community
5. Easy to debug and monitor
6. Understands Indian business context
7. Can handle 30K-50K leads/month easily
8. Room to scale to 100K+ if needed

**IF BUDGET EXTREMELY TIGHT:**
```
Provider: Google
Model: Gemini 1.5 Flash
Monthly Budget: ₹165-1,000
```

**IF VOLUME EXCEEDS 500K LEADS/MONTH:**
```
Provider: Self-hosted
Model: Llama 3.1 8B via Ollama
Monthly Budget: ₹500-1,000 (infrastructure)
```

**NEVER USE:**
- GPT-4o or Claude Sonnet (10-20x more expensive, no benefit)
- Claude Opus (30x more expensive, complete overkill)

---

## 📞 SUPPORT & RESOURCES

### OpenAI
- Documentation: https://platform.openai.com/docs
- API Status: https://status.openai.com
- Pricing: https://openai.com/api/pricing
- Community: https://community.openai.com

### Google Gemini
- Documentation: https://ai.google.dev/gemini-api/docs
- API Console: https://aistudio.google.com
- Pricing: https://ai.google.dev/pricing

### Ollama (Self-hosted)
- Documentation: https://ollama.com/docs
- Models: https://ollama.com/library
- GitHub: https://github.com/ollama/ollama

---

## 📝 CHANGELOG

**March 2026:**
- Initial comparison created
- GPT-4o-mini recommended as primary option
- Gemini Flash as budget alternative
- Self-hosted guide added for high-volume scenarios

---

**END OF DOCUMENT**

**Next Steps:**
1. Start with GPT-4o-mini
2. Monitor usage and costs via OpenAI dashboard
3. Re-evaluate after 3 months based on actual volume
4. Consider Gemini Flash if volume > 100K leads/month
5. Consider self-hosted if volume > 500K leads/month
