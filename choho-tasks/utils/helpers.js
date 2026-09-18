/* ==========================================================================
   CHOHO TASKS · utils/helpers.js
   Funciones utilitarias puras: fechas, formato, DOM, cálculos.
   ========================================================================== */

(function (global) {
  'use strict';

  const MS_DAY = 24 * 60 * 60 * 1000;

  /* --------------------------- etiquetas ------------------------------- */

  const STATUS_LABELS = {
    pendiente: 'Pendiente',
    en_progreso: 'En progreso',
    en_espera: 'En espera',
    completada: 'Completada',
    vencida: 'Vencida'
  };

  const PRIORITY_LABELS = {
    baja: 'Baja',
    media: 'Media',
    alta: 'Alta'
  };

  const STATUS_COLORS = {
    pendiente: '#f5a623',
    en_progreso: '#4f6ef7',
    en_espera: '#8b5cf6',
    completada: '#22c1a4',
    vencida: '#ef476f'
  };

  const PRIORITY_COLORS = {
    baja: '#22c1a4',
    media: '#f5a623',
    alta: '#ef476f'
  };

  function statusLabel(s) { return STATUS_LABELS[s] || s || '—'; }
  function priorityLabel(p) { return PRIORITY_LABELS[p] || p || '—'; }

  /* ----------------------------- fechas -------------------------------- */

  // Devuelve un Date a partir de una cadena YYYY-MM-DD o ISO (fecha local)
  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value) ? null : value;
    // YYYY-MM-DD -> tratar como fecha local (sin desfase de zona horaria)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(value);
    return isNaN(d) ? null : d;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function today() { return startOfDay(new Date()); }

  // Días restantes hasta la fecha (negativo si ya pasó). null si sin fecha.
  function daysUntil(value) {
    const d = parseDate(value);
    if (!d) return null;
    return Math.round((startOfDay(d) - today()) / MS_DAY);
  }

  function isSameDay(a, b) {
    const x = parseDate(a), y = parseDate(b);
    if (!x || !y) return false;
    return x.getFullYear() === y.getFullYear() &&
           x.getMonth() === y.getMonth() &&
           x.getDate() === y.getDate();
  }

  function formatDate(value, opts) {
    const d = parseDate(value);
    if (!d) return '—';
    const o = opts || { day: '2-digit', month: '2-digit', year: 'numeric' };
    try { return d.toLocaleDateString('es-ES', o); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }

  function formatDateTime(value) {
    const d = parseDate(value);
    if (!d) return '—';
    try {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return d.toISOString(); }
  }

  function toInputDate(value) {
    const d = parseDate(value);
    if (!d) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  function monthName(i) { return MONTHS[i] || ''; }

  // Número de semana ISO
  function weekNumber(value) {
    const d = parseDate(value);
    if (!d) return null;
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const diff = date - firstThursday;
    return 1 + Math.round(diff / (7 * MS_DAY));
  }

  function weekKey(value) {
    const d = parseDate(value);
    if (!d) return null;
    return d.getFullYear() + '-S' + String(weekNumber(value)).padStart(2, '0');
  }

  function monthKey(value) {
    const d = parseDate(value);
    if (!d) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  /* ------------------------- estado efectivo --------------------------- */

  // Una tarea está "vencida" si no está completada y su fecha límite ya pasó.
  function isOverdue(task) {
    if (!task || task.status === 'completada') return false;
    const d = daysUntil(task.dueDate);
    return d !== null && d < 0;
  }

  // Estado mostrado al usuario (incluye "vencida" como estado derivado)
  function effectiveStatus(task) {
    if (isOverdue(task)) return 'vencida';
    return task.status;
  }

  /* ----------------------------- números ------------------------------- */

  function pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /* ------------------------------- DOM --------------------------------- */

  function el(id) { return document.getElementById(id); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2)
      .map(w => w.charAt(0).toUpperCase()).join('');
  }

  // Hash simple (NO criptográfico) para credenciales locales de demostración.
  // Migrar a Supabase Auth para seguridad real.
  function simpleHash(str) {
    let h = 5381;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h) + s.charCodeAt(i);
      h = h & h; // 32-bit
    }
    return 'h' + (h >>> 0).toString(16);
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait || 200);
    };
  }

  function download(filename, content, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('download error', e);
      alert('No se pudo generar la descarga.');
    }
  }

  // Convierte un array de objetos a CSV
  function toCSV(rows, headers) {
    const cols = headers || (rows[0] ? Object.keys(rows[0]) : []);
    const esc = v => {
      let s = (v === null || v === undefined) ? '' : String(v);
      s = s.replace(/"/g, '""');
      return /[",\n;]/.test(s) ? '"' + s + '"' : s;
    };
    const head = cols.map(c => esc(c.label || c.key || c)).join(';');
    const body = rows.map(r =>
      cols.map(c => esc(r[c.key || c])).join(';')).join('\n');
    return '﻿' + head + '\n' + body; // BOM para Excel
  }

  global.H = {
    MS_DAY,
    STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS,
    statusLabel, priorityLabel,
    parseDate, startOfDay, today, daysUntil, isSameDay,
    formatDate, formatDateTime, toInputDate, monthName, MONTHS,
    weekNumber, weekKey, monthKey,
    isOverdue, effectiveStatus,
    pct, clamp,
    el, qs, qsa, escapeHtml, initials, simpleHash, debounce,
    download, toCSV
  };

})(window);
