/* KakeMochin (web) — port of the SwiftUI app in D:\KakeMochin\KakeMochin.swiftpm.
   Everything is saved in this browser only (localStorage). No account, no network. */
'use strict';

const KEY = 'kakemochin.v1';
const PALETTE = ['#fab8c4', '#a6cff5', '#b3e3bf', '#fcd49e', '#ccbdf2', '#fae894', '#9ee0e0', '#edc2a8'];
const PALETTE_NAMES = ['Pink', 'Sky', 'Mint', 'Peach', 'Lavender', 'Lemon', 'Aqua', 'Apricot'];
const CURRENCIES = ['JPY', 'USD', 'EUR', 'GBP', 'KRW', 'TWD', 'AUD', 'CAD'];

/* ---------- dates (local time, day keys "YYYY-MM-DD") ---------- */
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
const daysInMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

/* ---------- shift math (same rules as Models.swift) ---------- */
const isOvernight = s => s.endMinutes <= s.startMinutes;
const spanMinutes = s => isOvernight(s) ? s.endMinutes + 1440 - s.startMinutes : s.endMinutes - s.startMinutes;
const workedMinutes = s => Math.max(0, spanMinutes(s) - (s.breakMinutes || 0));
const shiftHours = s => workedMinutes(s) / 60;
const shiftEnd = s => { const d = parseDay(s.date); d.setMinutes(s.startMinutes + spanMinutes(s)); return d; };

/* ---------- formatting ---------- */
const clock = m => { m = ((m % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const shortClock = m => { m = ((m % 1440) + 1440) % 1440; return m % 60 === 0 ? String(m / 60) : clock(m); };
const fmtHours = h => { const r = Math.round(h * 10) / 10; return Number.isInteger(r) ? `${r} h` : `${r.toFixed(1)} h`; };
const toMinutes = v => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const toTimeInput = m => { m = ((m % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- store ---------- */

function sampleData() {
  const cafe = { id: uid(), name: 'Café Mochi', hourlyWage: 1150, colorIndex: 0 };
  const books = { id: uid(), name: 'Bookstore', hourlyWage: 1300, colorIndex: 1 };
  const now = new Date(), ms = startOfMonth(now), n = daysInMonth(ms), shifts = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(ms.getFullYear(), ms.getMonth(), i + 1), wd = d.getDay();
    if (wd === 1 || wd === 3 || wd === 5) shifts.push({ id: uid(), jobID: cafe.id, date: dayKey(d), startMinutes: 1020, endMinutes: 1260, breakMinutes: 0 });
    if (wd === 6) shifts.push({ id: uid(), jobID: books.id, date: dayKey(d), startMinutes: 600, endMinutes: 960, breakMinutes: 60 });
  }
  const spendings = [];
  [[1, 650, 'Lunch'], [2, 380, 'Coffee'], [3, 1200, 'Books']].forEach(([ago, amount, note]) => {
    if (now.getDate() - ago >= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago, 12);
      spendings.push({ id: uid(), date: d.toISOString(), amount, note });
    }
  });
  return {
    jobs: [cafe, books], shifts,
    fixedExpenses: [['Rent', 42000], ['Phone bill', 2980], ['Transit pass', 6000], ['Spotify', 980], ['Netflix', 890]]
      .map(([name, amount]) => ({ id: uid(), name, amount })),
    spendings, monthlyGoal: 90000, currencyCode: 'JPY'
  };
}
const emptyData = () => ({ jobs: [], shifts: [], fixedExpenses: [], spendings: [], monthlyGoal: 100000, currencyCode: 'JPY' });

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(emptyData(), JSON.parse(raw)); } catch (e) { /* storage blocked */ }
  const d = sampleData();
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  return d;
}
let data = load();

function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('KakeMochin: failed to save', e); } render(); }
function upsert(list, item) { const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item); }

const jobById = id => data.jobs.find(j => j.id === id);
const pay = s => (jobById(s.jobID)?.hourlyWage || 0) * shiftHours(s);
const shiftsOn = day => data.shifts.filter(s => s.date === dayKey(day)).sort((a, b) => a.startMinutes - b.startMinutes);
const shiftsInMonth = m => data.shifts.filter(s => sameMonth(parseDay(s.date), m));
const fixedTotal = () => data.fixedExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
const nextColorIndex = () => { const used = new Set(data.jobs.map(j => j.colorIndex)); const i = PALETTE.findIndex((_, k) => !used.has(k)); return i >= 0 ? i : data.jobs.length; };
const color = i => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

function money(v) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: data.currencyCode }).format(v); }
  catch (e) { return `${Math.round(v)} ${data.currencyCode}`; }
}

function summary(month, now = new Date()) {
  const r = { hours: 0, projected: 0, earned: 0, shiftCount: 0 };
  for (const s of shiftsInMonth(month)) {
    const p = pay(s); r.hours += shiftHours(s); r.projected += p; r.shiftCount++;
    if (shiftEnd(s) <= now) r.earned += p;
  }
  return r;
}

function jobStats(month) {
  const list = shiftsInMonth(month);
  return data.jobs.map(job => {
    const mine = list.filter(s => s.jobID === job.id);
    const hours = mine.reduce((a, s) => a + shiftHours(s), 0);
    return { job, hours, earnings: hours * job.hourlyWage, shiftCount: mine.length, avg: mine.length ? hours / mine.length : null };
  }).sort((a, b) => b.job.hourlyWage - a.job.hourlyWage);
}

function budget(now = new Date()) {
  const income = summary(now, now).projected, fixed = fixedTotal(), disposable = income - fixed;
  const dim = daysInMonth(now), daily = disposable / dim;
  const monthSpend = data.spendings.filter(s => sameMonth(new Date(s.date), now));
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const spentMonth = monthSpend.reduce((a, s) => a + s.amount, 0);
  const spentToday = monthSpend.filter(s => dayKey(new Date(s.date)) === dayKey(now)).reduce((a, s) => a + s.amount, 0);
  const spentBefore = monthSpend.filter(s => new Date(s.date) < today0).reduce((a, s) => a + s.amount, 0);
  const daysLeft = Math.max(1, dim - now.getDate() + 1);
  const allowance = Math.max(0, (disposable - spentBefore) / daysLeft);
  return { income, fixed, disposable, daily, weekly: daily * 7, spentMonth, spentToday, allowance, left: allowance - spentToday };
}

/* Advisor.swift: which job to add hours at to reach the goal */
function advice(month, now = new Date()) {
  const stats = jobStats(month), best = stats[0];
  if (!best) return { icon: '💼', title: 'Add your first job', msg: 'Go to Settings → Jobs and add where you work. Then put your shifts on the calendar.' };
  const goal = data.monthlyGoal;
  if (!(goal > 0)) return { icon: '🎯', title: 'Set a monthly goal', msg: 'Add an income goal in Settings and KakeMochin will tell you which job to pick up hours at.' };
  if (!(best.job.hourlyWage > 0)) return { icon: '💴', title: 'Check your wages', msg: 'Add an hourly wage to each job in Settings so earnings can be calculated.' };
  const gap = goal - summary(month, now).projected;
  const runnerUp = stats.slice(1).find(s => s.job.hourlyWage < best.job.hourlyWage);
  if (gap <= 0) {
    let msg = `Your scheduled shifts already cover your goal, with ${money(-gap)} to spare.`;
    if (runnerUp) msg += ` If you want more free time, cut hours at ${runnerUp.job.name} first — ${best.job.name} pays ${money(best.job.hourlyWage - runnerUp.job.hourlyWage)} more per hour.`;
    return { icon: '✅', title: "You're on track 🎉", msg };
  }
  const hoursAtBest = Math.ceil(gap / best.job.hourlyWage);
  const shiftsNeeded = Math.max(1, Math.ceil(hoursAtBest / (best.avg || 4)));
  const word = shiftsNeeded === 1 ? 'shift' : 'shifts';
  let msg;
  if (runnerUp && runnerUp.job.hourlyWage > 0) {
    msg = `${best.job.name} pays more — adding ${hoursAtBest} more hours here gets you to your goal (about ${shiftsNeeded} ${word}). At ${runnerUp.job.name} it would take ${Math.ceil(gap / runnerUp.job.hourlyWage)} hours.`;
  } else {
    msg = `Adding ${hoursAtBest} more hours at ${best.job.name} gets you to your goal (about ${shiftsNeeded} ${word}).`;
  }
  return { icon: '💡', title: `${money(gap)} to go`, msg };
}

/* ---------- UI state ---------- */
const state = { tab: 'home', month: startOfMonth(new Date()) };
const app = document.getElementById('app');
const sheet = document.getElementById('sheet');

function shiftRow(s) {
  const job = jobById(s.jobID);
  const extra = (isOvernight(s) ? ' (next day)' : '') + (s.breakMinutes > 0 ? ` · break ${s.breakMinutes} min` : '');
  return `<div class="list-item" data-edit-shift="${s.id}">
    <span class="dot" style="background:${color(job?.colorIndex ?? 0)}"></span>
    <div class="grow"><div>${esc(job?.name ?? 'Unknown job')}</div>
    <div class="small muted">${clock(s.startMinutes)}–${clock(s.endMinutes)}${extra}</div></div>
    <div class="num small">${fmtHours(shiftHours(s))} · ${money(pay(s))}</div></div>`;
}

function renderHome() {
  const now = new Date(), today = shiftsOn(now), s = summary(now), goal = data.monthlyGoal;
  const pct = goal > 0 ? Math.round(s.projected / goal * 100) : 0, g = Math.max(goal, 1);
  const w = v => Math.min(Math.max(v / g, 0), 1) * 100;
  const a = advice(now), stats = jobStats(now), b = budget(now);
  const todaySp = data.spendings.filter(x => dayKey(new Date(x.date)) === dayKey(now)).sort((x, y) => y.date.localeCompare(x.date));
  return `<h1>KakeMochin</h1>
  <section class="card"><div class="hdr"><h2>☀️ Today</h2><span class="small muted">${now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
    ${today.length ? today.map(shiftRow).join('') : '<div class="muted">No shifts today — enjoy your day off.</div>'}</section>
  <section class="card"><div class="hdr"><h2>🎯 This month</h2></div>
    <div class="between"><div><div class="tiny muted">Estimated income</div><div class="big num">${money(s.projected)}</div></div>
    <div class="mid" style="color:var(--accent)">${pct}%</div></div>
    <div class="bar" role="img" aria-label="Goal progress ${Math.round(w(s.projected))} percent scheduled">
      <span style="width:${w(s.projected)}%;background:var(--accent-bar)"></span><span style="width:${w(s.earned)}%;background:var(--accent)"></span></div>
    <div class="between">
      <div><div class="tiny muted">Earned so far</div><b class="num small">${money(s.earned)}</b></div>
      <div><div class="tiny muted">Goal</div><b class="num small">${money(goal)}</b></div>
      <div><div class="tiny muted">Remaining</div><b class="num small">${money(Math.max(0, goal - s.projected))}</b></div></div></section>
  <section class="card row" style="align-items:flex-start"><div style="font-size:24px;width:32px">${a.icon}</div>
    <div class="grow"><b>${esc(a.title)}</b><div class="small muted">${esc(a.msg)}</div></div></section>
  ${stats.length ? `<section class="card"><div class="hdr"><h2>⇄ Compare jobs</h2></div>
    ${stats.map((st, i) => `<div class="row" style="padding:6px 0"><span class="dot" style="width:14px;height:14px;background:${color(st.job.colorIndex)}"></span>
      <div class="grow"><div>${esc(st.job.name)} ${i === 0 && stats.length > 1 ? '<span class="pill">Best rate</span>' : ''}</div>
      <div class="tiny muted">${money(st.job.hourlyWage)}/h · ${fmtHours(st.hours)}</div></div><b class="num">${money(st.earnings)}</b></div>`).join('')}</section>` : ''}
  <section class="card"><div class="hdr"><h2>👛 Budget</h2><button class="btn" data-act="log-spending">＋ Log spending</button></div>
    <div class="tiny muted">Left to spend today</div>
    <div class="mid num ${b.left < 0 ? 'neg' : ''}">${money(b.left)}</div>
    <div class="tiny muted">of ${money(b.allowance)} for today</div><hr>
    ${[['Income (estimated)', money(b.income)], ['Fixed expenses', '− ' + money(b.fixed)], ['Disposable income', money(b.disposable), 1], ['Per day', money(b.daily)], ['Per week', money(b.weekly)], ['Spent this month', money(b.spentMonth)]]
      .map(([l, v, bold]) => `<div class="between small" style="padding:3px 0"><span class="${bold ? '' : 'muted'}">${bold ? `<b>${l}</b>` : l}</span><span class="num">${bold ? `<b>${v}</b>` : v}</span></div>`).join('')}
    ${todaySp.length ? `<hr><div class="tiny muted">Today's spending</div>${todaySp.map(x => `<div class="row small"><span class="grow">${esc(x.note || 'Spending')}</span><span class="num">${money(x.amount)}</span><button class="x" data-del-spending="${x.id}" aria-label="Delete ${esc(x.note)}">✕</button></div>`).join('')}` : ''}
  </section>`;
}

function renderCalendar() {
  const m = state.month, now = new Date(), first = m.getDay(), n = daysInMonth(m);
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="day empty"></div>';
  for (let d = 1; d <= n; d++) {
    const day = new Date(m.getFullYear(), m.getMonth(), d), list = shiftsOn(day);
    cells += `<button class="day ${dayKey(day) === dayKey(now) ? 'today' : ''}" data-day="${dayKey(day)}" aria-label="${day.toDateString()}, ${list.length} shifts">
      <span class="n">${d}</span>
      ${list.slice(0, 2).map(s => `<span class="chip" style="background:${color(jobById(s.jobID)?.colorIndex ?? 0)}">${shortClock(s.startMinutes)}–${shortClock(s.endMinutes)}</span>`).join('')}
      ${list.length > 2 ? `<span class="tiny muted">+${list.length - 2}</span>` : ''}</button>`;
  }
  const s = summary(m), stats = jobStats(m);
  return `<div class="between"><h1>Calendar</h1><button class="icon-btn" data-act="new-shift" ${data.jobs.length ? '' : 'disabled'} aria-label="Add shift">＋</button></div>
  <div class="between" style="margin-bottom:12px"><button class="icon-btn" data-act="prev" aria-label="Previous month">‹</button>
    <div style="text-align:center"><b style="font-size:20px">${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
    ${sameMonth(m, now) ? '' : '<div><button class="btn" data-act="this-month" style="padding:2px 10px;font-size:12px">Today</button></div>'}</div>
    <button class="icon-btn" data-act="next" aria-label="Next month">›</button></div>
  <section class="card"><div class="grid">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<div class="wd">${x}</div>`).join('')}${cells}</div></section>
  <section class="card"><div class="hdr"><h2>Σ This month</h2></div>
    <div class="between"><span class="mid num">${money(s.projected)}</span><span class="small muted">${fmtHours(s.hours)} · ${s.shiftCount} shifts</span></div>
    ${stats.length ? '<hr>' + stats.map(st => `<div class="row small" style="padding:3px 0"><span class="dot" style="background:${color(st.job.colorIndex)}"></span><span class="grow">${esc(st.job.name)}</span><span class="muted">${fmtHours(st.hours)}</span><span class="num" style="min-width:80px;text-align:right">${money(st.earnings)}</span></div>`).join('') : ''}
  </section>`;
}

function renderSettings() {
  return `<h1>Settings</h1>
  <section class="card"><div class="hdr"><h2>Income goal</h2></div>
    <label class="f"><span>Monthly goal</span><input type="number" min="0" step="1000" inputmode="decimal" id="goal" value="${data.monthlyGoal}"></label>
    <label class="f"><span>Currency</span><select id="currency">${CURRENCIES.map(c => `<option ${c === data.currencyCode ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="tiny muted">Home compares your scheduled shifts with this goal.</div></section>
  <section class="card"><div class="hdr"><h2>Jobs</h2><button class="btn" data-act="new-job">＋ Add</button></div>
    ${data.jobs.map(j => `<div class="list-item" data-edit-job="${j.id}"><span class="dot" style="background:${color(j.colorIndex)}"></span><span class="grow">${esc(j.name)}</span><span class="small muted num">${money(j.hourlyWage)}/h</span></div>`).join('') || '<div class="muted small">No jobs yet.</div>'}</section>
  <section class="card"><div class="hdr"><h2>Fixed expenses</h2><button class="btn" data-act="new-expense">＋ Add</button></div>
    ${data.fixedExpenses.map(e => `<div class="list-item" data-edit-expense="${e.id}"><span class="grow">${esc(e.name)}</span><span class="small num">${money(e.amount)}</span></div>`).join('') || '<div class="muted small">No fixed expenses yet.</div>'}
    <div class="between small" style="margin-top:8px"><b>Total</b><b class="num">${money(fixedTotal())}</b></div>
    <div class="tiny muted">Rent, subscriptions, phone bill… Income minus these is your disposable income.</div></section>
  <section class="card"><div class="hdr"><h2>Data</h2></div>
    <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="sample">Load Sample Data</button><button class="btn danger" data-act="erase">Erase All Data</button></div>
    <p class="tiny muted">Everything is saved in this browser only. No account or internet needed. Night shifts that end the next day are counted to the day they start. Late-night premiums, transport and taxes are not calculated.</p></section>`;
}

function render() {
  app.innerHTML = state.tab === 'home' ? renderHome() : state.tab === 'calendar' ? renderCalendar() : renderSettings();
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  if (state.tab === 'settings') {
    document.getElementById('goal').onchange = e => { data.monthlyGoal = Math.max(0, Number(e.target.value) || 0); save(); };
    document.getElementById('currency').onchange = e => { data.currencyCode = e.target.value; save(); };
  }
}

/* ---------- sheets ---------- */
function openSheet(title, body, { onSave, saveLabel = 'Save', canSave = () => true, onInput } = {}) {
  sheet.innerHTML = `<div class="sheet-head"><button class="btn" style="background:none" data-close>${onSave ? 'Cancel' : 'Done'}</button><b>${esc(title)}</b>
    ${onSave ? `<button class="btn solid" data-save>${saveLabel}</button>` : '<span style="width:60px"></span>'}</div><div class="sheet-body">${body}</div>`;
  const btn = sheet.querySelector('[data-save]');
  const check = () => { if (btn) btn.disabled = !canSave(); };
  sheet.oninput = () => { check(); if (onInput) onInput(); }; check();
  sheet.querySelector('[data-close]').onclick = () => sheet.close();
  if (btn) btn.onclick = () => { if (canSave()) { onSave(); sheet.close(); save(); } };
  if (!sheet.open) sheet.showModal();
  const first = sheet.querySelector('input,select'); if (first) first.focus();
}
const val = id => sheet.querySelector('#' + id).value;

function shiftEditor(existing, day) {
  const s = existing || { id: uid(), jobID: data.jobs[0]?.id, date: dayKey(day), startMinutes: 1020, endMinutes: 1260, breakMinutes: 0 };
  const est = () => {
    const tmp = { jobID: val('sj'), startMinutes: toMinutes(val('ss') || '0:00'), endMinutes: toMinutes(val('se') || '0:00'), breakMinutes: Number(val('sb')) || 0 };
    return `${fmtHours(shiftHours(tmp))} · ${money(pay(tmp))}${isOvernight(tmp) ? ' · ends next day' : ''}`;
  };
  openSheet(existing ? 'Edit Shift' : 'New Shift', `
    <label class="f"><span>Job</span><select id="sj">${data.jobs.map(j => `<option value="${j.id}" ${j.id === s.jobID ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</select></label>
    <label class="f"><span>Date</span><input type="date" id="sd" value="${s.date}"></label>
    <div class="row"><label class="f grow"><span>Start</span><input type="time" id="ss" value="${toTimeInput(s.startMinutes)}"></label>
    <label class="f grow"><span>End</span><input type="time" id="se" value="${toTimeInput(s.endMinutes)}"></label></div>
    <label class="f"><span>Break (min)</span><input type="number" id="sb" min="0" max="180" step="15" value="${s.breakMinutes || 0}"></label>
    <div class="card small"><div class="tiny muted">Estimate</div><div id="est" class="num"></div></div>
    ${existing ? '<button class="btn danger" id="del">Delete Shift</button>' : ''}`, {
    canSave: () => val('sj') && val('sd') && val('ss') && val('se'),
    onSave: () => upsert(data.shifts, { id: s.id, jobID: val('sj'), date: val('sd'), startMinutes: toMinutes(val('ss')), endMinutes: toMinutes(val('se')), breakMinutes: Math.min(180, Math.max(0, Number(val('sb')) || 0)) }),
    onInput: () => { sheet.querySelector('#est').textContent = est(); }
  });
  sheet.querySelector('#est').textContent = est();
  const del = sheet.querySelector('#del');
  if (del) del.onclick = () => { data.shifts = data.shifts.filter(x => x.id !== s.id); sheet.close(); save(); };
}

function dayDetail(key) {
  const day = parseDay(key), list = shiftsOn(day);
  const hours = list.reduce((a, s) => a + shiftHours(s), 0), total = list.reduce((a, s) => a + pay(s), 0);
  openSheet(day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }), `
    <section class="card">${list.length ? list.map(shiftRow).join('') + `<hr><div class="small muted">Total: ${fmtHours(hours)} · ${money(total)}</div>` : '<div class="muted">No shifts on this day.</div>'}</section>
    ${data.jobs.length ? '<button class="btn solid" id="add">＋ Add Shift</button>' : '<div class="muted small">Add a job in Settings first.</div>'}`);
  const add = sheet.querySelector('#add'); if (add) add.onclick = () => shiftEditor(null, day);
}

function jobEditor(existing) {
  const j = existing || { id: uid(), name: '', hourlyWage: 0, colorIndex: nextColorIndex() };
  let ci = j.colorIndex;
  openSheet(existing ? 'Edit Job' : 'New Job', `
    <label class="f"><span>Name (e.g. Café, Bookstore)</span><input id="jn" value="${esc(j.name)}"></label>
    <label class="f"><span>Hourly wage</span><input id="jw" type="number" min="0" inputmode="decimal" value="${j.hourlyWage || ''}"></label>
    <div class="tiny muted" style="margin-bottom:6px">Color</div>
    <div class="swatches">${PALETTE.map((c, i) => `<button type="button" data-ci="${i}" class="${i === ci % PALETTE.length ? 'on' : ''}" style="background:${c}" aria-label="${PALETTE_NAMES[i]}"></button>`).join('')}</div>
    ${existing ? `<hr><button class="btn danger" id="del">Delete ${esc(j.name)} and its shifts</button><div class="tiny muted">All shifts for ${esc(j.name)} will be removed too.</div>` : ''}`, {
    canSave: () => val('jn').trim() !== '',
    onSave: () => upsert(data.jobs, { id: j.id, name: val('jn').trim(), hourlyWage: Math.max(0, Number(val('jw')) || 0), colorIndex: ci })
  });
  sheet.querySelectorAll('[data-ci]').forEach(b => b.onclick = () => { ci = Number(b.dataset.ci); sheet.querySelectorAll('[data-ci]').forEach(x => x.classList.toggle('on', x === b)); });
  const del = sheet.querySelector('#del');
  if (del) del.onclick = () => { if (confirm(`Delete ${j.name} and all its shifts?`)) { data.jobs = data.jobs.filter(x => x.id !== j.id); data.shifts = data.shifts.filter(x => x.jobID !== j.id); sheet.close(); save(); } };
}

function expenseEditor(existing) {
  const e = existing || { id: uid(), name: '', amount: 0 };
  openSheet(existing ? 'Edit Fixed Expense' : 'New Fixed Expense', `
    <label class="f"><span>Name (e.g. Rent, Spotify)</span><input id="en" value="${esc(e.name)}"></label>
    <label class="f"><span>Per month</span><input id="ea" type="number" min="0" inputmode="decimal" value="${e.amount || ''}"></label>
    ${existing ? '<button class="btn danger" id="del">Delete</button>' : ''}`, {
    canSave: () => val('en').trim() !== '',
    onSave: () => upsert(data.fixedExpenses, { id: e.id, name: val('en').trim(), amount: Math.max(0, Number(val('ea')) || 0) })
  });
  const del = sheet.querySelector('#del');
  if (del) del.onclick = () => { data.fixedExpenses = data.fixedExpenses.filter(x => x.id !== e.id); sheet.close(); save(); };
}

function spendingEditor() {
  openSheet('Log Spending', `
    <label class="f"><span>Amount</span><input id="pa" type="number" min="0" inputmode="decimal"></label>
    <label class="f"><span>What was it? (optional)</span><input id="pn"></label>`, {
    saveLabel: 'Add',
    canSave: () => Number(val('pa')) > 0,
    onSave: () => data.spendings.push({ id: uid(), date: new Date().toISOString(), amount: Number(val('pa')), note: val('pn').trim() })
  });
}

/* ---------- events ---------- */
document.querySelector('nav.tabs').onclick = e => { const b = e.target.closest('button'); if (b) { state.tab = b.dataset.tab; render(); window.scrollTo(0, 0); } };
app.onclick = e => {
  const t = e.target.closest('[data-act],[data-day],[data-edit-shift],[data-edit-job],[data-edit-expense],[data-del-spending]');
  if (!t) return;
  const d = t.dataset, now = new Date();
  if (d.day) return dayDetail(d.day);
  if (d.editShift) return shiftEditor(data.shifts.find(s => s.id === d.editShift));
  if (d.editJob) return jobEditor(jobById(d.editJob));
  if (d.editExpense) return expenseEditor(data.fixedExpenses.find(x => x.id === d.editExpense));
  if (d.delSpending) { data.spendings = data.spendings.filter(x => x.id !== d.delSpending); return save(); }
  switch (d.act) {
    case 'prev': state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); return render();
    case 'next': state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); return render();
    case 'this-month': state.month = startOfMonth(now); return render();
    case 'new-shift': return shiftEditor(null, sameMonth(state.month, now) ? now : state.month);
    case 'log-spending': return spendingEditor();
    case 'new-job': return jobEditor(null);
    case 'new-expense': return expenseEditor(null);
    case 'sample': if (confirm('Replace your data with sample data?')) { data = sampleData(); save(); } return;
    case 'erase': if (confirm('Erase all data? This cannot be undone.')) { data = emptyData(); save(); } return;
  }
};
sheet.addEventListener('click', e => {
  const t = e.target.closest('[data-edit-shift]');
  if (t) shiftEditor(data.shifts.find(s => s.id === t.dataset.editShift));
});

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
