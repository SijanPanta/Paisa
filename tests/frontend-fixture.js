'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const assets = path.resolve(__dirname, '../app/src/main/assets');

const expectedHeadScripts = ['js/theme-init.js'];
const expectedScripts = ['state', 'undo', 'icons', 'native', 'biometric', 'formatters', 'views', 'wallets',
  'transactions', 'account-picker', 'loans', 'friends', 'split', 'dialogs', 'navigation', 'data-tools', 'app'].map(name => `js/${name}.js`);

function decode(text) {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'"
  })[entity]);
}

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback, options) {
    const entries = this.listeners.get(type) || [];
    if (!entries.some(entry => entry.callback === callback)) entries.push({ callback, options });
    this.listeners.set(type, entries);
  }
  dispatchEvent(event) {
    event.target ||= this;
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    event.stopPropagation ||= () => {};
    for (const { callback } of this.listeners.get(event.type) || []) callback.call(this, event);
    return !event.defaultPrevented;
  }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class Element extends Events {
  constructor(tagName, attributes = {}) {
    super();
    this.tagName = tagName.toUpperCase();
    this.attributes = attributes;
    this.id = attributes.id || '';
    this.className = attributes.class || '';
    this.dataset = {};
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    this.style = {};
    for (const declaration of (attributes.style || '').split(';')) {
      const index = declaration.indexOf(':');
      if (index > 0) this.style[declaration.slice(0, index).trim()] = declaration.slice(index + 1).trim();
    }
    this.children = [];
    this.parentElement = null;
    this._value = attributes.value || '';
    this._text = '';
    this._html = '';
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle: (name, force) => {
        const enabled = force === undefined ? !this.classList.contains(name) : force;
        this.classList[enabled ? 'add' : 'remove'](name);
        return enabled;
      }
    };
  }
  get value() { return this._value; }
  set value(value) {
    value = String(value);
    this._value = this.tagName === 'SELECT' && !this.querySelectorAll('option').some(o => o.value === value) ? '' : value;
  }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(value) {
    this._html = String(value);
    this._text = '';
    this.children = [];
    parseInto(this, this._html);
    if (this.tagName === 'SELECT') this._value = this.querySelector('option')?.value || '';
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  querySelectorAll(selector) {
    const parts = selector.trim().match(/(?:[^\s"']|"[^"]*"|'[^']*')+/g);
    const result = [];
    const visit = node => {
      for (const child of node.children) {
        if (matches(child, parts.at(-1))) {
          let ancestor = child.parentElement;
          let index = parts.length - 2;
          while (index >= 0 && ancestor) {
            if (matches(ancestor, parts[index])) index--;
            ancestor = ancestor.parentElement;
          }
          if (index < 0) result.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  click() { this.dispatchEvent({ type: 'click' }); }
  focus() { this.focused = true; }
  scrollIntoView(options) { this.lastScroll = options; }
}

function matches(element, selector) {
  const tag = selector.match(/^[\w-]+/);
  if (tag && element.tagName !== tag[0].toUpperCase()) return false;
  for (const [, id] of selector.matchAll(/#([\w-]+)/g)) if (element.id !== id) return false;
  for (const [, name] of selector.matchAll(/\.([\w-]+)/g)) if (!element.classList.contains(name)) return false;
  for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (element.getAttribute(name) === null || (value !== undefined && element.getAttribute(name) !== value)) return false;
  }
  return true;
}

function parseInto(root, html) {
  const stack = [root];
  const clean = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  for (const token of clean.match(/<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith('</')) {
      const tag = token.slice(2, -1).trim().toUpperCase();
      const index = stack.findLastIndex(node => node.tagName === tag);
      if (index > 0) stack.length = index;
    } else if (/^<[a-z]/i.test(token)) {
      const [, tag, rest] = token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/);
      const attrs = {};
      for (const [, name, double, single, bare] of rest.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        attrs[name] = decode(double ?? single ?? bare ?? '');
      }
      const node = stack.at(-1).appendChild(new Element(tag, attrs));
      if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag) && !token.endsWith('/>')) stack.push(node);
    } else if (!token.startsWith('<')) stack.at(-1)._text += decode(token);
  }
}

function createApp(options = {}) {
  const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
  const document = new Element('document');
  parseInto(document, html);
  document.body = document.querySelector('body');
  document.documentElement = document;
  document.getElementById = id => document.querySelector(`#${id}`);
  document.createElement = tag => new Element(tag);
  const storage = new Map(Object.entries(options.storage || {}));
  const calls = { alerts: [], vibrations: [], clipboard: [], errors: [], scrolls: [] };
  const timers = [];
  const windowEvents = new Events();
  const sandbox = {
    document,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    navigator: {
      vibrate: ms => calls.vibrations.push(ms),
      clipboard: { writeText: text => { calls.clipboard.push(text); return Promise.resolve(); } },
      ...options.navigator
    },
    alert: message => calls.alerts.push(message),
    console: { log() {}, warn() {}, error: (...args) => calls.errors.push(args) },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {},
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    scrollTo: options => calls.scrolls.push(options),
    FileReader: class {
      readAsText(file) { this.onload({ target: { result: file.content } }); }
    }
  };
  sandbox.window = sandbox;
  if (options.bridge) sandbox.AndroidBridge = options.bridge;
  const context = vm.createContext(sandbox);
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = match[1].match(/\bsrc=["']([^"']+)["']/)?.[1];
    vm.runInContext(src ? fs.readFileSync(path.join(assets, src), 'utf8') : match[2], context, {
      filename: src || 'index.html:inline'
    });
  }
  const evaluate = code => vm.runInContext(code, context);
  return {
    html, context, document, calls, storage, timers,
    get state() { return evaluate('state'); },
    evaluate,
    call: (name, ...args) => context[name](...args),
    element: id => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing real HTML element #${id}`);
      return element;
    },
    start: () => document.dispatchEvent({ type: 'DOMContentLoaded' }),
    flushTimers: () => { for (const { callback } of timers.splice(0)) callback(); },
    touch: () => windowEvents.dispatchEvent({ type: 'touchstart' }),
    restore: content => context.handleFileRestore({ target: { files: [{ content }] } })
  };
}

module.exports = { createApp, assets, expectedScripts, expectedHeadScripts };
