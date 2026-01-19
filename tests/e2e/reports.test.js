// CronoHub - Reports Functionality E2E Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const {
  launchBrowserWithExtension
} = require('./helpers/extension-loader');
const fs = require('fs');
const path = require('path');

describe('Reports Functionality E2E Tests', () => {
  let browser;
  let page;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const launch = await launchBrowserWithExtension();
    browser = launch.browser;
    page = launch.page;
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Create a minimal test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body><div id="test">Test content</div></body>
      </html>
    `);

    // Manually inject reports.js
    const reportsPath = path.join(__dirname, '../../reports.js');
    const reportsCode = fs.readFileSync(reportsPath, 'utf8');
    await page.evaluate(reportsCode);
  });

  describe('Module Loading', () => {
    test('should have CronoHubReports available globally', async () => {
      const hasReportsModule = await page.evaluate(() => {
        return typeof window.CronoHubReports !== 'undefined';
      });

      expect(hasReportsModule).toBe(true);
    });

    test('should expose all expected functions', async () => {
      const hasExpectedFunctions = await page.evaluate(() => {
        const reports = window.CronoHubReports;
        return reports &&
               typeof reports.validateDateRange === 'function' &&
               typeof reports.parseTimeFromComment === 'function' &&
               typeof reports.aggregateHoursByDate === 'function' &&
               typeof reports.calculateTotalHours === 'function' &&
               typeof reports.fetchOrgMembers === 'function' &&
               typeof reports.fetchUserCommentsInRange === 'function' &&
               typeof reports.formatDate === 'function' &&
               typeof reports.getDefaultDateRange === 'function';
      });

      expect(hasExpectedFunctions).toBe(true);
    });
  });

  describe('Date Range Validation', () => {
    test('should validate correct date range', async () => {
      const result = await page.evaluate(() => {
        return window.CronoHubReports.validateDateRange('2026-01-01', '2026-01-31');
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject range exceeding 90 days', async () => {
      const result = await page.evaluate(() => {
        return window.CronoHubReports.validateDateRange('2026-01-01', '2026-05-01');
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('90 days');
    });

    test('should reject end date before start date', async () => {
      const result = await page.evaluate(() => {
        return window.CronoHubReports.validateDateRange('2026-01-31', '2026-01-01');
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('before start date');
    });
  });

  describe('Comment Parsing', () => {
    test('should parse CronoHub formatted comment', async () => {
      const hours = await page.evaluate(() => {
        const comment = '⏱️ **Time Tracked:** 3.5 Hours\n\nWorked on feature implementation';
        return window.CronoHubReports.parseTimeFromComment(comment);
      });

      expect(hours).toBe(3.5);
    });

    test('should return 0 for non-CronoHub comment', async () => {
      const hours = await page.evaluate(() => {
        const comment = 'Just a regular comment';
        return window.CronoHubReports.parseTimeFromComment(comment);
      });

      expect(hours).toBe(0);
    });

    test('should handle decimal hours', async () => {
      const hours = await page.evaluate(() => {
        const comment = '⏱️ **Time Tracked:** 2.25 Hours\n\nBug fixes';
        return window.CronoHubReports.parseTimeFromComment(comment);
      });

      expect(hours).toBe(2.25);
    });
  });

  describe('Data Aggregation', () => {
    test('should aggregate hours by date correctly', async () => {
      const result = await page.evaluate(() => {
        const comments = [
          { date: '2026-01-15', hours: 2, comment: 'Task 1' },
          { date: '2026-01-15', hours: 1.5, comment: 'Task 2' },
          { date: '2026-01-16', hours: 3, comment: 'Task 3' }
        ];

        const grouped = window.CronoHubReports.aggregateHoursByDate(comments);
        return {
          dateCount: Object.keys(grouped).length,
          firstDateCount: grouped['2026-01-15'].length,
          secondDateCount: grouped['2026-01-16'].length
        };
      });

      expect(result.dateCount).toBe(2);
      expect(result.firstDateCount).toBe(2);
      expect(result.secondDateCount).toBe(1);
    });

    test('should calculate total hours correctly', async () => {
      const total = await page.evaluate(() => {
        const groupedData = {
          '2026-01-15': [
            { hours: 2.5 },
            { hours: 1.5 }
          ],
          '2026-01-16': [
            { hours: 3 }
          ]
        };

        return window.CronoHubReports.calculateTotalHours(groupedData);
      });

      expect(total).toBe(7);
    });
  });

  describe('Default Date Range', () => {
    test('should generate 7-day default range', async () => {
      const range = await page.evaluate(() => {
        const defaultRange = window.CronoHubReports.getDefaultDateRange();
        const start = new Date(defaultRange.startDate);
        const end = new Date(defaultRange.endDate);
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

        return {
          startDate: defaultRange.startDate,
          endDate: defaultRange.endDate,
          diffDays: diffDays,
          validFormat: /^\d{4}-\d{2}-\d{2}$/.test(defaultRange.startDate)
        };
      });

      expect(range.diffDays).toBe(7);
      expect(range.validFormat).toBe(true);
      expect(range.startDate).toBeTruthy();
      expect(range.endDate).toBeTruthy();
    });
  });

  describe('Date Formatting', () => {
    test('should format date with locale', async () => {
      const formatted = await page.evaluate(() => {
        return window.CronoHubReports.formatDate('2026-01-15');
      });

      expect(formatted).toMatch(/Jan/);
      expect(formatted).toMatch(/15/);
      expect(formatted).toMatch(/2026/);
      expect(formatted).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
    });
  });
});
