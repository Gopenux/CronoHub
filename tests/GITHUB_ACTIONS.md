# GitHub Actions Testing Guide

This document explains how CronoHub's automated tests work in GitHub Actions and why specific configurations are needed.

## 🎯 The Challenge

Chrome extensions **cannot run in headless mode** because:
- Extensions require a browser UI to load properly
- Extension APIs are disabled in headless Chrome
- Content scripts need to interact with rendered pages

**Problem**: GitHub Actions runs on servers without displays (headless environments).

**Solution**: Use **Xvfb (X Virtual Framebuffer)** to create a virtual display.

## 🖥️ What is Xvfb?

**Xvfb** (X Virtual Framebuffer) is an X11 server that performs all graphical operations in memory without showing any screen output.

### How it works:

1. Creates a virtual display (e.g., `:99`)
2. Chrome renders to this virtual display
3. Tests run as if Chrome had a real monitor
4. No physical display required

### Installation:

```bash
sudo apt-get update
sudo apt-get install -y xvfb
```

### Usage:

```bash
# Run any graphical application with Xvfb
xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" npm run test:e2e
```

**Parameters explained:**
- `--auto-servernum`: Automatically selects an available display number
- `--server-args="-screen 0 1280x720x24"`: Creates a 1280x720 display with 24-bit color
- `npm run test:e2e`: The command to run

## 🔧 GitHub Actions Configuration

### Workflow Structure

```yaml
steps:
  # 1. Install Xvfb
  - name: Install Xvfb
    run: |
      sudo apt-get update
      sudo apt-get install -y xvfb

  # 2. Run tests with Xvfb
  - name: Run E2E Tests
    run: xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" npm run test:e2e
    env:
      DISPLAY: :99
```

### Why Each Step Matters

#### Step 1: Install Xvfb
- Ubuntu runners don't have Xvfb by default
- Must be installed before running E2E tests
- Cached by GitHub Actions for subsequent runs

#### Step 2: Run with xvfb-run
- Wraps the test command with Xvfb
- Automatically manages display lifecycle
- Sets `DISPLAY` environment variable
- Cleans up after tests complete

## 🎭 Puppeteer Configuration

Our `extension-loader.js` helper is configured for CI environments:

```javascript
const browser = await puppeteer.launch({
  headless: false,  // MUST be false for extensions
  args: [
    '--no-sandbox',              // Required for CI
    '--disable-setuid-sandbox',  // Required for CI
    '--disable-dev-shm-usage',   // Prevents memory issues
    '--disable-gpu',             // No GPU in CI
    // ... extension-specific args
  ]
});
```

### Key Arguments Explained

| Argument | Purpose | Required for CI? |
|----------|---------|------------------|
| `--no-sandbox` | Disables Chrome's sandbox | ✅ Yes |
| `--disable-setuid-sandbox` | Alternative sandboxing method | ✅ Yes |
| `--disable-dev-shm-usage` | Use /tmp instead of /dev/shm | ✅ Yes |
| `--disable-gpu` | Disable GPU hardware acceleration | ✅ Yes |
| `--disable-extensions-except` | Load only our extension | ✅ Yes |
| `--load-extension` | Path to extension directory | ✅ Yes |

## 🔄 Workflow Execution Flow

### Daily Tests Workflow

```
┌─────────────────────────────────────────────┐
│ 1. Scheduled Trigger (2:00 AM UTC daily)   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 2. Checkout Repository                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 3. Setup Node.js & Install Dependencies    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 4. Install Xvfb                             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 5. Install Chrome (Stable or Beta)          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 6. Run Unit Tests (fast, no Xvfb needed)   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 7. Run E2E Tests with Xvfb                  │
│    xvfb-run npm run test:e2e                │
└─────────────────────────────────────────────┘
                    ↓
         ┌──────────┴──────────┐
         │                     │
    ✅ Success            ❌ Failure
         │                     │
         ↓                     ↓
   Upload Results    Upload Screenshots
                              ↓
                     Create GitHub Issue
                     (with error details)
```

## 🐛 Troubleshooting in GitHub Actions

### Tests timeout in CI

**Possible causes:**
1. Chrome not installed correctly
2. Xvfb not running
3. Extension not loading

**Solution:**
Add debug step to workflow:

```yaml
- name: Debug environment
  run: |
    google-chrome --version
    xvfb-run --help
    ls -la ./
```

### Screenshots not captured

**Possible causes:**
1. Screenshot directory doesn't exist
2. Test doesn't reach screenshot code
3. Permissions issue

**Solution:**
Ensure directory exists:

```yaml
- name: Create screenshots directory
  run: mkdir -p tests/screenshots
```

### Chrome crashes in CI

**Possible causes:**
1. Missing `--no-sandbox` flag
2. Insufficient memory
3. Missing dependencies

**Solution:**
Check Puppeteer launch args and increase memory:

```yaml
- name: Run E2E tests
  run: xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" npm run test:e2e
  env:
    NODE_OPTIONS: --max-old-space-size=4096
```

### Extension not detected

**Possible causes:**
1. Extension path incorrect
2. Manifest invalid
3. Chrome version incompatible

**Solution:**
Add validation step:

```yaml
- name: Validate extension
  run: |
    ls -la manifest.json
    npm run validate:manifest
```

## 📊 Monitoring Test Health

### Check Workflow Runs

```
GitHub Repository → Actions → Daily Chrome Compatibility Tests
```

### Review Test Artifacts

When tests fail, artifacts are uploaded:
- **Screenshots**: Visual state when test failed
- **Coverage Reports**: Code coverage data
- **Test Results**: Detailed test output

Download from:
```
Actions → Select Run → Scroll to Artifacts
```

### Automated Issues

Failed tests automatically create issues with:
- Error message and stack trace
- Chrome version that failed
- Link to failed run
- Commit SHA

Issues are labeled:
- `bug`
- `automated-test`
- `chrome-compatibility`

## 🚀 Local Testing vs CI Testing

### Local Testing

```bash
# Chrome opens with visible window
npm run test:e2e
```

- Chrome window visible
- Can see test execution
- Easier to debug
- No Xvfb needed

### CI Testing

```bash
# Chrome runs in Xvfb virtual display
xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" npm run test:e2e
```

- No visible window
- Runs on headless server
- Requires Xvfb
- Automated execution

## 🔐 Security Considerations

### GitHub Token

- Automatically provided by GitHub Actions
- Has permission to create issues
- Limited to repository scope
- No manual configuration needed

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Auto-provided
```

### Chrome Sandbox

- Disabled in CI (`--no-sandbox`)
- **Safe** in isolated GitHub Actions runners
- **Not recommended** for untrusted code
- Required for CI environments

## 📈 Performance Optimization

### Caching

GitHub Actions caches:
- Node modules (`cache: 'npm'`)
- Installed Chrome versions
- Xvfb installation (via apt cache)

### Parallel Execution

Tests run in parallel across Chrome versions:

```yaml
strategy:
  matrix:
    chrome-channel: [stable, beta]
```

Each version runs independently:
- ✅ Faster total execution
- ✅ Isolated failures
- ✅ Better error reporting

### Timeout Management

```yaml
timeout-minutes: 30  # Prevents stuck jobs
```

Individual test timeouts:
```javascript
jest.setTimeout(60000);  // 60 seconds per test
```

## 📚 Additional Resources

- [Xvfb Documentation](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml)
- [Puppeteer Documentation](https://pptr.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Chrome Extension Testing Best Practices](https://developer.chrome.com/docs/extensions/mv3/testing/)

## 🆘 Getting Help

If tests are failing in CI:

1. Check the **Actions** tab for detailed logs
2. Download **screenshots** artifact
3. Review **automated issue** created
4. Compare with local test results
5. Run `tests/scripts/check-ci-environment.sh` locally

---

**Last Updated**: 2026-01-16
**Maintained by**: Gopenux AI Team
