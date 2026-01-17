#!/bin/bash
# CronoHub - CI Environment Check Script
# Author: Gopenux AI
# Copyright (c) 2026 Gopenux AI

echo "🔍 CronoHub CI Environment Check"
echo "================================="
echo ""

# Check if running in CI
if [ "$CI" = "true" ]; then
  echo "✅ Running in CI environment"
else
  echo "ℹ️  Running locally"
fi
echo ""

# Check Node.js version
echo "📦 Node.js version:"
node --version
echo ""

# Check npm version
echo "📦 npm version:"
npm --version
echo ""

# Check Chrome installation
echo "🌐 Chrome installation:"
if command -v google-chrome &> /dev/null; then
  google-chrome --version
else
  echo "❌ Chrome stable not found"
fi

if command -v google-chrome-beta &> /dev/null; then
  google-chrome-beta --version
else
  echo "ℹ️  Chrome beta not installed"
fi
echo ""

# Check Xvfb installation
echo "🖥️  Xvfb installation:"
if command -v xvfb-run &> /dev/null; then
  echo "✅ Xvfb is installed"
  xvfb-run --help | head -1
else
  echo "❌ Xvfb not found (required for CI E2E tests)"
  echo "   Install with: sudo apt-get install -y xvfb"
fi
echo ""

# Check display variable
echo "🖥️  Display configuration:"
if [ -n "$DISPLAY" ]; then
  echo "DISPLAY=$DISPLAY"
else
  echo "ℹ️  DISPLAY not set (will be set by xvfb-run)"
fi
echo ""

# Check if running in GitHub Actions
if [ -n "$GITHUB_ACTIONS" ]; then
  echo "🐙 GitHub Actions detected:"
  echo "   Repository: $GITHUB_REPOSITORY"
  echo "   Workflow: $GITHUB_WORKFLOW"
  echo "   Run ID: $GITHUB_RUN_ID"
  echo "   Event: $GITHUB_EVENT_NAME"
fi
echo ""

# Check Puppeteer
echo "🎭 Puppeteer check:"
if [ -d "node_modules/puppeteer" ]; then
  echo "✅ Puppeteer installed"
  if [ -n "$PUPPETEER_EXECUTABLE_PATH" ]; then
    echo "   Custom Chrome path: $PUPPETEER_EXECUTABLE_PATH"
  fi
else
  echo "❌ Puppeteer not found (run npm install)"
fi
echo ""

# Summary
echo "================================="
echo "✅ Environment check complete"
echo ""
echo "To run E2E tests in CI:"
echo "  xvfb-run --auto-servernum --server-args=\"-screen 0 1280x720x24\" npm run test:e2e"
