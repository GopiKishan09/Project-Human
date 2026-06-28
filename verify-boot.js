/**
 * Static boot-flow verification (no Firebase network required).
 * Run: node verify-boot.js
 */
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/' });
const { document } = dom.window;

const checks = [];

function assert(name, condition) {
  checks.push({ name, pass: !!condition });
}

assert('Loading screen exists', !!document.getElementById('app-loading-screen'));
assert('Auth overlay exists', !!document.getElementById('auth-overlay'));
assert('App shell hidden by default', document.getElementById('app')?.hasAttribute('hidden'));
assert('Bottom nav hidden by default', document.getElementById('bottom-nav')?.hasAttribute('hidden'));
assert('No screen active by default', document.querySelectorAll('.screen.active').length === 0);
assert('Today screen not pre-active', !document.getElementById('screen-today')?.classList.contains('active'));

const appJs = readFileSync('app.js', 'utf8');
assert('handleAuthStateChange calls bootstrapUser', /if \(user\)[\s\S]*bootstrapUser\(userId\)/.test(appJs));
assert('No debug placeholder auth handler', !appJs.includes('baki ka code bootstrapUser'));
assert('renderCurrentScreen guarded by READY', /function renderCurrentScreen\(\)[\s\S]*getAppState\(\) !== 'READY'/.test(appJs));
assert('updateAppShellVisibility present', appJs.includes('function updateAppShellVisibility'));
assert('localStorage only for UI prefs', !appJs.match(/localStorage\.(get|set)Item\((?!STORAGE_KEYS|'isAndroidApp')/));

const css = readFileSync('index.css', 'utf8');
assert('FAB base styles defined', /\.fab\s*\{[\s\S]*position:\s*fixed/.test(css));
assert('border-color token defined', css.includes('--border-color:'));
assert('Modal overlay styles defined', /\.modal-overlay\s*\{[\s\S]*position:\s*fixed/.test(css));
assert('Button primary styles defined', /\.btn-primary\s*\{/.test(css));

const failed = checks.filter(c => !c.pass);
checks.forEach(c => console.log(`${c.pass ? 'PASS' : 'FAIL'}: ${c.name}`));
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
