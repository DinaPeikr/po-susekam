// Evals для /api/recipes: гоняет кейсы через тот же onRequestPost, что работает в проде,
// и проверяет ответы кодом. Запуск: npm run eval -- [--runs 3] [--only камни] [--concurrency 4]
// --rescore — перепроверить ответы последнего прогона без вызова API (после правки checks.mjs)
// Результат — таблица «проверка: прошло/всего», стоимость прогона и разница с прошлым прогоном.
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequestPost } from '../functions/api/recipes.js';
import { cases } from './cases.mjs';
import { runChecks } from './checks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resultsDir = join(root, 'evals', 'results');

// Цена claude-sonnet-5 за 1M токенов
const PRICE = { input: 2, output: 10 };

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const runs = Number(arg('runs', 1));
const concurrency = Number(arg('concurrency', 4));
const only = arg('only', '');
const rescore = args.includes('--rescore');

// Ключи и переменные — как у wrangler: .dev.vars + [vars] из wrangler.toml
const env = { RECIPES_COUNT: '6', SEARCH_ROUNDS: '2' };
for (const line of readFileSync(join(root, '.dev.vars'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (match) env[match[1]] = match[2];
}

// lib/claude.js пишет usage через console.log. Запросы идут параллельно, поэтому
// привязываем строку к своему запуску через AsyncLocalStorage, а не по порядку
const context = new AsyncLocalStorage();
const log = console.log;
console.log = (...parts) => {
  const store = context.getStore();
  if (store && parts[0] === 'usage') store.usage = JSON.parse(parts[1]);
  else if (!store) log(...parts);
};
console.error = () => {};

async function runOne(testCase, run) {
  const store = { usage: null };
  const started = Date.now();
  const response = await context.run(store, async () => {
    const request = new Request('http://local/api/recipes', {
      method: 'POST',
      body: JSON.stringify({ ingredients: testCase.ingredients, exclude: testCase.exclude }),
    });
    const res = await onRequestPost({ request, env });
    return { status: res.status, body: await res.json() };
  });
  return {
    id: testCase.id,
    run,
    seconds: (Date.now() - started) / 1000,
    usage: store.usage,
    response,
    checks: runChecks(testCase, response),
  };
}

// Простой пул: не больше concurrency запросов одновременно, чтобы не ловить 429
async function pool(tasks, size) {
  const results = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
      process.stdout.write(`\r  ${++done}/${tasks.length}`);
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  process.stdout.write('\n');
  return results;
}

mkdirSync(resultsDir, { recursive: true });
const previousFile = readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort().pop();
const previousRun = previousFile ? JSON.parse(readFileSync(join(resultsDir, previousFile), 'utf8')) : null;

let results;
if (rescore) {
  if (!previousRun) throw new Error('Нет прошлого прогона для --rescore');
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  results = previousRun.results
    .filter((r) => byId[r.id] && r.response)
    .map((r) => ({ ...r, checks: runChecks(byId[r.id], r.response) }));
  log(`Перепроверка ${previousFile}: ${results.length} ответов, API не вызывается`);
} else {
  const selected = cases.filter((c) => c.id.includes(only));
  const tasks = selected.flatMap((c) => Array.from({ length: runs }, (_, run) => () => runOne(c, run + 1)));
  log(`Кейсов: ${selected.length}, прогонов на кейс: ${runs}, запросов: ${tasks.length}`);
  results = await pool(tasks, concurrency);
}

// Сводка по проверкам
const byCheck = {};
for (const r of results) {
  for (const { name, error } of r.checks) {
    byCheck[name] ??= { pass: 0, total: 0, failures: [] };
    byCheck[name].total++;
    if (error) byCheck[name].failures.push(`${r.id}#${r.run}: ${error}`);
    else byCheck[name].pass++;
  }
}

const previous = previousRun?.summary;
const rate = (s) => (s.total ? s.pass / s.total : 0);

log('\nПроверка'.padEnd(52) + 'Прошло     Было');
for (const [name, s] of Object.entries(byCheck)) {
  const pct = `${s.pass}/${s.total}`.padEnd(8) + `${Math.round(rate(s) * 100)}%`.padStart(4);
  const before = previous?.[name];
  const delta = before ? `${Math.round(rate(before) * 100)}%` : '—';
  const mark = s.failures.length ? '✗' : '✓';
  log(`${mark} ${name}`.padEnd(52) + pct.padEnd(14) + delta);
}

const failures = Object.entries(byCheck).filter(([, s]) => s.failures.length);
if (failures.length) {
  log('\nПровалы:');
  for (const [name, s] of failures) {
    log(`  ${name}`);
    for (const f of s.failures) log(`    ${f}`);
  }
}

const totalChecks = Object.values(byCheck).reduce((a, s) => a + s.total, 0);
const passedChecks = Object.values(byCheck).reduce((a, s) => a + s.pass, 0);
const tokens = results.reduce((a, r) => ({
  input: a.input + (r.usage?.input_tokens || 0),
  output: a.output + (r.usage?.output_tokens || 0),
}), { input: 0, output: 0 });
const cost = (tokens.input * PRICE.input + tokens.output * PRICE.output) / 1e6;
const seconds = results.map((r) => r.seconds).sort((a, b) => a - b);

log(`\nИтого: ${passedChecks}/${totalChecks} проверок (${Math.round((passedChecks / totalChecks) * 100)}%)`);
log(`Токены: вход ${tokens.input}, выход ${tokens.output} → $${cost.toFixed(3)} за прогон, $${(cost / results.length).toFixed(4)} за запрос`);
log(`Время ответа: медиана ${seconds[Math.floor(seconds.length / 2)].toFixed(1)} с, максимум ${seconds.at(-1).toFixed(1)} с`);

const summary = Object.fromEntries(Object.entries(byCheck).map(([name, s]) => [name, { pass: s.pass, total: s.total }]));
const file = join(resultsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ runs: rescore ? previousRun.runs : runs, only, rescored: rescore ? previousFile : undefined, tokens, cost, summary, results }, null, 2));
log(`Сохранено: evals/results/${file.split(/[\\/]/).pop()}`);
