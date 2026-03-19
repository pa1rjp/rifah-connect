#!/usr/bin/env node
/**
 * RIFAH Connect — GitHub API Utility
 *
 * Usage as CLI:
 *   node scripts/github.js list-issues
 *   node scripts/github.js create-issue --title "..." --body "..." --labels "bug,flow-1"
 *   node scripts/github.js close-issue 25
 *   node scripts/github.js close-issues 20 21 22
 *   node scripts/github.js update-issue 25 --title "new title" --body "new body" --state open
 *   node scripts/github.js assign 25 26 27
 *   node scripts/github.js create-label --name "flow-3" --color "0075ca" --desc "Flow 3"
 *
 * Usage as module:
 *   const gh = require('./scripts/github')
 *   await gh.createIssue({ title, body, labels })
 *   await gh.closeIssue(25)
 *   await gh.assignIssues([25, 26], 'pa1rjp')
 */

const https = require('https');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const TOKEN  = process.env.GITHUB_TOKEN;
const REPO   = process.env.GITHUB_REPO  || 'pa1rjp/rifah-connect';

if (!TOKEN) { console.error('GITHUB_TOKEN not set in .env'); process.exit(1); }
const OWNER  = REPO.split('/')[0];
const BASE   = `https://api.github.com/repos/${REPO}`;

// ── Core request ──────────────────────────────────────────────────────────────
function api(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      { hostname: 'api.github.com', path: `${BASE.replace('https://api.github.com', '')}${path}`,
        method, headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'rifah-connect-script',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Exported functions ────────────────────────────────────────────────────────
async function listIssues(state = 'open') {
  const data = await api(`/issues?state=${state}&per_page=50`);
  return Array.isArray(data) ? data : [];
}

async function createIssue({ title, body = '', labels = [] }) {
  const d = await api('/issues', 'POST', { title, body, labels });
  return d;
}

async function closeIssue(number, comment = '') {
  if (comment) await api(`/issues/${number}/comments`, 'POST', { body: comment });
  return api(`/issues/${number}`, 'PATCH', { state: 'closed' });
}

async function updateIssue(number, fields) {
  return api(`/issues/${number}`, 'PATCH', fields);
}

async function assignIssues(numbers, assignee = OWNER) {
  return Promise.all(
    numbers.map(n => api(`/issues/${n}`, 'PATCH', { assignees: [assignee] }))
  );
}

async function createLabel({ name, color, description = '' }) {
  return api('/labels', 'POST', { name, color, description });
}

async function addComment(number, body) {
  return api(`/issues/${number}/comments`, 'POST', { body });
}

module.exports = { listIssues, createIssue, closeIssue, updateIssue, assignIssues, createLabel, addComment };

// ── CLI ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd  = args[0];

  function flag(name) {
    const i = args.indexOf(`--${name}`);
    return i !== -1 ? args[i + 1] : null;
  }

  (async () => {
    switch (cmd) {
      case 'list-issues': {
        const state = flag('state') || 'open';
        const issues = await listIssues(state);
        issues.forEach(i => console.log(`#${i.number} [${i.state}] ${i.title}`));
        break;
      }
      case 'create-issue': {
        const labels = (flag('labels') || '').split(',').filter(Boolean);
        const d = await createIssue({ title: flag('title'), body: flag('body') || '', labels });
        console.log(`Created #${d.number}: ${d.title}`);
        break;
      }
      case 'close-issue': {
        const d = await closeIssue(args[1], flag('comment'));
        console.log(`Closed #${d.number}`);
        break;
      }
      case 'close-issues': {
        const nums = args.slice(1).filter(n => !n.startsWith('--'));
        for (const n of nums) {
          const d = await closeIssue(n, flag('comment'));
          console.log(`Closed #${d.number}`);
        }
        break;
      }
      case 'update-issue': {
        const fields = {};
        ['title','body','state'].forEach(f => { if (flag(f)) fields[f] = flag(f); });
        const d = await updateIssue(args[1], fields);
        console.log(`Updated #${d.number}`);
        break;
      }
      case 'assign': {
        const nums = args.slice(1).filter(n => !n.startsWith('--'));
        const assignee = flag('to') || OWNER;
        const results = await assignIssues(nums, assignee);
        results.forEach(d => console.log(`#${d.number} assigned to ${d.assignees?.map(a => a.login).join(', ')}`));
        break;
      }
      case 'create-label': {
        const d = await createLabel({ name: flag('name'), color: flag('color'), description: flag('desc') || '' });
        console.log(d.message ? `Label error: ${d.message}` : `Created label: ${d.name}`);
        break;
      }
      default:
        console.log('Commands: list-issues, create-issue, close-issue, close-issues, update-issue, assign, create-label');
    }
  })().catch(e => { console.error(e.message); process.exit(1); });
}
