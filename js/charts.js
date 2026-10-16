// Графики: общий выбор периода (с произвольным диапазоном месяцев)
// + переиспользуемые функции для пирога, линейного графика и кольцевого
// индикатора. Показываются прямо на нужной вкладке, а не в отдельном разделе.
// Самописный inline SVG вместо библиотеки — оправдано для такого
// небольшого проекта без сборки.
import { state, checkpointsSorted } from './state.js';
import { t } from './i18n.js';
import { escapeHtml, formatMoney, formatDate } from './utils.js';
import { renderCurrentTab } from './tabs.js';

let chartPeriod = 'all';
let chartCustomFrom = '';
let chartCustomTo = '';

export function currentPeriodBounds() {
  if (chartPeriod === 'custom') {
    const from = chartCustomFrom ? `${chartCustomFrom}-01` : null;
    let to = null;
    if (chartCustomTo) {
      const [y, m] = chartCustomTo.split('-').map(Number);
      to = new Date(y, m, 1).toISOString().slice(0, 10); // первое число месяца, следующего за выбранным
    }
    return { from, to };
  }
  const now = new Date();
  if (chartPeriod === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: null };
  if (chartPeriod === '3m') return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: null };
  if (chartPeriod === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: null };
  return { from: null, to: null };
}

// Индексы [start, end] (включительно) внутри chronologically-отсортированного
// массива dates, попадающие в текущий период. null, если ничего не попало.
export function periodIndexRange(dates) {
  const { from, to } = currentPeriodBounds();
  let start = 0;
  let end = dates.length - 1;
  if (from) {
    start = dates.findIndex((d) => d >= from);
    if (start === -1) return null;
  }
  if (to) {
    end = dates.length - 1;
    while (end >= start && dates[end] >= to) end--;
    if (end < start) return null;
  }
  return { start, end };
}

export function renderPeriodControl() {
  const isCustom = chartPeriod === 'custom';
  return `
    <div class="chart-filter-row">
      <select id="period-select">
        <option value="all" ${chartPeriod === 'all' ? 'selected' : ''}>${t('analytics_period_all')}</option>
        <option value="month" ${chartPeriod === 'month' ? 'selected' : ''}>${t('analytics_period_month')}</option>
        <option value="3m" ${chartPeriod === '3m' ? 'selected' : ''}>${t('analytics_period_3m')}</option>
        <option value="year" ${chartPeriod === 'year' ? 'selected' : ''}>${t('analytics_period_year')}</option>
        <option value="custom" ${isCustom ? 'selected' : ''}>${t('analytics_period_custom')}</option>
      </select>
      <input type="month" id="period-from" value="${chartCustomFrom}" title="${t('filter_date_from')}" style="${isCustom ? '' : 'display:none;'}" />
      <input type="month" id="period-to" value="${chartCustomTo}" title="${t('filter_date_to')}" style="${isCustom ? '' : 'display:none;'}" />
    </div>
  `;
}

export function attachPeriodControl() {
  const select = document.getElementById('period-select');
  if (!select) return;
  const fromEl = document.getElementById('period-from');
  const toEl = document.getElementById('period-to');
  select.addEventListener('change', () => {
    chartPeriod = select.value;
    renderCurrentTab();
  });
  fromEl.addEventListener('change', () => { chartCustomFrom = fromEl.value; renderCurrentTab(); });
  toEl.addEventListener('change', () => { chartCustomTo = toEl.value; renderCurrentTab(); });
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArc, 0, end.x, end.y, 'Z'].join(' ');
}

const PIE_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

// Группирует расходы по категории. Операции без категории (например, только
// что импортированные из банка и ещё не разобранные вручную) группируются по
// тексту описания — так сразу видно, на что уходят деньги, без разбора вручную.
function groupExpenses(transactions) {
  const { from, to } = currentPeriodBounds();
  const byKey = {};
  transactions.forEach((tx) => {
    if (tx.type !== 'expense') return;
    if (from && tx.date < from) return;
    if (to && tx.date >= to) return;

    let key;
    let label;
    let icon = '';
    if (tx.category_id) {
      const cat = state.categories.find((c) => c.id === tx.category_id);
      key = 'cat:' + tx.category_id;
      label = cat ? cat.name : t('no_category_label');
      icon = cat && cat.icon ? escapeHtml(cat.icon) + ' ' : '';
    } else {
      const desc = (tx.comment || '').trim();
      key = desc ? 'desc:' + desc.toLowerCase() : 'none';
      label = desc || t('no_category_label');
    }
    if (!byKey[key]) byKey[key] = { label, icon, amount: 0 };
    byKey[key].amount += Number(tx.amount);
  });
  return Object.values(byKey).sort((a, b) => b.amount - a.amount);
}

// transactions — уже отфильтрованный по нужному счёту/члену семьи список
// (или все state.transactions для семейного разреза); период применяется здесь.
export function drawPieChart(rootId, transactions) {
  const root = document.getElementById(rootId);
  const entries = groupExpenses(transactions);
  if (!entries.length) { root.innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const colors = PIE_COLORS;

  let top = entries.slice(0, 7);
  const rest = entries.slice(7);
  if (rest.length) top.push({ label: '…', icon: '', amount: rest.reduce((s, e) => s + e.amount, 0) });

  const size = 220;
  const r = 90;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;

  const slices = top.map((entry, i) => {
    const fraction = entry.amount / total;
    const sweep = Math.min(fraction * 360, 359.99);
    const path = describeArc(cx, cy, r, angle, angle + sweep);
    angle += sweep;
    return { path, color: colors[i % colors.length], value: entry.amount, label: entry.label, icon: entry.icon, fraction };
  });

  const svg = `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${t('analytics_pie_title')}">
      ${slices.map((p, i) => `<path d="${p.path}" fill="${p.color}" stroke="var(--chart-surface)" stroke-width="2" data-idx="${i}" class="pie-slice"></path>`).join('')}
    </svg>
  `;

  const legend = `
    <div class="chart-legend">
      ${slices.map((p) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${p.color}"></span>
          <span>${p.icon}${escapeHtml(p.label)} — <span class="money-value">${formatMoney(p.value)}</span> (${Math.round(p.fraction * 100)}%)</span>
        </div>`).join('')}
    </div>
  `;

  root.innerHTML = `<div class="chart-svg-wrap">${svg}<div class="chart-tooltip" id="${rootId}-tooltip"></div></div>${legend}`;

  const tooltip = document.getElementById(`${rootId}-tooltip`);
  const showTip = (el, i, x, y) => {
    const p = slices[i];
    tooltip.style.display = 'block';
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.textContent = `${p.icon}${p.label}: ${formatMoney(p.value)}`;
  };
  root.querySelectorAll('.pie-slice').forEach((el, i) => {
    el.addEventListener('mousemove', (e) => showTip(el, i, e.offsetX, e.offsetY));
    el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    // Тач-поддержка: на телефоне нет наведения мышью, поэтому тап по сектору
    // показывает тултип так же, как hover на десктопе.
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = el.closest('svg').getBoundingClientRect();
      const touch = e.touches[0];
      showTip(el, i, touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
  });
  document.addEventListener('touchstart', (e) => {
    if (!root.contains(e.target)) tooltip.style.display = 'none';
  });
}

// Таблица "на что и сколько": та же группировка, что и в пироге, но списком —
// удобно читать без вникания в детали, особенно сразу после импорта из банка,
// когда операции ещё не разложены по категориям вручную.
export function renderExpenseTable(rootId, transactions) {
  const root = document.getElementById(rootId);
  const entries = groupExpenses(transactions);
  if (!entries.length) { root.innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const colors = PIE_COLORS;

  root.innerHTML = `
    <div class="expense-table">
      ${entries.map((e, i) => {
        const pct = total ? (e.amount / total) * 100 : 0;
        return `
          <div class="expense-row">
            <div class="expense-row-top">
              <span class="expense-row-label">${e.icon}${escapeHtml(e.label)}</span>
              <span class="expense-row-amount money-value">${formatMoney(e.amount)}</span>
            </div>
            <div class="expense-row-bar-track">
              <div class="expense-row-bar" style="width:${pct.toFixed(1)}%; background:${colors[i % colors.length]}"></div>
            </div>
            <div class="expense-row-pct">${pct.toFixed(1)}%</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

// Общая (семейная) серия: суммарный ликвидный баланс + баланс каждого счёта.
export function computeLiquidSeries() {
  const liquidAccounts = state.accounts.filter((a) => a.type === 'current' || a.type === 'cash');
  if (!liquidAccounts.length) return null;

  const perAccountPoints = {};
  liquidAccounts.forEach((acc) => {
    const txs = state.transactions
      .filter((tx) => tx.account_id === acc.id)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
    let running = Number(acc.initial_balance);
    const points = [];
    txs.forEach((tx) => {
      running += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
      points.push({ date: tx.date, balance: running });
    });
    perAccountPoints[acc.id] = { points, initial: Number(acc.initial_balance) };
  });

  const allDatesSet = new Set();
  liquidAccounts.forEach((acc) => perAccountPoints[acc.id].points.forEach((p) => allDatesSet.add(p.date)));
  const allDates = Array.from(allDatesSet).sort();
  if (!allDates.length) return null;

  const latest = {};
  const pointerIdx = {};
  liquidAccounts.forEach((acc) => {
    latest[acc.id] = perAccountPoints[acc.id].initial;
    pointerIdx[acc.id] = 0;
  });

  const series = { dates: [], total: [], byAccount: {}, accounts: liquidAccounts };
  liquidAccounts.forEach((acc) => { series.byAccount[acc.id] = []; });

  allDates.forEach((date) => {
    liquidAccounts.forEach((acc) => {
      const pts = perAccountPoints[acc.id].points;
      while (pointerIdx[acc.id] < pts.length && pts[pointerIdx[acc.id]].date === date) {
        latest[acc.id] = pts[pointerIdx[acc.id]].balance;
        pointerIdx[acc.id]++;
      }
    });
    let total = 0;
    liquidAccounts.forEach((acc) => {
      total += latest[acc.id];
      series.byAccount[acc.id].push(latest[acc.id]);
    });
    series.dates.push(date);
    series.total.push(total);
  });

  return series;
}

// Баланс одного текущего/наличного счёта во времени.
export function computeSingleAccountSeries(account) {
  const txs = state.transactions
    .filter((tx) => tx.account_id === account.id)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  let running = Number(account.initial_balance);
  const dates = [];
  const values = [];
  txs.forEach((tx) => {
    running += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
    dates.push(tx.date);
    values.push(running);
  });
  return { dates, values };
}

export function renderLiquidLineChart(rootId) {
  const series = computeLiquidSeries();
  if (!series) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const range = periodIndexRange(series.dates);
  if (!range || range.end - range.start < 1) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const dates = series.dates.slice(range.start, range.end + 1);
  const colors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
  const lines = [{ label: t('analytics_total_line_label'), values: series.total.slice(range.start, range.end + 1), color: 'var(--accent)', width: 3 }];
  series.accounts.forEach((acc, i) => {
    const label = acc.type === 'cash' ? t('overview_cash_label') : ((state.members.find((m) => m.id === acc.member_id) || {}).name || acc.name);
    lines.push({ label, values: series.byAccount[acc.id].slice(range.start, range.end + 1), color: colors[i % colors.length], width: 2 });
  });

  drawLineChart(rootId, dates, lines);
}

export function renderAccountBalanceChart(rootId, account) {
  const { dates, values } = computeSingleAccountSeries(account);
  if (dates.length < 2) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const range = periodIndexRange(dates);
  if (!range || range.end - range.start < 1) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  drawLineChart(rootId, dates.slice(range.start, range.end + 1), [
    { label: t('chart_balance_title'), values: values.slice(range.start, range.end + 1), color: 'var(--accent)', width: 3 },
  ]);
}

export function renderCheckpointBalanceChart(rootId, account) {
  const cps = checkpointsSorted(account.id, 'asc');
  const dates = cps.map((c) => c.date);
  const values = cps.map((c) => Number(c.balance));
  if (dates.length < 2) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const range = periodIndexRange(dates);
  if (!range || range.end - range.start < 1) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  drawLineChart(rootId, dates.slice(range.start, range.end + 1), [
    { label: t('chart_balance_title'), values: values.slice(range.start, range.end + 1), color: 'var(--accent)', width: 3 },
  ]);
}

// Универсальная отрисовка линейного графика: dates — общая ось X,
// lines — массив {label, values, color, width}, значения выровнены по dates.
export function drawLineChart(rootId, dates, lines) {
  const root = document.getElementById(rootId);
  if (!dates || dates.length < 2) { root.innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const width = 640;
  const height = 260;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = lines.flatMap((l) => l.values);
  const minV = Math.min(0, ...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;

  const xAt = (i) => padL + (i / (dates.length - 1)) * plotW;
  const yAt = (v) => padT + plotH - ((v - minV) / range) * plotH;

  const pathFor = (values) => values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ');

  const steps = 4;
  const gridLines = [];
  for (let s = 0; s <= steps; s++) {
    const v = minV + (range * s) / steps;
    gridLines.push({ y: yAt(v), v });
  }

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t('chart_balance_title')}">
      ${gridLines.map((g) => `
        <line x1="${padL}" y1="${g.y.toFixed(1)}" x2="${width - padR}" y2="${g.y.toFixed(1)}" stroke="var(--chart-grid)" stroke-width="1" />
        <text x="${padL - 8}" y="${(g.y + 3).toFixed(1)}" text-anchor="end" class="chart-axis-text money-value" fill="var(--chart-ink-muted)">${formatMoney(g.v)}</text>
      `).join('')}
      <line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="var(--chart-axis)" stroke-width="1" />
      <text x="${padL}" y="${height - 8}" class="chart-axis-text" fill="var(--chart-ink-muted)" text-anchor="start">${formatDate(dates[0])}</text>
      <text x="${width - padR}" y="${height - 8}" class="chart-axis-text" fill="var(--chart-ink-muted)" text-anchor="end">${formatDate(dates[dates.length - 1])}</text>
      ${lines.map((line) => `<path d="${pathFor(line.values)}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round" />`).join('')}
      <line id="${rootId}-crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="var(--chart-axis)" stroke-width="1" style="display:none;" />
      <rect id="${rootId}-hover-rect" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent" style="touch-action:none;" />
    </svg>
  `;

  const legend = lines.length > 1 ? `
    <div class="chart-legend">
      ${lines.map((l) => `<div class="legend-item"><span class="legend-dot" style="background:${l.color}"></span>${escapeHtml(l.label)}</div>`).join('')}
    </div>
  ` : '';

  root.innerHTML = `<div class="chart-svg-wrap">${svg}<div class="chart-tooltip" id="${rootId}-tooltip"></div></div>${legend}`;

  const svgEl = root.querySelector('svg');
  const hoverRect = document.getElementById(`${rootId}-hover-rect`);
  const crosshair = document.getElementById(`${rootId}-crosshair`);
  const tooltip = document.getElementById(`${rootId}-tooltip`);

  const showAt = (clientX, clientY) => {
    const bounds = svgEl.getBoundingClientRect();
    const scaleX = width / bounds.width;
    const scaleY = height / bounds.height;
    const localX = (clientX - bounds.left) * scaleX;
    let idx = Math.round(((localX - padL) / plotW) * (dates.length - 1));
    idx = Math.max(0, Math.min(dates.length - 1, idx));
    const cx = xAt(idx);
    crosshair.setAttribute('x1', cx);
    crosshair.setAttribute('x2', cx);
    crosshair.style.display = 'block';

    tooltip.style.display = 'block';
    tooltip.style.left = (cx / scaleX) + 'px';
    tooltip.style.top = (yAt(lines[0].values[idx]) / scaleY) + 'px';
    tooltip.innerHTML = `<strong>${formatDate(dates[idx])}</strong><br>` +
      lines.map((l) => `<span style="color:${l.color}">●</span> ${escapeHtml(l.label)}: <span class="money-value">${formatMoney(l.values[idx])}</span>`).join('<br>');
  };
  const hideTooltip = () => {
    crosshair.style.display = 'none';
    tooltip.style.display = 'none';
  };

  hoverRect.addEventListener('mousemove', (e) => showAt(e.clientX, e.clientY));
  hoverRect.addEventListener('mouseleave', hideTooltip);
  // Тач-поддержка: протягивание пальцем по графику двигает курсор так же,
  // как движение мыши на десктопе — без этого график на телефоне немой.
  hoverRect.addEventListener('touchstart', (e) => { e.preventDefault(); showAt(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  hoverRect.addEventListener('touchmove', (e) => { e.preventDefault(); showAt(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  hoverRect.addEventListener('touchend', hideTooltip);
}

export function drawRadialGauge(rootId, { fraction, centerHtml, label, color = 'var(--accent)' }) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const clamped = Math.max(0, Math.min(1, fraction || 0));
  const size = 220;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped);

  root.innerHTML = `
    <div class="gauge-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${strokeWidth}" />
        <circle class="gauge-progress" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
          stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" />
      </svg>
      <div class="gauge-center">
        <div class="gauge-value">${centerHtml}</div>
        ${label ? `<div class="gauge-label">${escapeHtml(label)}</div>` : ''}
      </div>
    </div>
  `;

  // Кольцо стартует пустым (stroke-dashoffset = длина окружности) и заполняется
  // до нужной доли через CSS-переход — рисуется "с нуля", а не появляется готовым.
  const progressCircle = root.querySelector('.gauge-progress');
  requestAnimationFrame(() => { progressCircle.style.strokeDashoffset = offset; });
}
