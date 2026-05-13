#!/usr/bin/env node
// teams-notify hook entry — posts a Microsoft Teams notification when Claude Code
// awaits user input. Hooks are synchronous, so this script must exit quickly:
// timeouts, network errors and bad payloads all degrade to `exit 0` (never crash Claude).

const fs = require('fs');
const path = require('path');
const { loadConfig, appendLog, checkThrottle } = require('./config-helper.cjs');

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function truncate(text, maxChars) {
  if (typeof maxChars !== 'number' || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)) + '…';
}

function projectLabel(config, payload) {
  if (config.projectLabel && typeof config.projectLabel === 'string') return config.projectLabel;
  const cwd = (payload && typeof payload.cwd === 'string' && payload.cwd) || process.cwd();
  return path.basename(cwd) || cwd;
}

function classify(payload) {
  const name = payload && payload.hook_event_name;
  if (name === 'PreToolUse' && payload.tool_name === 'AskUserQuestion') {
    return 'askUserQuestion';
  }
  if (name === 'Notification') {
    const type = payload.notification_type;
    if (type === 'permission_prompt') return 'permissionPrompt';
    if (type === 'idle_prompt') return 'idlePrompt';
  }
  if (name === 'Stop') return 'stop';
  return null;
}

const VERBS = {
  askUserQuestion: 'czeka na odpowiedź',
  permissionPrompt: 'prosi o uprawnienie',
  idlePrompt: 'jest bezczynny',
  stop: 'skończył turę'
};

function extractQuestions(payload) {
  const input = payload && payload.tool_input;
  if (!input) return [];
  if (Array.isArray(input.questions)) return input.questions;
  return [];
}

function formatOptions(question) {
  if (!question || !Array.isArray(question.options)) return '';
  const labels = question.options
    .map(o => (o && typeof o.label === 'string' ? o.label : null))
    .filter(l => l && l.length > 0);
  if (labels.length === 0) return '';
  return `\n\n**Opcje**: ${labels.join(' · ')}`;
}

function buildMessage(config, payload, kind) {
  const verb = VERBS[kind] || '';
  const label = projectLabel(config, payload);
  const prefix = `**${config.messagePrefix} ${verb}** — _${label}_`;
  const detail = config.messageDetail || 'full';

  if (detail === 'minimal') return prefix;

  if (kind === 'askUserQuestion') {
    const questions = extractQuestions(payload);
    if (questions.length === 0) return prefix;

    const numbered = questions.length > 1;
    const parts = questions.map((q, i) => {
      const num = numbered ? `${i + 1}. ` : '';
      if (detail === 'header-only' || detail === 'summary') {
        const header = (q && typeof q.header === 'string' && q.header) || (q && typeof q.question === 'string' ? q.question : '');
        return `\n\n> ${num}${header}`;
      }
      // full
      const body = (q && typeof q.question === 'string' && q.question) || (q && typeof q.header === 'string' ? q.header : '');
      const opts = config.includeOptions ? formatOptions(q) : '';
      return `\n\n> ${num}${body}${opts}`;
    });
    return prefix + parts.join('');
  }

  if (kind === 'permissionPrompt') {
    const msg = (payload && typeof payload.notification_message === 'string' && payload.notification_message)
      || (payload && typeof payload.message === 'string' ? payload.message : '');
    if (msg && msg.length > 0) return `${prefix}\n\n${msg}`;
    return prefix;
  }

  // idlePrompt, stop → only prefix
  return prefix;
}

async function postWebhook(config, text) {
  const controller = new AbortController();
  const timeoutMs = typeof config.timeoutMs === 'number' && config.timeoutMs > 0 ? config.timeoutMs : 1500;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') return { ok: false, status: 0, timeout: true };
    return { ok: false, status: 0, error: e && e.message ? e.message : String(e) };
  }
}

async function main() {
  const raw = readStdinSync();
  if (!raw || raw.trim().length === 0) {
    process.exit(0);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    process.exit(0);
  }

  const { config, errors } = loadConfig();
  if (!config) {
    if (errors && errors.length > 0) {
      // Config file existed but is invalid — log to stderr only (no config = no log file path)
      try { process.stderr.write('teams-notify: ' + errors.join('; ') + '\n'); } catch (e) {}
    }
    process.exit(0);
  }

  if (!config.enabled) process.exit(0);

  const kind = classify(payload);
  if (!kind) process.exit(0);

  if (!config.events || config.events[kind] !== true) process.exit(0);

  const sessionId = (payload && typeof payload.session_id === 'string') ? payload.session_id : '';
  if (config.throttleMs && config.throttleMs > 0) {
    if (!checkThrottle(sessionId, config.throttleMs)) {
      appendLog(config, `throttled event=${kind} session=${sessionId}`);
      process.exit(0);
    }
  }

  let text;
  try {
    text = buildMessage(config, payload, kind);
  } catch (e) {
    appendLog(config, `build message failed: ${e && e.message ? e.message : String(e)}`);
    process.exit(0);
  }
  text = truncate(text, config.maxBodyChars);

  appendLog(config, `sending event=${kind} session=${sessionId} chars=${text.length}`);

  let result;
  try {
    result = await postWebhook(config, text);
  } catch (e) {
    appendLog(config, `post threw: ${e && e.message ? e.message : String(e)}`);
    process.exit(0);
  }

  if (result.timeout) {
    appendLog(config, `timeout after ${config.timeoutMs}ms event=${kind}`);
  } else if (result.ok) {
    appendLog(config, `sent ok status=${result.status} event=${kind}`);
  } else if (result.error) {
    appendLog(config, `error event=${kind}: ${result.error}`);
  } else {
    appendLog(config, `http ${result.status} event=${kind}`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
