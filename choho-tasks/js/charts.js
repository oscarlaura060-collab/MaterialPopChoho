/* ==========================================================================
   CHOHO TASKS · charts.js
   Envoltura de gráficos. Usa Chart.js si está disponible; si no (por ejemplo
   sin conexión), dibuja un respaldo en SVG para que la app nunca falle.
   ========================================================================== */

(function (global) {
  'use strict';

  const instances = {};

  function hasChartJs() { return typeof global.Chart !== 'undefined'; }

  function themeColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: (styles.getPropertyValue('--text-soft') || '#64748b').trim(),
      grid: (styles.getPropertyValue('--border') || '#e2e8f0').trim()
    };
  }

  function destroy(id) {
    if (instances[id]) {
      try { instances[id].destroy(); } catch (e) {}
      delete instances[id];
    }
  }

  function getCanvas(id) {
    const c = document.getElementById(id);
    return c && c.tagName === 'CANVAS' ? c : null;
  }

  /* ------------------------------ DONUT -------------------------------- */

  function donut(id, data) {
    destroy(id);
    const canvas = getCanvas(id);
    if (!canvas) return;
    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);
    const colors = data.map(d => d.color || '#4f6ef7');
    if (values.every(v => !v)) { emptyChart(canvas); return; }

    if (hasChartJs()) {
      const tc = themeColors();
      instances[id] = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: { legend: { position: 'bottom', labels: { color: tc.text, usePointStyle: true, padding: 14, font: { size: 12 } } } }
        }
      });
    } else {
      svgDonut(canvas, labels, values, colors);
    }
  }

  /* ------------------------------- BAR --------------------------------- */

  function bar(id, labels, values, color) {
    destroy(id);
    const canvas = getCanvas(id);
    if (!canvas) return;
    if (hasChartJs()) {
      const tc = themeColors();
      instances[id] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: color || '#4f6ef7', borderRadius: 6, maxBarThickness: 34 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: tc.text } },
            y: { beginAtZero: true, grid: { color: tc.grid }, ticks: { color: tc.text, precision: 0 } }
          }
        }
      });
    } else {
      svgBars(canvas, labels, values, color || '#4f6ef7');
    }
  }

  /* ------------------------------- LINE -------------------------------- */

  function line(id, labels, values, color) {
    destroy(id);
    const canvas = getCanvas(id);
    if (!canvas) return;
    if (hasChartJs()) {
      const tc = themeColors();
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 220);
      grad.addColorStop(0, 'rgba(79,110,247,0.28)');
      grad.addColorStop(1, 'rgba(79,110,247,0)');
      instances[id] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ data: values, borderColor: color || '#4f6ef7', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: color || '#4f6ef7', borderWidth: 2 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: tc.text } },
            y: { beginAtZero: true, max: 100, grid: { color: tc.grid }, ticks: { color: tc.text, callback: v => v + '%' } }
          }
        }
      });
    } else {
      svgLine(canvas, labels, values, color || '#4f6ef7');
    }
  }

  function horizontalBar(id, data) {
    destroy(id);
    const canvas = getCanvas(id);
    if (!canvas) return;
    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);
    const colors = data.map(d => d.color || '#4f6ef7');
    if (hasChartJs()) {
      const tc = themeColors();
      instances[id] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6 }] },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: tc.grid }, ticks: { color: tc.text, precision: 0 } },
            y: { grid: { display: false }, ticks: { color: tc.text } }
          }
        }
      });
    } else {
      svgBars(canvas, labels, values, '#4f6ef7');
    }
  }

  /* --------------------------- RESPALDO SVG ---------------------------- */

  function replaceWithSvg(canvas, svg) {
    const holder = document.createElement('div');
    holder.className = 'svg-chart';
    holder.innerHTML = svg;
    if (canvas._svgHolder && canvas._svgHolder.parentNode) canvas._svgHolder.remove();
    canvas.style.display = 'none';
    canvas.parentNode.insertBefore(holder, canvas.nextSibling);
    canvas._svgHolder = holder;
  }

  function emptyChart(canvas) {
    replaceWithSvg(canvas, '<div class="chart-empty">Sin datos para mostrar</div>');
  }

  function svgDonut(canvas, labels, values, colors) {
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let acc = 0, segs = '';
    const r = 60, c = 2 * Math.PI * r;
    values.forEach((v, i) => {
      const frac = v / total;
      const dash = frac * c;
      segs += '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="' + colors[i] +
        '" stroke-width="22" stroke-dasharray="' + dash + ' ' + (c - dash) +
        '" stroke-dashoffset="' + (-acc * c) + '" transform="rotate(-90 80 80)"></circle>';
      acc += frac;
    });
    const legend = labels.map((l, i) => '<span class="svg-leg"><span class="svg-dot" style="background:' +
      colors[i] + '"></span>' + l + ' (' + values[i] + ')</span>').join('');
    replaceWithSvg(canvas, '<svg viewBox="0 0 160 160" width="160" height="160">' + segs +
      '</svg><div class="svg-legend">' + legend + '</div>');
  }

  function svgBars(canvas, labels, values, color) {
    const max = Math.max.apply(null, values.concat([1]));
    const bars = labels.map((l, i) => {
      const h = Math.round((values[i] / max) * 100);
      return '<div class="svg-bar-col"><div class="svg-bar" style="height:' + h +
        '%;background:' + color + '"><span>' + values[i] + '</span></div><small>' + l + '</small></div>';
    }).join('');
    replaceWithSvg(canvas, '<div class="svg-bars">' + bars + '</div>');
  }

  function svgLine(canvas, labels, values, color) {
    const w = 320, h = 140, pad = 20;
    const max = 100;
    const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const dots = pts.map(p => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="' + color + '"/>').join('');
    const lbls = labels.map((l, i) => '<text x="' + (pad + i * step).toFixed(1) + '" y="' + (h - 4) +
      '" font-size="9" text-anchor="middle" fill="#94a3b8">' + l + '</text>').join('');
    replaceWithSvg(canvas, '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '">' +
      '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2"/>' + dots + lbls + '</svg>');
  }

  function destroyAll() { Object.keys(instances).forEach(destroy); }

  global.Charts = { donut, bar, line, horizontalBar, destroy, destroyAll, hasChartJs };

})(window);
