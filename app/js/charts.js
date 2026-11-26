// HomeLedger charts — small canvas drawings, no chart library.
// Both charts draw from the numbers passed in, with plain 2D canvas calls.

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, Math.round(rect.width));
  const height = Math.round(canvas.dataset.height || 260);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

function moneyShort(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

// Grouped bars: income (green) vs spending (red) for each month.
export function drawMonthlyBars(canvas, months) {
  const { ctx, width, height } = fitCanvas(canvas);
  const pad = { top: 14, right: 8, bottom: 26, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...months.flatMap((m) => [m.income, m.spent]));
  const niceMax = Math.ceil(maxVal / 1000) * 1000;

  ctx.clearRect(0, 0, width, height);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#5d6f69';
  ctx.strokeStyle = '#e3ddcc';
  ctx.lineWidth = 1;

  // Gridlines and y labels.
  for (let i = 0; i <= 4; i += 1) {
    const v = (niceMax / 4) * i;
    const y = pad.top + plotH - (plotH * v) / niceMax;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(moneyShort(v), pad.left - 6, y + 4);
  }

  const groupW = plotW / months.length;
  const barW = Math.min(26, groupW / 3.4);
  months.forEach((m, i) => {
    const cx = pad.left + groupW * i + groupW / 2;
    const incomeH = (plotH * m.income) / niceMax;
    const spentH = (plotH * m.spent) / niceMax;
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(cx - barW - 3, pad.top + plotH - incomeH, barW, incomeH);
    ctx.fillStyle = '#b3402e';
    ctx.fillRect(cx + 3, pad.top + plotH - spentH, barW, spentH);
    ctx.fillStyle = '#22302c';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, cx, height - 8);
  });
}

const DONUT_COLORS = [
  '#1f4d43', '#c98a1b', '#2e7d6b', '#b3402e', '#7a9e7e',
  '#8a6d3b', '#5b7fa6', '#a65b7a', '#6b7f8a', '#d9a441',
];

// Donut: share of spending by category, with the biggest slice labelled.
export function drawCategoryDonut(canvas, slices) {
  const { ctx, width, height } = fitCanvas(canvas);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 14;
  const inner = radius * 0.58;
  const total = slices.reduce((s, x) => s + x.amount, 0);

  ctx.clearRect(0, 0, width, height);
  if (total <= 0) {
    ctx.fillStyle = '#5d6f69';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No spending recorded yet.', cx, cy);
    return;
  }

  let angle = -Math.PI / 2;
  slices.forEach((slice, i) => {
    const sweep = (slice.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = DONUT_COLORS[i % DONUT_COLORS.length];
    ctx.fill();
    angle += sweep;
  });

  // Punch the hole and write the total in the middle.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#16302b';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(moneyShort(total), cx, cy - 2);
  ctx.fillStyle = '#5d6f69';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('spent this month', cx, cy + 18);
}
