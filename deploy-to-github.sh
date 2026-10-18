#!/bin/bash
# SSN PCD Activities Attendance Management
# Automated GitHub Push & Deploy Script

set -e

if [ -z "$1" ]; then
  echo "Usage: ./deploy-to-github.sh <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>"
  echo "Or set GITHUB_TOKEN env var: export GITHUB_TOKEN=ghp_... && ./deploy-to-github.sh"
  exit 1
fi

TOKEN="$1"
REPO="myselfGokul-1111/SSN-YRC-Attendance-Management"

echo "Configuring remote with provided token..."
git remote set-url origin "https://x-access-token:${TOKEN}@github.com/${REPO}.git"

echo "Pushing latest code to origin main..."
git push origin main

echo "Resetting remote URL to public HTTPS..."
git remote set-url origin "https://github.com/${REPO}.git"

echo "✅ Successfully pushed to GitHub!"
echo "🚀 GitHub Actions workflow will now build and deploy the app automatically to GitHub Pages."
