/**
 * Lint Validation Tests
 *
 * These tests ensure code quality by validating that all source files
 * pass ESLint checks without warnings or errors. This helps catch
 * common issues like unused variables, undefined references, etc.
 */

const { execSync } = require('child_process');
const path = require('path');

describe('Code Quality - Lint Validation', () => {
  test('should have no ESLint errors in source files', () => {
    // Run ESLint on source files
    const result = execSync('npx eslint content.js popup.js background.js reports.js', {
      cwd: path.join(__dirname, '../..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // If there are any errors, the test will fail
    expect(result).toBeDefined();
  });

  test('should have no ESLint errors in test files', () => {
    // Run ESLint on test files
    const result = execSync('npx eslint tests/', {
      cwd: path.join(__dirname, '../..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // If there are any errors, the test will fail
    expect(result).toBeDefined();
  });

  test('should validate no-unused-vars rule in all files', () => {
    try {
      // Run ESLint with specific focus on unused vars
      execSync('npx eslint --rule "no-unused-vars: error" content.js popup.js background.js reports.js tests/', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // If no error is thrown, all files pass
      expect(true).toBe(true);
    } catch (error) {
      // If ESLint finds issues, fail with descriptive message
      const output = error.stdout || error.stderr || error.message;
      throw new Error(`ESLint found unused variables:\n${output}`);
    }
  });

  test('should have ESLint configuration file present', () => {
    const fs = require('fs');
    const configPath = path.join(__dirname, '../../eslint.config.mjs');

    expect(fs.existsSync(configPath)).toBe(true);
  });

  test('should have lint script in package.json', () => {
    const packageJson = require('../../package.json');

    expect(packageJson.scripts).toHaveProperty('lint');
    expect(packageJson.scripts.lint).toContain('eslint');
  });
});
