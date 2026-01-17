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
  });
});
