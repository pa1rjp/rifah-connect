#!/bin/bash
# Run this from your project folder in Terminal:
# bash push-to-github.sh

set -e

echo "🔓 Removing stuck git lock file..."
rm -f .git/index.lock

echo "🧹 Unstaging internal Claude files..."
git restore --staged .claude/ 2>/dev/null || true

echo "📦 Staging remaining changes..."
git add .gitignore CLAUDE.md documents/ master_prompts/ test_suite/test_flow1.js
git add "n8n/RIFAH Connect - Flow 1 Registration.json" 2>/dev/null || true
git rm --cached n8n/rifah_flow1_workflow.json 2>/dev/null || true

echo "💾 Committing..."
git -c user.email="pa1rjp@gmail.com" -c user.name="pavan" commit -m "Add project docs, n8n workflow, master prompts, and gitignore

- Renamed n8n workflow JSON to cleaner filename
- Added CLAUDE.md with runtime config details
- Added AI Integration Guide documentation
- Added Flow 1 & 2A master prompt files
- Updated test suite for Flow 1
- Added .gitignore to protect .env and exclude internal files"

echo "🔗 Adding GitHub remote..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/pa1rjp/rifah-connect.git

echo "🚀 Pushing to GitHub..."
git push -u origin dev

echo ""
echo "✅ Done! Your project is live at:"
echo "   https://github.com/pa1rjp/rifah-connect"
