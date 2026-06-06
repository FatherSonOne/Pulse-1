// Headless screenshot verification for slack-redesign.html (Phase 8 mockup).
// Run: node _design-playground/_shoot-slack.mjs
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const file = 'file://' + path.resolve('_design-playground/slack-redesign.html');
const out = path.resolve('_design-playground/_shots');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(file, { waitUntil: 'load' });
await page.waitForTimeout(1200); // let Tailwind CDN + fonts settle

const shoot = (name) => page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });

await shoot('A-dark');
await page.click('[data-dir="B"]'); await page.waitForTimeout(500); await shoot('B-dark');
await page.click('[data-dir="C"]'); await page.waitForTimeout(500); await shoot('C-dark');
await page.click('[data-dir="A"]'); await page.waitForTimeout(200);
await page.click('#themeBtn'); await page.waitForTimeout(500); await shoot('A-light');

console.log('CONSOLE_ERRORS:', errors.length ? errors.join(' || ') : 'none');
await browser.close();
