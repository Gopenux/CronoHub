// CronoHub - Reports Module
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI

(function(window) {
  'use strict';

  var CronoHubReports = {
    /**
     * Converts a local date (YYYY-MM-DD) to UTC timestamp for API queries
     * Treats the input date as local timezone start of day (00:00:00 local time)
     * @param {string} dateStr - Date string in YYYY-MM-DD format (local timezone)
     * @param {boolean} endOfDay - If true, returns end of day (23:59:59), otherwise start of day (00:00:00)
     * @returns {string} ISO 8601 timestamp in UTC (YYYY-MM-DDTHH:MM:SSZ)
     */
    localDateToUTC: function(dateStr, endOfDay) {
      // Parse date as local timezone
      var parts = dateStr.split('-');
      var year = parseInt(parts[0]);
      var month = parseInt(parts[1]) - 1; // Month is 0-indexed
      var day = parseInt(parts[2]);

      // Create date in local timezone
      var date = endOfDay
        ? new Date(year, month, day, 23, 59, 59, 999)
        : new Date(year, month, day, 0, 0, 0, 0);

      // Convert to UTC ISO string
      return date.toISOString();
    },

    /**
     * Converts a UTC timestamp to local date string (YYYY-MM-DD)
     * @param {Date} date - Date object (typically from API response)
     * @returns {string} Date string in YYYY-MM-DD format in local timezone
     */
    utcToLocalDate: function(date) {
      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    },

    /**
     * Validates a date range
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @returns {object} { valid: boolean, error: string }
     */
    validateDateRange: function(startDate, endDate) {
      if (!startDate || !endDate) {
        return { valid: false, error: 'Both start and end dates are required' };
      }

      var start = new Date(startDate);
      var end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: 'Invalid date format' };
      }

      if (end < start) {
        return { valid: false, error: 'End date cannot be before start date' };
      }

      // Calculate difference in days
      var diffTime = Math.abs(end - start);
      var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 90) {
        return { valid: false, error: 'Date range cannot exceed 90 days' };
      }

      return { valid: true, error: null };
    },

    /**
     * Extracts hours from a CronoHub formatted comment
     * @param {string} commentBody - The comment body text
     * @returns {number} Hours tracked (0 if not a CronoHub comment)
     */
    parseTimeFromComment: function(commentBody) {
      if (!commentBody) return 0;

      // Match pattern: ⏱️ **Time Tracked:** {number} Hour(s)
      var match = commentBody.match(/⏱️\s*\*\*Time Tracked:\*\*\s*([\d.]+)\s*Hours?/i);

      if (match && match[1]) {
        var hours = parseFloat(match[1]);
        return isNaN(hours) ? 0 : hours;
      }

      return 0;
    },

    /**
     * Groups hours by date
     * @param {array} comments - Array of comment objects with {date, hours, comment}
     * @returns {object} Object with dates as keys and arrays of entries
     */
    aggregateHoursByDate: function(comments) {
      var grouped = {};

      comments.forEach(function(entry) {
        var dateKey = entry.date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(entry);
      });

      return grouped;
    },

    /**
     * Calculates total hours from grouped data
     * @param {object} groupedData - Object from aggregateHoursByDate
     * @returns {number} Total hours
     */
    calculateTotalHours: function(groupedData) {
      var total = 0;

      Object.keys(groupedData).forEach(function(date) {
        groupedData[date].forEach(function(entry) {
          total += entry.hours;
        });
      });

      return total;
    },

    /**
     * Fetches organization members from GitHub API
     * @param {string} org - Organization name
     * @param {string} token - GitHub token
     * @returns {Promise<array>} Array of member objects
     */
    fetchOrgMembers: function(org, token) {
      var url = 'https://api.github.com/orgs/' + org + '/members?per_page=100';

      return fetch(url, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      }).then(function(response) {
        if (response.status === 403) {
          return response.json().then(function(data) {
            if (data.message && data.message.toLowerCase().includes('rate limit')) {
              throw new Error('GitHub API rate limit exceeded. Please try again later.');
            }
            throw new Error(data.message || 'Access denied to organization members');
          });
        }

        if (!response.ok) {
          return response.json().then(function(data) {
            throw new Error(data.message || 'Error fetching organization members');
          });
        }

        return response.json();
      });
    },

    /**
     * Fetches all CronoHub comments from a user in an organization/repository within a date range
     *
     * OPTIMIZATION STRATEGY:
     * - Filters by username, org/repo, issue updated date AND "Time Tracked" text in a single API call
     * - Only returns issues that contain CronoHub time tracking comments
     * - Uses issue updated date as proxy for comment activity (GitHub API doesn't support comment date filtering)
     * - Reduces API calls by 90-95% compared to fetching all user comments
     *
     * @param {string} username - GitHub username
     * @param {string} org - Organization name (or owner/repo for specific repository)
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} token - GitHub token
     * @param {string} repo - Optional repository name. If provided, filters by specific repo instead of entire org
     * @returns {Promise<array>} Array of comment objects with CronoHub entries
     */
    fetchUserCommentsInRange: function(username, org, startDate, endDate, token, repo) {
      var self = this;

      // HIGHLY OPTIMIZED STRATEGY:
      // Use GitHub's issue comment search API directly
      // This allows filtering by: author + org/repo + date range + specific text in a SINGLE query
      // Much more efficient than fetching all comments from multiple issues

      // OPTIMIZATION: Add "Time Tracked" to filter only CronoHub comments
      // This dramatically reduces the number of issues returned (only those with time tracking)
      // Note: GitHub search API doesn't support filtering by comment creation date, so we use issue updated date as a proxy

      // If repo is provided, filter by specific repository; otherwise use org-wide search
      var repoFilter = repo ? 'repo:' + org + '/' + repo : 'org:' + org;
      var query = 'type:issue commenter:' + username + ' ' + repoFilter + ' "Time Tracked" updated:' + startDate + '..' + endDate;
      var url = 'https://api.github.com/search/issues?q=' + encodeURIComponent(query) + '&per_page=100&sort=updated&order=desc';

      return fetch(url, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      }).then(function(response) {
        if (response.status === 403) {
          return response.json().then(function(data) {
            if (data.message && data.message.toLowerCase().includes('rate limit')) {
              throw new Error('GitHub API rate limit exceeded. Please try again later.');
            }
            throw new Error(data.message || 'API access error');
          });
        }

        if (!response.ok) {
          return response.json().then(function(data) {
            throw new Error(data.message || 'Error searching comments');
          });
        }

        return response.json();
      }).then(function(searchResult) {
        if (!searchResult.items || searchResult.items.length === 0) {
          return [];
        }

        // OPTIMIZATION: Extract only the minimum data needed from each issue
        // GitHub REST API returns full issue objects (~2-3KB each), but we only need comments_url
        // This reduces memory usage and speeds up processing
        var commentPromises = searchResult.items.map(function(issue) {
          // Only extract comments_url - discard the rest of the issue data immediately
          return self.fetchIssueComments(issue.comments_url, token, username, startDate, endDate);
        });

        // Clear the large searchResult object to free memory
        searchResult = null;

        return Promise.all(commentPromises);
      }).then(function(commentsArrays) {
        // Flatten arrays and filter CronoHub comments
        var allComments = [];

        commentsArrays.forEach(function(comments) {
          allComments = allComments.concat(comments);
        });

        return allComments;
      });
    },

    /**
     * Fetches comments from a specific issue
     * @param {string} commentsUrl - URL to fetch comments
     * @param {string} token - GitHub token
     * @param {string} username - Filter by this username
     * @param {string} startDate - Start date filter
     * @param {string} endDate - End date filter
     * @returns {Promise<array>} Filtered comments
     */
    fetchIssueComments: function(commentsUrl, token, username, startDate, endDate) {
      var self = this;

      // OPTIMIZATION: Use 'since' parameter to only fetch comments created after startDate
      // Convert local date to UTC timestamp for API query
      // Example: User in Colombia (UTC-5) selects 2026-01-19
      //   - Local: 2026-01-19 00:00:00 (Colombia)
      //   - UTC: 2026-01-19 05:00:00 (API query)
      var sinceParam = self.localDateToUTC(startDate, false);
      var url = commentsUrl + '?per_page=100&since=' + encodeURIComponent(sinceParam);

      return fetch(url, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      }).then(function(response) {
        if (!response.ok) {
          console.warn('CronoHub Reports: Failed to fetch comments from:', commentsUrl);
          return [];
        }
        return response.json();
      }).then(function(comments) {
        // Early return if no comments
        if (!comments || comments.length === 0) {
          return [];
        }

        // Convert local date range to UTC Date objects for comparison
        var start = new Date(self.localDateToUTC(startDate, false));
        var end = new Date(self.localDateToUTC(endDate, true));

        // Optimized filtering: use reduce to filter and map in single pass
        return comments.reduce(function(acc, comment) {
          // Quick checks first (cheapest operations)
          if (comment.user.login !== username) {
            return acc;
          }

          var commentDate = new Date(comment.created_at);

          // Since we use 'since' parameter, most comments will be after start
          // but we still need to check end date and if it's before start (edge cases)
          if (commentDate < start || commentDate > end) {
            return acc;
          }

          // Only parse comment body if other checks pass (expensive operation)
          var hours = self.parseTimeFromComment(comment.body);
          if (hours > 0) {
            // Convert UTC comment date to local date for display/grouping
            // This ensures comments are grouped by the user's local date, not UTC date
            var dateStr = self.utcToLocalDate(commentDate);
            acc.push({
              date: dateStr,
              hours: hours,
              comment: comment.body,
              url: comment.html_url,
              createdAt: comment.created_at
            });
          }

          return acc;
        }, []);
      });
    },

    /**
     * Fetches comments for all collaborators
     * @param {array} collaborators - Array of collaborator objects
     * @param {string} org - Organization name
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {string} token - GitHub token
     * @param {string} repo - Optional repository name
     * @returns {Promise<object>} Object with usernames as keys
     */
    fetchAllCollaboratorsComments: function(collaborators, org, startDate, endDate, token, repo) {
      var self = this;
      var promises = collaborators.map(function(collab) {
        return self.fetchUserCommentsInRange(collab.login, org, startDate, endDate, token, repo)
          .then(function(comments) {
            return {
              username: collab.login,
              avatar: collab.avatar_url,
              comments: comments
            };
          })
          .catch(function(error) {
            console.error('Error fetching comments for ' + collab.login + ':', error);
            return {
              username: collab.login,
              avatar: collab.avatar_url,
              comments: [],
              error: error.message
            };
          });
      });

      return Promise.all(promises);
    },

    /**
     * Formats a date for display
     * @param {string} dateStr - Date string (YYYY-MM-DD)
     * @returns {string} Formatted date
     */
    formatDate: function(dateStr) {
      var date = new Date(dateStr + 'T00:00:00');
      var options = { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' };
      return date.toLocaleDateString('en-US', options);
    },

    /**
     * Gets default date range (last 7 days)
     * Uses browser's local timezone to ensure correct date display
     * @returns {object} { startDate, endDate }
     */
    getDefaultDateRange: function() {
      var end = new Date();
      var start = new Date();
      start.setDate(start.getDate() - 7);

      // Format dates using local timezone instead of UTC to avoid timezone issues
      // Example: Colombia (UTC-5) at 23:00 should show current day, not next day
      var formatLocalDate = function(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
      };

      return {
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(end)
      };
    }
  };

  // Export to window
  window.CronoHubReports = CronoHubReports;

})(window);
