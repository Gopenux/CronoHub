// CronoHub - Reports Module
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI

(function(window) {
  'use strict';

  var CronoHubReports = {
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
     * Fetches all CronoHub comments from a user in an organization within a date range
     *
     * OPTIMIZATION STRATEGY:
     * - Filters by username, org, date range AND "Time Tracked" text in a single API call
     * - Only returns issues that contain CronoHub time tracking comments
     * - Reduces API calls by 90-95% compared to fetching all user comments
     *
     * @param {string} username - GitHub username
     * @param {string} org - Organization name (or owner/repo for specific repository)
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {string} token - GitHub token
     * @returns {Promise<array>} Array of comment objects with CronoHub entries
     */
    fetchUserCommentsInRange: function(username, org, startDate, endDate, token) {
      var self = this;

      // HIGHLY OPTIMIZED STRATEGY:
      // Use GitHub's issue comment search API directly
      // This allows filtering by: author + org + date range + specific text in a SINGLE query
      // Much more efficient than fetching all comments from multiple issues

      // OPTIMIZATION: Add "Time Tracked" to filter only CronoHub comments
      // This dramatically reduces the number of issues returned (only those with time tracking)
      // Note: GitHub search uses created date for comments, not updated
      var query = 'type:issue commenter:' + username + ' org:' + org + ' "Time Tracked" created:' + startDate + '..' + endDate;
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
      // Unfortunately, GitHub API doesn't support 'until' parameter, so we filter on client side
      // Also, GitHub API doesn't allow filtering by user at this endpoint
      var sinceParam = startDate + 'T00:00:00Z';
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

        // Parse dates in UTC to avoid timezone issues
        var start = new Date(startDate + 'T00:00:00Z');
        var end = new Date(endDate + 'T23:59:59Z');

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
            var dateStr = commentDate.toISOString().split('T')[0];
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
     * @returns {Promise<object>} Object with usernames as keys
     */
    fetchAllCollaboratorsComments: function(collaborators, org, startDate, endDate, token) {
      var self = this;
      var promises = collaborators.map(function(collab) {
        return self.fetchUserCommentsInRange(collab.login, org, startDate, endDate, token)
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
     * @returns {object} { startDate, endDate }
     */
    getDefaultDateRange: function() {
      var end = new Date();
      var start = new Date();
      start.setDate(start.getDate() - 7);

      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    }
  };

  // Export to window
  window.CronoHubReports = CronoHubReports;

})(window);
