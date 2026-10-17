// Графики: общий выбор периода (с произвольным диапазоном месяцев)
// + переиспользуемые функции для пирога, линейного графика и кольцевого
// индикатора. Показываются прямо на нужной вкладке, а не в отдельном разделе.
// Самописный inline SVG вместо библиотеки — оправдано для такого
// небольшого проекта без сборки.
import { state, checkpointsSorted, avatarColor, displayMemberName, currencySymbol, isForeignCurrency } from './state.js';
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

  // Кольцевая диаграмма (donut) вместо сплошного пирога — сегменты рисуются
  // обводкой окружности с dasharray/dashoffset, тем же приёмом, что и гейдж.
  const size = 220;
  const strokeWidth = 32;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const slices = top.map((entry, i) => {
    const fraction = entry.amount / total;
    const segLen = fraction * circumference;
    const dashoffset = -offset;
    offset += segLen;
    return {
      dasharray: `${segLen.toFixed(2)} ${(circumference - segLen).toFixed(2)}`,
      dashoffset,
      color: colors[i % colors.length],
      value: entry.amount,
      label: entry.label,
      icon: entry.icon,
      fraction,
    };
  });

  const svg = `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${t('analytics_pie_title')}">
      <g style="transform-origin:center; transform:rotate(-90deg)">
        ${slices.map((p, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${strokeWidth}" stroke-dasharray="${p.dasharray}" stroke-dashoffset="${p.dashoffset}" data-idx="${i}" class="pie-slice"></circle>`).join('')}
      </g>
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

  root.innerHTML = `
    <div class="chart-svg-wrap donut-wrap">
      ${svg}
      <div class="donut-center">
        <div class="donut-total money-value">${formatMoney(total)}</div>
      </div>
      <div class="chart-tooltip" id="${rootId}-tooltip"></div>
    </div>${legend}`;

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
  // Пусто, а не вторая копия "недостаточно данных" — donut рядом (drawPieChart)
  // уже показывает это сообщение для тех же данных.
  if (!entries.length) { root.innerHTML = ''; return; }

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
function computeLiquidSeries() {
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

// Разбивает общий ликвидный ряд (computeLiquidSeries) по владельцу: текущий
// счёт каждого члена семьи — отдельная линия, общая наличность — отдельная,
// плюс сумма всех как "Всего". Копилки/пенсия сюда сознательно не входят —
// пользователь просил не смешивать их с ликвидными деньгами в одном графике.
export function computeLiquidByMemberSeries() {
  const liquid = computeLiquidSeries();
  if (!liquid) return null;

  const cash = state.accounts.find((a) => a.type === 'cash');
  const byMember = state.members.map((m) => {
    const acc = state.accounts.find((a) => a.member_id === m.id && a.type === 'current');
    return { member: m, values: acc ? liquid.byAccount[acc.id] : liquid.dates.map(() => 0) };
  });

  return {
    dates: liquid.dates,
    total: liquid.total,
    byMember,
    cash: cash ? liquid.byAccount[cash.id] : null,
  };
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

// Объединяет две разные по природе серии в одну "общий капитал":
// ликвидные счета считаются по операциям (ежедневная история), копилки —
// по чекапам (редкие точечные замеры). Для каждой даты, где что-то из этого
// изменилось, пересчитываем суммарный капитал, перенося последнее известное
// значение другой серии вперёд (forward-fill).
export function computeNetWorthSeries() {
  const liquid = computeLiquidSeries();
  // Копилки в другой валюте исключены — без конвертации их нельзя честно
  // сложить с остальным капиталом в ₪ (см. isForeignCurrency в state.js).
  const savingsAccounts = state.accounts.filter((a) => a.type === 'savings' && !isForeignCurrency(a));
  const initialSavingsTotal = savingsAccounts.reduce((s, a) => s + (Number(a.initial_balance) || 0), 0);

  const savingsAccountIds = new Set(savingsAccounts.map((a) => a.id));
  const allCheckpoints = state.checkpoints
    .filter((c) => savingsAccountIds.has(c.account_id))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

  if (!liquid && !allCheckpoints.length) return null;

  const lastKnown = {};
  savingsAccounts.forEach((a) => { lastKnown[a.id] = Number(a.initial_balance) || 0; });

  // Точки "дата → суммарные накопления на эту дату", по одной на дату
  // (если в один день несколько чекапов, учитываем все и берём итог).
  const savingsPoints = [];
  let ci = 0;
  while (ci < allCheckpoints.length) {
    const date = allCheckpoints[ci].date;
    while (ci < allCheckpoints.length && allCheckpoints[ci].date === date) {
      lastKnown[allCheckpoints[ci].account_id] = Number(allCheckpoints[ci].balance);
      ci++;
    }
    savingsPoints.push({ date, total: Object.values(lastKnown).reduce((s, v) => s + v, 0) });
  }

  const liquidDates = liquid ? liquid.dates : [];
  const allDates = Array.from(new Set([...liquidDates, ...savingsPoints.map((p) => p.date)])).sort();

  const networth = [];
  const liquidSeries = [];
  const savingsSeries = [];
  let li = 0;
  let si = 0;
  let curLiquid = 0;
  let curSavings = initialSavingsTotal;

  allDates.forEach((date) => {
    while (li < liquidDates.length && liquidDates[li] === date) { curLiquid = liquid.total[li]; li++; }
    while (si < savingsPoints.length && savingsPoints[si].date === date) { curSavings = savingsPoints[si].total; si++; }
    liquidSeries.push(curLiquid);
    savingsSeries.push(curSavings);
    networth.push(curLiquid + curSavings);
  });

  return { dates: allDates, networth, liquid: liquidSeries, savings: savingsSeries };
}

// Изменение общего капитала за последний месяц в процентах — для бейджа
// рядом с гейджем ("растём"/"падаем", как в референсных finance-приложениях).
// null, если данных месячной давности ещё нет (слишком новый аккаунт).
export function computeNetWorthMonthlyChange() {
  const series = computeNetWorthSeries();
  if (!series || series.dates.length < 2) return null;

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().slice(0, 10);

  let baseIdx = -1;
  for (let i = 0; i < series.dates.length; i++) {
    if (series.dates[i] <= monthAgoStr) baseIdx = i;
    else break;
  }
  if (baseIdx === -1) return null;

  const base = series.networth[baseIdx];
  const current = series.networth[series.networth.length - 1];
  if (!base) return null;

  const pct = ((current - base) / Math.abs(base)) * 100;
  const direction = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return { pct, direction };
}

// Главный график на "Общем статусе": только ликвидные деньги (без копилок —
// те отдельно, по просьбе пользователя). "Всего" жирной линией, плюс разрез
// по каждому члену семьи и по общей наличности — каждую линию можно скрыть
// кликом по легенде (см. drawLineChart).
export function renderNetWorthLineChart(rootId) {
  const series = computeLiquidByMemberSeries();
  if (!series) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const range = periodIndexRange(series.dates);
  if (!range || range.end - range.start < 1) { document.getElementById(rootId).innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  const slice = (arr) => arr.slice(range.start, range.end + 1);
  const lines = [
    { label: t('analytics_total_line_label'), values: slice(series.total), color: 'var(--accent)', width: 3 },
    ...series.byMember.map((entry) => ({
      label: displayMemberName(entry.member.name),
      values: slice(entry.values),
      color: avatarColor(entry.member.name),
      width: 2,
    })),
  ];
  if (series.cash) {
    lines.push({ label: t('overview_cash_label'), values: slice(series.cash), color: 'var(--accent-cash)', width: 2 });
  }

  drawLineChart(rootId, slice(series.dates), lines);
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
  ], currencySymbol(account.currency));
}

// Строит плавную кривую через все точки (Catmull-Rom → кубический Безье,
// натяжение 1/6 — стандартный лёгкий способ сгладить линию без библиотек).
function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Какие линии скрыты по клику на легенду, по id графика — переживает
// перерисовку одного и того же графика (но не нужен между разными графиками,
// поэтому просто ключ по rootId, без привязки к конкретному набору данных).
const lineHiddenState = new Map();

// Универсальная отрисовка линейного графика: dates — общая ось X,
// lines — массив {label, values, color, width}, значения выровнены по dates.
// Первая ВИДИМАЯ линия рисуется с мягкой градиентной заливкой под ней (как
// area-chart в референсных finance-приложениях) — остальные линии тоньше,
// для контекста. Если линий больше одной, по легенде можно кликать — линия
// скрывается/появляется, а масштаб графика пересчитывается по видимым.
export function drawLineChart(rootId, dates, lines, currencySym = '₪') {
  const root = document.getElementById(rootId);
  if (!dates || dates.length < 2) { root.innerHTML = `<div class="chart-empty">${t('chart_no_data')}</div>`; return; }

  if (!lineHiddenState.has(rootId)) lineHiddenState.set(rootId, new Set());
  const hidden = lineHiddenState.get(rootId);
  const toggleable = lines.length > 1;

  const legend = toggleable ? `
    <div class="chart-legend">
      ${lines.map((l) => `
        <button type="button" class="legend-item legend-toggle${hidden.has(l.label) ? ' inactive' : ''}" data-label="${escapeHtml(l.label)}">
          <span class="legend-dot" style="background:${hidden.has(l.label) ? 'transparent' : l.color}; border-color:${l.color}"></span>${escapeHtml(l.label)}
        </button>`).join('')}
    </div>
  ` : '';

  const attachLegendEvents = () => {
    if (!toggleable) return;
    root.querySelectorAll('.legend-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const label = btn.dataset.label;
        if (hidden.has(label)) hidden.delete(label); else hidden.add(label);
        drawLineChart(rootId, dates, lines);
      });
    });
  };

  const visibleLines = lines.filter((l) => !hidden.has(l.label));
  if (!visibleLines.length) {
    root.innerHTML = `<div class="chart-svg-wrap"><div class="chart-empty">${t('chart_all_hidden')}</div></div>${legend}`;
    attachLegendEvents();
    return;
  }

  const width = 640;
  const height = 260;
  const padL = 12;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = visibleLines.flatMap((l) => l.values);
  const minV = Math.min(0, ...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;

  const xAt = (i) => padL + (i / (dates.length - 1)) * plotW;
  const yAt = (v) => padT + plotH - ((v - minV) / range) * plotH;

  const pointsFor = (values) => values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const gradientId = `${rootId}-area-gradient`;
  const areaLine = visibleLines[0];
  const areaPoints = pointsFor(areaLine.values);
  const areaPath = `${smoothPath(areaPoints)} L ${xAt(dates.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t('chart_balance_title')}">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${areaLine.color}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${areaLine.color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${gradientId})" stroke="none" />
      <text x="${padL}" y="${height - 8}" class="chart-axis-text" fill="var(--chart-ink-muted)" text-anchor="start">${formatDate(dates[0])}</text>
      <text x="${width - padR}" y="${height - 8}" class="chart-axis-text" fill="var(--chart-ink-muted)" text-anchor="end">${formatDate(dates[dates.length - 1])}</text>
      ${visibleLines.map((line) => `<path d="${smoothPath(pointsFor(line.values))}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round" />`).join('')}
      <line id="${rootId}-crosshair" x1="0" y1="${padT}" x2="0" y2="${padT + plotH}" stroke="var(--chart-axis)" stroke-width="1" style="display:none;" />
      <rect id="${rootId}-hover-rect" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent" style="touch-action:none;" />
    </svg>
  `;

  root.innerHTML = `<div class="chart-svg-wrap">${svg}<div class="chart-tooltip" id="${rootId}-tooltip"></div></div>${legend}`;
  attachLegendEvents();

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
    tooltip.style.top = (yAt(visibleLines[0].values[idx]) / scaleY) + 'px';
    tooltip.innerHTML = `<strong>${formatDate(dates[idx])}</strong><br>` +
      visibleLines.map((l) => `<span style="color:${l.color}">●</span> ${escapeHtml(l.label)}: <span class="money-value">${formatMoney(l.values[idx], currencySym)}</span>`).join('<br>');
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
