// CronoHub - Manifest Validation Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const fs = require('fs');
const path = require('path');

describe('Manifest V3 Validation', () => {
  let manifest;

  beforeAll(() => {
    const manifestPath = path.join(__dirname, '../../manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
  });

  test('should have manifest_version 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('should have required fields', () => {
    expect(manifest.name).toBeDefined();
    expect(manifest.version).toBeDefined();
    expect(manifest.description).toBeDefined();
  });

  test('should have a valid name', () => {
    expect(manifest.name).toBe('CronoHub');
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.name.length).toBeLessThanOrEqual(45);
  });

  test('should have a valid version', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('should have description with valid length', () => {
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  test('should have necessary permissions', () => {
    expect(manifest.permissions).toContain('storage');
    // activeTab is not needed - content scripts are injected declaratively
    expect(manifest.permissions).not.toContain('activeTab');
  });

  test('should have host_permissions for GitHub', () => {
    expect(manifest.host_permissions).toContain('https://github.com/*');
    expect(manifest.host_permissions).toContain('https://api.github.com/*');
  });

  test('should have action configured correctly', () => {
    expect(manifest.action).toBeDefined();
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.action.default_icon).toBeDefined();
    expect(manifest.action.default_icon['16']).toBeDefined();
    expect(manifest.action.default_icon['48']).toBeDefined();
    expect(manifest.action.default_icon['128']).toBeDefined();
  });

  test('should have content_scripts configured', () => {
    expect(manifest.content_scripts).toBeDefined();
    expect(Array.isArray(manifest.content_scripts)).toBe(true);
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
  });

  test('content_scripts should match GitHub paths', () => {
    const contentScript = manifest.content_scripts[0];
    // Updated to match all GitHub repository pages for SPA navigation
    expect(contentScript.matches).toContain('https://github.com/*/*');
    expect(contentScript.matches).toContain('https://github.com/orgs/*/projects/*');
  });

  test('content_scripts should include necessary files', () => {
    const contentScript = manifest.content_scripts[0];
    expect(contentScript.js).toContain('reports.js');
    expect(contentScript.js).toContain('content.js');
    expect(contentScript.css).toContain('styles/content.css');
  });

  test('content_scripts should load reports.js before content.js', () => {
    const contentScript = manifest.content_scripts[0];
    const reportsIndex = contentScript.js.indexOf('reports.js');
    const contentIndex = contentScript.js.indexOf('content.js');

    expect(reportsIndex).toBeLessThan(contentIndex);
  });

  test('should have icons in all required sizes', () => {
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons['16']).toBeDefined();
    expect(manifest.icons['48']).toBeDefined();
    expect(manifest.icons['128']).toBeDefined();
  });

  test('icon files should exist', () => {
    const iconSizes = ['16', '48', '128'];
    iconSizes.forEach(size => {
      const iconPath = path.join(__dirname, '../../', manifest.icons[size]);
      expect(fs.existsSync(iconPath)).toBe(true);
    });
  });

  test('referenced files should exist', () => {
    // Verify popup.html
    const popupPath = path.join(__dirname, '../../', manifest.action.default_popup);
    expect(fs.existsSync(popupPath)).toBe(true);

    // Verify content.js
    const contentScript = manifest.content_scripts[0];
    contentScript.js.forEach(jsFile => {
      const jsPath = path.join(__dirname, '../../', jsFile);
      expect(fs.existsSync(jsPath)).toBe(true);
    });

    // Verify content.css
    contentScript.css.forEach(cssFile => {
      const cssPath = path.join(__dirname, '../../', cssFile);
      expect(fs.existsSync(cssPath)).toBe(true);
    });
  });

  test('should have author defined', () => {
    expect(manifest.author).toBe('Gopenux AI - Gopenux Lab');
  });

  test('should not have deprecated Manifest V2 fields', () => {
    expect(manifest.browser_action).toBeUndefined();
    expect(manifest.page_action).toBeUndefined();
    expect(manifest.background?.scripts).toBeUndefined();
  });

  test('should have service worker configured (if background exists)', () => {
    if (manifest.background) {
      expect(manifest.background.service_worker).toBeDefined();
      expect(typeof manifest.background.service_worker).toBe('string');

      // Verify file exists
      const swPath = path.join(__dirname, '../../', manifest.background.service_worker);
      expect(fs.existsSync(swPath)).toBe(true);
    }
  });

  test('JSON structure should be valid', () => {
    const manifestPath = path.join(__dirname, '../../manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    expect(() => JSON.parse(manifestContent)).not.toThrow();
  });
});

// If run directly
if (require.main === module) {
  const manifestPath = path.join(__dirname, '../../manifest.json');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  console.log('✅ Valid Manifest V3');
  console.log(`   Name: ${manifest.name}`);
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Manifest Version: ${manifest.manifest_version}`);
}
