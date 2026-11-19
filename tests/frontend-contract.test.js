'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, assets, expectedScripts, expectedHeadScripts } = require('./frontend-fixture');
const baselineGlobals = require('./baseline-globals.json');

const read = filename => fs.readFileSync(filename, 'utf8');

function localReferenceExists(reference, parent) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) return;
  const filename = path.resolve(parent, decodeURIComponent(reference.split(/[?#]/)[0]));
  assert.ok(filename.startsWith(assets + path.sep), `asset stays inside frontend: ${reference}`);
  assert.ok(fs.statSync(filename).isFile(), `missing local asset: ${filename}`);
}

test('frontend loads exactly the agreed ordered classic scripts at end of body', () => {
  const html = read(path.join(assets, 'index.html'));
  // Split: head scripts (theme-init etc.) vs body scripts (the full app)
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const headScripts = headMatch ? [...headMatch[1].matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)] : [];
  const bodyScripts = bodyMatch ? [...bodyMatch[1].matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)] : [];

  // Head scripts: exactly the agreed list (currently just theme-init)
  assert.deepEqual(headScripts.map(m => m[1].match(/\bsrc=["']([^"']+)["']/)?.[1]), expectedHeadScripts);
  // Body scripts: exactly the agreed ordered list
  assert.deepEqual(bodyScripts.map(m => m[1].match(/\bsrc=["']([^"']+)["']/)?.[1]), expectedScripts);

  // All scripts must be classic (no async/defer/module) with no inline content
  for (const match of [...headScripts, ...bodyScripts]) {
    assert.doesNotMatch(match[1], /\b(?:async|defer)\b|\btype\s*=\s*["']module["']/i);
    assert.equal(match[2].trim(), '', 'no executable inline startup script');
    localReferenceExists(match[1].match(/\bsrc=["']([^"']+)["']/)[1], assets);
  }
  // Last body script is immediately followed by </body></html>
  assert.match(html.slice(bodyScripts.at(-1).index + bodyMatch.index + '<body>'.length + bodyScripts.at(-1)[0].length), /^\s*<\/body>\s*<\/html>\s*$/i);
  // No markup elements after the first body script
  const firstBodyScript = bodyScripts[0].index;
  assert.doesNotMatch(bodyMatch[1].slice(firstBodyScript).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''), /<(?:div|section|button|nav|main)\b/i);
});

test('all static local script, stylesheet, image and CSS url paths exist', () => {
  const html = read(path.join(assets, 'index.html'));
  const stylesheets = [];
  for (const [, tag, attributes] of html.matchAll(/<(script|link|img)\b([^>]*)>/gi)) {
    const reference = attributes.match(/\b(?:src|href)=["']([^"']+)["']/)?.[1];
    if (!reference) continue;
    localReferenceExists(reference, assets);
    if (tag.toLowerCase() === 'link' && /\brel=["']stylesheet["']/i.test(attributes)) stylesheets.push(reference);
  }

  for (const reference of stylesheets) {
    if (/^[a-z]+:/i.test(reference)) continue;
    const filename = path.resolve(assets, reference);
    for (const [, url] of read(filename).matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)) {
      localReferenceExists(url, path.dirname(filename));
    }
  }
});

test('existing global functions and native callbacks survive extraction (except the two retired no-ops)', () => {
  const app = createApp();
  for (const name of baselineGlobals) assert.equal(typeof app.context[name], 'function', `global ${name}`);
  assert.equal(typeof app.context.initApp, 'function');
  assert.equal(app.document.listenerCount('DOMContentLoaded'), 1);
  assert.equal(app.element('fabAddBtn').listenerCount('click'), 0, 'bindings wait for DOMContentLoaded');
  assert.equal(app.evaluate('typeof WALLETS'), 'undefined');
});

test('static and rendered inline handlers compile and resolve their global function calls', () => {
  const app = createApp();
  app.state.bankAccounts.push({ id: 'Nabil', name: 'Nabil' });
  app.state.transactions.push({ id: 'tx-contract', type: 'expense', amount: 1, account: 'Cash', date: '2026-01-15', categoryId: 'food' });
  app.start();
  app.call('openAddModal');
  const handlers = [];
  const collect = root => {
    for (const child of root.children) {
      for (const [name, handler] of Object.entries(child.attributes)) if (/^on\w+/.test(name)) handlers.push(handler);
      collect(child);
    }
  };
  collect(app.document);
  assert.ok(handlers.length > 10, 'includes dynamically generated wallet, transaction and category handlers');
  for (const handler of handlers) {
    assert.doesNotThrow(() => new vm.Script(`(function(event) { ${handler} })`), handler);
    for (const [, name] of handler.matchAll(/(?<![\w.])([a-zA-Z_$][\w$]*)\s*\(/g)) {
      if (name === 'if') continue; // A conditional is not a global function call.
      assert.equal(typeof app.context[name], 'function', `${name} in ${handler}`);
    }
  }
});
