# CronoHub - GitHub Time Tracker

![Daily Tests](https://github.com/gopenux/CronoHub/actions/workflows/daily-tests.yml/badge.svg)
![PR Tests](https://github.com/gopenux/CronoHub/actions/workflows/pr-tests.yml/badge.svg)
![Chrome Compatibility](https://img.shields.io/badge/Chrome-Stable%20%7C%20Beta-green)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Version](https://img.shields.io/badge/Version-1.1.0-brightgreen)

**CronoHub** is a Chrome Extension (Manifest V3) developed by **Gopenux AI Team** that provides complete time tracking and reporting for GitHub issues. Track time directly through formatted comments and generate comprehensive multi-user reports with organization-wide hour aggregation.

## ✨ Features

### Time Logging
- ⏱️ **Quick time logging** - Enter hours and optional description
- 👤 **Automatic identification** - Uses your GitHub account
- 🎨 **Integrated design** - Interface seamlessly matches GitHub's UI
- 💾 **Local persistence** - Settings saved securely in your browser
- 🔍 **Smart issue detection** - Works in classic issue views and GitHub Projects
- 🖼️ **Adaptive rendering** - Direct DOM injection or isolated iframe based on context

### Reports & Analytics (NEW in v1.1.0)
- 📊 **Multi-user reports** - Organization-wide time tracking visualization
- 📅 **Date range filtering** - Flexible date ranges (default: last 7 days, max: 90 days)
- 👥 **Collaborator selection** - Chip-based multi-select with search
- 📈 **Hour aggregation** - Automatic grouping by date with totals
- ⚡ **Optimized API** - 99.6% reduction in data transfer (from ~500KB to ~10KB)
- 🔄 **Dual mode panel** - Toggle between time logging and reports viewing

### Technical Excellence
- 🚀 **Manifest V3** - Modern and secure extension architecture
- 🧪 **177 tests** - 100% functional coverage with intelligent CI logging
- 🔒 **Security** - XSS prevention, HTML escaping, secure token storage
- 📦 **Optimized** - Single-pass processing, memory-efficient algorithms

## Comment Format

Time tracking comments are posted to GitHub issues with the following markdown format:

```markdown
⏱️ **Time Tracked:** 2.5 Hours

Optional description of the work done

---
<sub>**Logged with CronoHub** by Gopenux AI Team</sub>
```

## Installation

### For Users

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/gopenux/CronoHub.git
   ```

2. **Open Chrome and navigate to extensions**
   - Go to `chrome://extensions/`

3. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `CronoHub` folder

### For Developers

```bash
# Clone the repository
git clone https://github.com/gopenux/CronoHub.git
cd CronoHub

# Install dependencies
npm install

# Run tests
npm test
```

## Configuration

### Get a GitHub Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "CronoHub")
4. Select the `repo` scope
5. Generate the token and copy it

### Configure the extension

1. Click the CronoHub icon in the Chrome toolbar
2. Paste your GitHub token
3. Click "Save configuration"
4. Your name is automatically obtained from your GitHub account

## Usage

### Logging Time

#### In Classic Issue Views

1. Navigate to any GitHub issue page
2. Look for the floating green button with a clock icon (⏱️) in the bottom right corner
3. Click the button to open the time tracking panel
4. Enter the hours worked (e.g., 2.5)
5. Optionally add a description of the work done
6. Click "Log Time" to post the comment

#### In GitHub Projects

1. Open an issue from the Projects board (side panel view)
2. The time tracking button will automatically appear
3. Follow the same steps as above to log time

The extension automatically detects the issue context and adapts its rendering accordingly.

### Viewing Reports (NEW in v1.1.0)

1. Click the CronoHub button to open the panel
2. Switch to the "**Reports**" tab
3. The organization is automatically detected from the current repository
4. Select collaborators using the chip selector (search and multi-select)
   - By default, your user is pre-selected
   - Click on collaborators to add/remove them
5. Choose a date range (default: last 7 days, max: 90 days)
6. Click "**Generate Report**" to view aggregated hours

The report shows:
- Hours tracked by each selected collaborator
- Breakdown by date with collapsible sections
- Total hours for each user and grand total
- Direct links to the original time tracking comments

**API Optimization**: Reports use GitHub's Search API with combined filters (user + org + date + text), reducing data transfer by 99.6% compared to fetching all comments.

## Project Structure

```
CronoHub/
├── manifest.json          # Manifest V3 configuration (v1.1.0)
├── background.js          # Service worker for extension lifecycle
├── content.js            # Main script: UI, state, time logging, reports UI
├── reports.js            # Reports module: API, parsing, aggregation (NEW)
├── popup.html            # Authentication/configuration UI (v1.1.0)
├── popup.js              # Popup logic and token management
├── package.json          # NPM dependencies and scripts
├── eslint.config.mjs     # ESLint configuration
├── styles/
│   ├── content.css       # Styles for button, panel, reports, chips
│   └── popup.css         # Styles for popup window
├── icons/
│   ├── icon16.png        # Extension icon (16x16)
│   ├── icon48.png        # Extension icon (48x48)
│   └── icon128.png       # Extension icon (128x128)
├── tests/
│   ├── e2e/              # End-to-end tests (29 tests)
│   │   ├── extension-structure.test.js
│   │   ├── reports.test.js (NEW)
│   │   ├── reports-ui-mocked.test.js (NEW)
│   │   └── helpers/
│   │       └── extension-loader.js
│   ├── unit/             # Unit tests (148 tests)
│   │   ├── content.test.js (NEW)
│   │   ├── content-advanced.test.js (NEW)
│   │   ├── content-ui-rendering.test.js (NEW)
│   │   ├── popup.test.js (NEW)
│   │   ├── reports.test.js (NEW)
│   │   └── manifest.test.js
│   ├── mocks/            # Reusable API mocks (NEW)
│   │   └── github-api-mocks.js
│   ├── scripts/          # Test automation scripts
│   └── README.md         # Test documentation
└── .github/
    └── workflows/        # CI/CD with GitHub Actions
        ├── daily-tests.yml
        └── pr-tests.yml
```

## Architecture

### Issue Detection

CronoHub uses a three-tier detection strategy to identify the current issue:

1. **Direct URL Detection**: Parses `/:owner/:repo/issues/:number` from the current URL
2. **Projects Side Panel**: Detects issues opened in GitHub Projects side panel using `[data-testid="side-panel-content"]`
3. **URL Parameters**: Falls back to `?issue=owner|repo|number` query parameter

This cascading approach ensures compatibility with both classic issue views and the new GitHub Projects interface.

### UI Rendering Strategy

The extension adapts its rendering based on the current context:

- **Classic Issue Views**: Direct DOM injection into the page
- **GitHub Projects**: Isolated iframe rendering to prevent CSS conflicts with GitHub's styles

The iframe approach ensures complete style isolation while maintaining full functionality.

### State Management

A centralized `state` object manages:
- Panel open/close state
- Loading states during API calls
- User configuration (token, username)
- Current issue data (owner, repo, number, title)
- **Panel mode** - 'log' or 'reports' (NEW in v1.1.0)
- **Reports data** - Generated report with hour aggregation (NEW in v1.1.0)
- **Collaborators** - Organization members and selected filters (NEW in v1.1.0)

## Privacy & Security

- Your GitHub token is stored **locally** in your browser using `chrome.storage.local`
- The token is **never sent to external servers** (only to GitHub's official API)
- All API requests go directly to `api.github.com`
- Manifest V3 ensures modern security practices

## Testing & Quality Assurance

CronoHub includes comprehensive automated testing with **177 tests** and **100% functional coverage**:

### 🧪 Test Coverage

**Total: 177 Tests (100% Functional Coverage)**

- **Unit Tests** (148 tests):
  - content.test.js (71 tests): Core functionality, issue detection
  - content-advanced.test.js (41 tests): Storage sync, state management
  - content-ui-rendering.test.js (59 tests): UI rendering, XSS prevention
  - popup.test.js (35 tests): Authentication flow, token validation
  - reports.test.js (27 tests): Date validation, comment parsing, aggregation
  - manifest.test.js (14 tests): Manifest V3 validation

- **E2E Tests** (29 tests):
  - extension-structure.test.js (4 tests): Extension loading and structure
  - reports.test.js (8 tests): Reports module browser integration
  - reports-ui-mocked.test.js (18 tests): API mocking, no token required

- **Intelligent CI Logging**: Diagnostic logs suppressed in GitHub Actions (99% noise reduction)
- **Chrome Compatibility**: Daily tests against Chrome Stable and Beta versions
- **Mocked API Strategy**: Uses `page.evaluateOnNewDocument()` for deterministic testing without tokens

### 🤖 Automated Testing

- **Daily Runs**: Tests execute automatically every day at 2:00 AM UTC
- **PR Validation**: All pull requests are tested before merge
- **Auto Issue Creation**: Failed tests automatically create GitHub issues with full error details
- **Multi-Version Testing**: Ensures compatibility across Chrome Stable and Beta

### 🚀 Running Tests Locally

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit      # Unit tests only
npm run test:e2e       # E2E tests only
npm run test:coverage  # Tests with coverage report

# Validate manifest
npm run validate:manifest
```

### 📊 Test Status

The badges at the top of this README show real-time test status:
- **Daily Tests**: Scheduled compatibility tests across Chrome versions
- **PR Tests**: Tests run on every pull request

For detailed test documentation, see [tests/README.md](tests/README.md)

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:e2e          # E2E tests only
npm run test:coverage     # With coverage report
npm run test:watch        # Watch mode

# Linting
npm run lint

# Validate manifest
npm run validate:manifest
```

### Debugging

- **Content script changes**: Reload extension at `chrome://extensions/` + refresh GitHub page
- **Popup changes**: Reload extension + close/reopen popup
- **Manifest changes**: Full extension reload required

## Author

**Gopenux AI Team** - Creator and maintainer

## License

MIT License - Copyright (c) 2026 Gopenux AI Team

See [LICENSE](LICENSE) file for details.
