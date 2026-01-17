# CronoHub Testing Documentation

This document provides comprehensive information about CronoHub's automated testing infrastructure.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Test Suites](#test-suites)
- [GitHub Actions Integration](#github-actions-integration)
- [Automated Issue Creation](#automated-issue-creation)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)

> **📘 For detailed information about running tests in GitHub Actions, see [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md)**

## Overview

CronoHub uses a comprehensive testing strategy to ensure the extension remains compatible with Chrome updates and maintains high quality standards.

### Key Features

- ✅ **Manifest V3 Validation**: Ensures compliance with Chrome extension standards
- 🌐 **E2E Testing**: Tests complete user workflows in real Chrome instances
- 🤖 **Automated Daily Runs**: Tests execute daily against Chrome Stable and Beta
- 🐛 **Auto Issue Creation**: Failed tests automatically create detailed GitHub issues
- 📊 **Coverage Reports**: Track code coverage across the codebase

## Test Architecture

```
tests/
├── e2e/                          # End-to-end tests
│   ├── helpers/
│   │   └── extension-loader.js  # Puppeteer utilities for loading extension
│   ├── authentication.test.js    # Auth flow tests
│   ├── issue-detection.test.js   # Issue detection tests
│   └── time-tracking.test.js     # Time tracking flow tests
├── unit/                         # Unit tests
│   └── manifest.test.js          # Manifest V3 validation
├── scripts/
│   └── create-failure-issue.js   # Auto issue creation script
├── screenshots/                  # E2E test screenshots on failure
└── fixtures/                     # Test data and mocks
```

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install
```

### Test Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:e2e           # E2E tests only
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report

# Validate manifest
npm run validate:manifest

# Lint code
npm run lint
```

### Environment Variables

```bash
# Set Chrome channel for E2E tests
CHROME_CHANNEL=stable npm run test:e2e
CHROME_CHANNEL=beta npm run test:e2e

# Use custom Chrome executable
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npm run test:e2e
```

### Running E2E Tests in CI (Headless Environments)

Chrome extensions **cannot** run in true headless mode. To solve this in CI environments like GitHub Actions, we use **Xvfb (X Virtual Framebuffer)**:

```bash
# Install Xvfb (Ubuntu/Debian)
sudo apt-get install -y xvfb

# Run tests with Xvfb
xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" npm run test:e2e
```

**What Xvfb does:**
- Creates a virtual display that Chrome can render to
- Allows headed Chrome to run without a physical monitor
- Essential for running extension tests in GitHub Actions

**This is already configured** in the GitHub Actions workflows, so tests will run automatically in CI.

## Test Suites

### 1. Manifest V3 Validation Tests

**Location**: `tests/unit/manifest.test.js`

**Purpose**: Validates that manifest.json complies with Chrome Extension Manifest V3 specifications.

**Tests Include**:
- ✅ Manifest version is 3
- ✅ Required fields are present
- ✅ Name and description length constraints
- ✅ Permissions are correctly defined
- ✅ Host permissions for GitHub domains
- ✅ Action (popup) configuration
- ✅ Content scripts configuration
- ✅ Icon files exist and are valid
- ✅ No deprecated Manifest V2 fields

**Running**:
```bash
npm run validate:manifest
```

### 2. Issue Detection E2E Tests

**Location**: `tests/e2e/issue-detection.test.js`

**Purpose**: Tests the extension's ability to detect GitHub issues across different contexts.

**Tests Include**:
- ✅ Extension loads correctly in Chrome
- ✅ Detects issues from direct URL
- ✅ Hides button when no issue present
- ✅ Updates detection on issue navigation
- ✅ Maintains button during SPA navigation
- ✅ Extracts issue title correctly

**Key Scenarios**:
- Direct issue URLs: `/owner/repo/issues/123`
- GitHub Projects side panel
- URL parameter-based detection

### 3. Authentication E2E Tests

**Location**: `tests/e2e/authentication.test.js`

**Purpose**: Tests the complete authentication and configuration flow.

**Tests Include**:
- ✅ Shows unauthenticated state initially
- ✅ Validates empty token input
- ✅ Saves token to storage
- ✅ Displays authenticated state
- ✅ Logout functionality
- ✅ Persists authentication across reloads

**Mocking**:
Tests use mocked GitHub API responses to avoid hitting rate limits.

### 4. Time Tracking E2E Tests

**Location**: `tests/e2e/time-tracking.test.js`

**Purpose**: Tests the complete time tracking workflow.

**Tests Include**:
- ✅ Opens panel on button click
- ✅ Displays issue information
- ✅ Form elements present and functional
- ✅ Validates hours input
- ✅ Accepts description text
- ✅ Formats comments correctly
- ✅ Closes panel properly
- ✅ Shows loading state during submission
- ✅ Handles different hour formats

**Test Data**:
- Valid hour formats: 0.25, 0.5, 1, 2.5, 8, 24
- Invalid ranges: < 0, > 24

## GitHub Actions Integration

### Workflow Files

#### 1. Daily Tests (`daily-tests.yml`)

**Trigger**:
- Scheduled: Daily at 2:00 AM UTC
- Manual: Via workflow_dispatch
- Push to main branch
- Pull requests to main

**Matrix Strategy**:
```yaml
matrix:
  chrome-channel: [stable, beta]
```

**Steps**:
1. Checkout repository
2. Setup Node.js 20
3. Install dependencies
4. Install Chrome (stable or beta)
5. Run unit tests
6. Run E2E tests
7. Upload screenshots on failure
8. Create GitHub issue on failure (scheduled runs only)

**Failure Handling**:
- Continues on error to test all Chrome versions
- Automatically creates GitHub issue with:
  - Error message and stack trace
  - Chrome version
  - Links to failing run
  - Mentions repository owner

#### 2. Pull Request Tests (`pr-tests.yml`)

**Trigger**: Pull requests to main branch

**Jobs**:
1. **Lint**: Runs ESLint
2. **Validate Manifest**: Checks Manifest V3 compliance
3. **Unit Tests**: Runs all unit tests
4. **E2E Tests**: Runs E2E tests on Chrome Stable
5. **Summary**: Generates test result summary

**Features**:
- Fast feedback for PRs
- Required checks before merge
- Uploads test artifacts
- Clear pass/fail summary

## Automated Issue Creation

### How It Works

When scheduled tests fail, the system automatically:

1. **Checks for existing issues**: Searches for open issues with same test + Chrome version
2. **Creates new issue** or **adds comment** to existing issue
3. **Includes detailed information**:
   - Test name and Chrome version
   - Full error message and stack trace
   - Links to GitHub Actions run
   - Commit SHA
   - Timestamp

### Issue Format

```markdown
## 🚨 Automated Test Failure Report

**Test Suite:** [test name]
**Chrome Version:** [stable/beta]
**Timestamp:** [ISO timestamp]
**Commit:** [SHA]

@[repository owner]

### ❌ Error Details
[error message]

### 📋 Stack Trace
[stack trace]

### 🔗 Links
- [GitHub Actions Run]
- [Commit Details]
```

### Labels Applied

- `bug`
- `automated-test`
- `chrome-compatibility`

### Script Location

`tests/scripts/create-failure-issue.js`

### Environment Variables Required

- `GITHUB_TOKEN`: Authentication (provided by Actions)
- `GITHUB_REPOSITORY`: Owner/repo
- `TEST_NAME`: Name of failed test
- `CHROME_VERSION`: Chrome channel
- `ERROR_MESSAGE`: Error message
- `ERROR_STACK`: Stack trace
- `MENTION_USER`: User to mention in issue

## Writing New Tests

### Adding Unit Tests

Create test file in `tests/unit/`:

```javascript
describe('Feature Name', () => {
  test('should do something', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Adding E2E Tests

Use helper functions from `extension-loader.js`:

```javascript
const {
  launchBrowserWithExtension,
  setGitHubToken,
  waitForCronoHubButton,
  navigateToGitHubIssue,
  takeScreenshot
} = require('./helpers/extension-loader');

describe('New Feature E2E Tests', () => {
  let browser, page, extensionId;

  beforeAll(async () => {
    const launch = await launchBrowserWithExtension();
    browser = launch.browser;
    page = launch.page;
    extensionId = launch.extensionId;
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should test new feature', async () => {
    try {
      await navigateToGitHubIssue(page, 'owner', 'repo', 1);
      // Test implementation
    } catch (error) {
      await takeScreenshot(page, 'test-error');
      throw error;
    }
  });
});
```

### Best Practices

1. **Use descriptive test names**: Clearly state what is being tested
2. **Take screenshots on failure**: Use `takeScreenshot()` in catch blocks
3. **Set appropriate timeouts**: E2E tests need longer timeouts
4. **Clean up after tests**: Close browsers, clear storage
5. **Mock external APIs**: Avoid rate limits and flaky tests
6. **Test real user flows**: E2E tests should mimic actual usage

## Troubleshooting

### Common Issues

#### E2E Tests Fail Locally

**Problem**: Tests pass in CI but fail locally

**Solutions**:
- Ensure Chrome is installed and up to date
- Check that no other Chrome instances are running
- Clear extension storage: `chrome.storage.local.clear()`
- Update Puppeteer: `npm update puppeteer`

#### Tests Timeout

**Problem**: Tests timeout waiting for selectors

**Solutions**:
- Increase Jest timeout: `jest.setTimeout(60000)`
- Check if element selector is correct
- Ensure extension loaded properly
- Check network connectivity for GitHub pages

#### Screenshots Not Generated

**Problem**: No screenshots in `tests/screenshots/` on failure

**Solutions**:
- Ensure directory exists: `mkdir -p tests/screenshots`
- Check write permissions
- Verify `takeScreenshot()` is called in catch block

#### GitHub API Rate Limits

**Problem**: Tests fail due to API rate limits

**Solutions**:
- Use mocked API responses in tests
- Set `GITHUB_TOKEN` environment variable
- Reduce test frequency

### Debug Mode

Run tests with debug output:

```bash
# Enable Puppeteer debug logs
DEBUG=puppeteer:* npm run test:e2e

# Run single test file
npm test -- tests/e2e/issue-detection.test.js

# Run tests with verbose output
npm test -- --verbose
```

### Checking Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

## Maintenance

### Updating Test Dependencies

```bash
# Update all dependencies
npm update

# Update specific dependencies
npm update puppeteer jest
```

### Monitoring Test Health

1. Check GitHub Actions dashboard regularly
2. Review automated issues for patterns
3. Update selectors if GitHub UI changes
4. Adjust timeouts if tests become flaky

## Contributing

When contributing new features:

1. Write tests for new functionality
2. Ensure all existing tests pass
3. Update this documentation if adding new test patterns
4. Follow existing test structure and naming conventions

## Support

For issues with the testing infrastructure:

1. Check this documentation first
2. Review existing GitHub issues
3. Create new issue with:
   - Test output
   - Environment details
   - Steps to reproduce

---

**Last Updated**: 2026-01-16
**Maintainer**: Gopenux AI Team
