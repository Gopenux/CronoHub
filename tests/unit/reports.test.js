// CronoHub - Reports Module Unit Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const fs = require('fs');
const path = require('path');

describe('CronoHub Reports Module', () => {
  let CronoHubReports;

  beforeAll(() => {
    // Load reports.js into a simulated browser environment
    const reportsPath = path.join(__dirname, '../../reports.js');
    const reportsCode = fs.readFileSync(reportsPath, 'utf8');

    // Create a minimal window mock
    const windowMock = {};

    // Execute the IIFE with our mock
    const fn = new Function('window', reportsCode + '\nreturn window.CronoHubReports;');
    CronoHubReports = fn(windowMock);
  });

  describe('validateDateRange', () => {
    test('should validate correct date range', () => {
      const result = CronoHubReports.validateDateRange('2026-01-01', '2026-01-31');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject missing dates', () => {
      const result = CronoHubReports.validateDateRange('', '2026-01-31');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Both start and end dates are required');
    });

    test('should reject invalid date format', () => {
      const result = CronoHubReports.validateDateRange('invalid', '2026-01-31');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });

    test('should reject end date before start date', () => {
      const result = CronoHubReports.validateDateRange('2026-01-31', '2026-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('End date cannot be before start date');
    });

    test('should reject range exceeding 90 days', () => {
      const result = CronoHubReports.validateDateRange('2026-01-01', '2026-04-15');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Date range cannot exceed 90 days');
    });

    test('should accept range exactly 90 days', () => {
      const result = CronoHubReports.validateDateRange('2026-01-01', '2026-04-01');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should accept same day range', () => {
      const result = CronoHubReports.validateDateRange('2026-01-15', '2026-01-15');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('parseTimeFromComment', () => {
    test('should parse valid CronoHub comment with single hour', () => {
      const comment = '⏱️ **Time Tracked:** 1 Hour\n\nWorked on feature';
      const hours = CronoHubReports.parseTimeFromComment(comment);
      expect(hours).toBe(1);
    });

    test('should parse valid CronoHub comment with multiple hours', () => {
      const comment = '⏱️ **Time Tracked:** 3.5 Hours\n\nWorked on feature';
      const hours = CronoHubReports.parseTimeFromComment(comment);
      expect(hours).toBe(3.5);
    });

    test('should parse comment with decimal hours', () => {
      const comment = '⏱️ **Time Tracked:** 2.25 Hours\n\nFixed bugs';
      const hours = CronoHubReports.parseTimeFromComment(comment);
      expect(hours).toBe(2.25);
    });

    test('should return 0 for non-CronoHub comment', () => {
      const comment = 'Just a regular comment without time tracking';
      const hours = CronoHubReports.parseTimeFromComment(comment);
      expect(hours).toBe(0);
    });

    test('should return 0 for null comment', () => {
      const hours = CronoHubReports.parseTimeFromComment(null);
      expect(hours).toBe(0);
    });

    test('should return 0 for empty comment', () => {
      const hours = CronoHubReports.parseTimeFromComment('');
      expect(hours).toBe(0);
    });

    test('should be case insensitive', () => {
      const comment = '⏱️ **time tracked:** 2 hours\n\nDescription';
      const hours = CronoHubReports.parseTimeFromComment(comment);
      expect(hours).toBe(2);
    });

    test('should handle extra whitespace', () => {
      const comment = '⏱️   **Time Tracked:**   4.5   Hours  \n\nDescription';
      const hours = CronoHubReports.parseTimeFromComment(comment);
      expect(hours).toBe(4.5);
    });
  });

  describe('localDateToUTC', () => {
    test('should convert local date to UTC timestamp for start of day', () => {
      const result = CronoHubReports.localDateToUTC('2026-01-19', false);

      // Result should be in ISO format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Should represent start of day in local timezone converted to UTC
      const date = new Date(result);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeGreaterThan(0);
    });

    test('should convert local date to UTC timestamp for end of day', () => {
      const result = CronoHubReports.localDateToUTC('2026-01-19', true);

      // Result should be in ISO format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Should represent end of day (23:59:59.999)
      const date = new Date(result);
      expect(date).toBeInstanceOf(Date);

      // End of day should be after start of day
      const startOfDay = CronoHubReports.localDateToUTC('2026-01-19', false);
      expect(new Date(result).getTime()).toBeGreaterThan(new Date(startOfDay).getTime());
    });

    test('should handle timezone offsets correctly', () => {
      // This test validates that local timezone is respected
      const localDate = '2026-01-19';
      const utcTimestamp = CronoHubReports.localDateToUTC(localDate, false);

      // Parse the local date manually to verify
      const expectedDate = new Date(2026, 0, 19, 0, 0, 0, 0);
      const actualDate = new Date(utcTimestamp);

      // Both should represent the same moment in time
      expect(actualDate.getTime()).toBe(expectedDate.getTime());
    });
  });

  describe('utcToLocalDate', () => {
    test('should convert UTC date to local date string', () => {
      const utcDate = new Date('2026-01-19T23:30:00Z');
      const result = CronoHubReports.utcToLocalDate(utcDate);

      // Result should be in YYYY-MM-DD format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Should use local timezone for the date
      const expectedDate = utcDate.getFullYear() + '-' +
                          String(utcDate.getMonth() + 1).padStart(2, '0') + '-' +
                          String(utcDate.getDate()).padStart(2, '0');
      expect(result).toBe(expectedDate);
    });

    test('should handle date near timezone boundaries', () => {
      // Test with a UTC date that might be in a different day in local timezone
      const utcDate = new Date('2026-01-20T04:30:00Z');
      const result = CronoHubReports.utcToLocalDate(utcDate);

      // Should convert to local date (in Colombia UTC-5, this would be 2026-01-19)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify it uses getFullYear, getMonth, getDate (local methods)
      const expectedDate = utcDate.getFullYear() + '-' +
                          String(utcDate.getMonth() + 1).padStart(2, '0') + '-' +
                          String(utcDate.getDate()).padStart(2, '0');
      expect(result).toBe(expectedDate);
    });

    test('should handle dates consistently with localDateToUTC', () => {
      // Round-trip test: local -> UTC -> local should give same date
      const originalDate = '2026-01-19';
      const utcTimestamp = CronoHubReports.localDateToUTC(originalDate, false);
      const utcDate = new Date(utcTimestamp);
      const roundTripDate = CronoHubReports.utcToLocalDate(utcDate);

      // Should get back the same local date
      expect(roundTripDate).toBe(originalDate);
    });
  });

  describe('aggregateHoursByDate', () => {
    test('should group comments by date', () => {
      const comments = [
        { date: '2026-01-15', hours: 2, comment: 'Task 1' },
        { date: '2026-01-15', hours: 1.5, comment: 'Task 2' },
        { date: '2026-01-16', hours: 3, comment: 'Task 3' }
      ];

      const grouped = CronoHubReports.aggregateHoursByDate(comments);

      expect(Object.keys(grouped).length).toBe(2);
      expect(grouped['2026-01-15'].length).toBe(2);
      expect(grouped['2026-01-16'].length).toBe(1);
    });

    test('should handle empty comments array', () => {
      const grouped = CronoHubReports.aggregateHoursByDate([]);
      expect(Object.keys(grouped).length).toBe(0);
    });

    test('should preserve all comment data', () => {
      const comments = [
        { date: '2026-01-15', hours: 2, comment: 'Task 1', url: 'http://example.com' }
      ];

      const grouped = CronoHubReports.aggregateHoursByDate(comments);

      expect(grouped['2026-01-15'][0].hours).toBe(2);
      expect(grouped['2026-01-15'][0].comment).toBe('Task 1');
      expect(grouped['2026-01-15'][0].url).toBe('http://example.com');
    });
  });

  describe('calculateTotalHours', () => {
    test('should calculate total from grouped data', () => {
      const groupedData = {
        '2026-01-15': [
          { hours: 2 },
          { hours: 1.5 }
        ],
        '2026-01-16': [
          { hours: 3 }
        ]
      };

      const total = CronoHubReports.calculateTotalHours(groupedData);
      expect(total).toBe(6.5);
    });

    test('should return 0 for empty data', () => {
      const total = CronoHubReports.calculateTotalHours({});
      expect(total).toBe(0);
    });

    test('should handle decimal hours correctly', () => {
      const groupedData = {
        '2026-01-15': [
          { hours: 2.25 },
          { hours: 1.75 }
        ]
      };

      const total = CronoHubReports.calculateTotalHours(groupedData);
      expect(total).toBe(4);
    });
  });

  describe('formatDate', () => {
    test('should format date in en-US locale', () => {
      const formatted = CronoHubReports.formatDate('2026-01-15');
      expect(formatted).toMatch(/Jan/);
      expect(formatted).toMatch(/15/);
      expect(formatted).toMatch(/2026/);
    });

    test('should include weekday', () => {
      const formatted = CronoHubReports.formatDate('2026-01-15');
      expect(formatted).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
    });
  });

  describe('getDefaultDateRange', () => {
    test('should return object with startDate and endDate', () => {
      const range = CronoHubReports.getDefaultDateRange();
      expect(range).toHaveProperty('startDate');
      expect(range).toHaveProperty('endDate');
    });

    test('should return dates in YYYY-MM-DD format', () => {
      const range = CronoHubReports.getDefaultDateRange();
      expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should return 7 day range', () => {
      const range = CronoHubReports.getDefaultDateRange();
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(7);
    });

    test('should have end date after or equal to start date', () => {
      const range = CronoHubReports.getDefaultDateRange();
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);

      expect(end >= start).toBe(true);
    });

    test('should use local timezone for date calculation (fix for issue #29)', () => {
      // This test validates that dates are calculated using local timezone
      // and not UTC, which was causing wrong dates in timezones west of UTC
      const range = CronoHubReports.getDefaultDateRange();
      const now = new Date();

      // Extract today's date using local timezone methods
      const expectedToday = now.getFullYear() + '-' +
                           String(now.getMonth() + 1).padStart(2, '0') + '-' +
                           String(now.getDate()).padStart(2, '0');

      // End date should match today's date in local timezone
      expect(range.endDate).toBe(expectedToday);

      // Verify that the date doesn't accidentally use UTC
      const utcDate = now.toISOString().split('T')[0];
      // In timezones west of UTC, after certain hours these will differ
      // This test ensures we're using local time, not UTC
      if (expectedToday !== utcDate) {
        // If they differ, confirm we're using the local one
        expect(range.endDate).toBe(expectedToday);
        expect(range.endDate).not.toBe(utcDate);
      }
    });
  });

  describe('fetchUserCommentsInRange - API Query Construction (Regression Test for Issue #13)', () => {
    let originalFetch;
    let fetchSpy;

    beforeEach(() => {
      // Mock global fetch
      originalFetch = global.fetch;
      fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ items: [] })
      });
      global.fetch = fetchSpy;
    });

    afterEach(() => {
      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('should use "updated:" filter instead of "created:" in search query', async () => {
      // Act: Call the function with a specific date range
      await CronoHubReports.fetchUserCommentsInRange(
        'testuser',
        'testorg',
        '2026-01-19',
        '2026-01-19',
        'test-token'
      );

      // Assert: Verify fetch was called
      expect(fetchSpy).toHaveBeenCalled();

      // Get the URL from the first call
      const callUrl = fetchSpy.mock.calls[0][0];

      // Verify the query contains "updated:" not "created:" (URL encoded)
      expect(callUrl).toContain('updated%3A2026-01-19..2026-01-19');
      expect(callUrl).not.toContain('created%3A2026-01-19..2026-01-19');
    });

    test('should construct correct search query with all required parameters', async () => {
      // Act
      await CronoHubReports.fetchUserCommentsInRange(
        'john',
        'myorg',
        '2026-01-15',
        '2026-01-20',
        'token123'
      );

      // Assert
      expect(fetchSpy).toHaveBeenCalled();
      const callUrl = fetchSpy.mock.calls[0][0];

      // Verify all query components are present (URL encoded)
      expect(callUrl).toContain('type%3Aissue');
      expect(callUrl).toContain('commenter%3Ajohn');
      expect(callUrl).toContain('org%3Amyorg');
      expect(callUrl).toContain('Time%20Tracked'); // URL encoded
      expect(callUrl).toContain('updated%3A2026-01-15..2026-01-20');

      // Verify Authorization header
      const callOptions = fetchSpy.mock.calls[0][1];
      expect(callOptions.headers.Authorization).toBe('Bearer token123');
    });

    test('should use issue updated date as proxy for comment date (not issue created date)', async () => {
      // This test documents the behavior fix for issue #13:
      // When searching for comments in a date range, we must use "updated:"
      // because GitHub Search API doesn't support filtering by comment creation date.
      // Using "created:" would filter by issue creation date, missing issues
      // that were created before the range but had comments within the range.

      await CronoHubReports.fetchUserCommentsInRange(
        'helysm',
        'Gopenux',
        '2026-01-19',
        '2026-01-19',
        'token'
      );

      const callUrl = fetchSpy.mock.calls[0][0];

      // The key assertion: must use "updated:" for issues with recent comment activity (URL encoded)
      expect(callUrl).toMatch(/updated%3A\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}/);

      // Must NOT use "created:" which would miss older issues with new comments (URL encoded)
      expect(callUrl).not.toMatch(/created%3A\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('fetchUserCommentsInRange - Repository Filtering (Issue #21)', () => {
    let originalFetch;
    let fetchSpy;

    beforeEach(() => {
      // Mock global fetch
      originalFetch = global.fetch;
      fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ items: [] })
      });
      global.fetch = fetchSpy;
    });

    afterEach(() => {
      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('should use org-wide search when repo parameter is not provided', async () => {
      // Act: Call without repo parameter (backward compatibility)
      await CronoHubReports.fetchUserCommentsInRange(
        'testuser',
        'testorg',
        '2026-01-01',
        '2026-01-31',
        'test-token'
      );

      // Assert: Should use org: filter
      expect(fetchSpy).toHaveBeenCalled();
      const callUrl = fetchSpy.mock.calls[0][0];

      expect(callUrl).toContain('org%3Atestorg'); // org:testorg (URL encoded)
      expect(callUrl).not.toContain('repo%3A'); // Should NOT have repo: filter
    });

    test('should filter by specific repository when repo parameter is provided', async () => {
      // Act: Call with repo parameter
      await CronoHubReports.fetchUserCommentsInRange(
        'testuser',
        'testorg',
        '2026-01-01',
        '2026-01-31',
        'test-token',
        'CronoHub' // repo parameter
      );

      // Assert: Should use repo: filter instead of org:
      expect(fetchSpy).toHaveBeenCalled();
      const callUrl = fetchSpy.mock.calls[0][0];

      expect(callUrl).toContain('repo%3Atestorg%2FCronoHub'); // repo:testorg/CronoHub (URL encoded)
      expect(callUrl).not.toContain('org%3Atestorg'); // Should NOT have org: filter
    });

    test('should construct correct query with repo filter and all other parameters', async () => {
      // Act
      await CronoHubReports.fetchUserCommentsInRange(
        'john',
        'myorg',
        '2026-01-15',
        '2026-01-20',
        'token123',
        'my-repo'
      );

      // Assert
      expect(fetchSpy).toHaveBeenCalled();
      const callUrl = fetchSpy.mock.calls[0][0];

      // Verify all query components with repo filter
      expect(callUrl).toContain('type%3Aissue');
      expect(callUrl).toContain('commenter%3Ajohn');
      expect(callUrl).toContain('repo%3Amyorg%2Fmy-repo'); // repo:myorg/my-repo (URL encoded)
      expect(callUrl).toContain('Time%20Tracked');
      expect(callUrl).toContain('updated%3A2026-01-15..2026-01-20');
    });

    test('should handle special characters in repository name', async () => {
      // Act: Repository with hyphens and dots
      await CronoHubReports.fetchUserCommentsInRange(
        'user',
        'org',
        '2026-01-01',
        '2026-01-31',
        'token',
        'my-repo.js'
      );

      // Assert
      const callUrl = fetchSpy.mock.calls[0][0];
      expect(callUrl).toContain('repo%3Aorg%2Fmy-repo.js'); // Should encode properly
    });
  });

  describe('fetchAllCollaboratorsComments - Repository Filtering (Issue #21)', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('should pass repo parameter to fetchUserCommentsInRange for each collaborator', async () => {
      // Mock fetch to track calls
      const fetchCalls = [];
      global.fetch = jest.fn((url, options) => {
        fetchCalls.push({ url, options });
        return Promise.resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ items: [] })
        });
      });

      const collaborators = [
        { login: 'user1', avatar_url: 'avatar1.jpg' },
        { login: 'user2', avatar_url: 'avatar2.jpg' }
      ];

      // Act: Call with repo parameter
      await CronoHubReports.fetchAllCollaboratorsComments(
        collaborators,
        'testorg',
        '2026-01-01',
        '2026-01-31',
        'token',
        'test-repo'
      );

      // Assert: Should have made 2 calls (one per collaborator) with repo filter
      expect(fetchCalls.length).toBe(2);

      // Both calls should use repo: filter
      expect(fetchCalls[0].url).toContain('repo%3Atestorg%2Ftest-repo');
      expect(fetchCalls[1].url).toContain('repo%3Atestorg%2Ftest-repo');

      // Should NOT use org: filter
      expect(fetchCalls[0].url).not.toContain('org%3Atestorg');
      expect(fetchCalls[1].url).not.toContain('org%3Atestorg');
    });

    test('should use org-wide search when repo parameter is not provided', async () => {
      const fetchCalls = [];
      global.fetch = jest.fn((url, options) => {
        fetchCalls.push({ url, options });
        return Promise.resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ items: [] })
        });
      });

      const collaborators = [
        { login: 'user1', avatar_url: 'avatar1.jpg' }
      ];

      // Act: Call without repo parameter
      await CronoHubReports.fetchAllCollaboratorsComments(
        collaborators,
        'testorg',
        '2026-01-01',
        '2026-01-31',
        'token'
      );

      // Assert: Should use org: filter
      expect(fetchCalls[0].url).toContain('org%3Atestorg');
      expect(fetchCalls[0].url).not.toContain('repo%3A');
    });
  });
});
