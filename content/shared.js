// Shared utilities + SPA URL change + storage helpers (v0.4.1)
(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  // Konfigurierbar: Nachkommastellen für die Anzeige
  const PERCENT_DECIMALS = 5;

  function log(...a) {
    try { console.debug('[osu-ext]', ...a); } catch {}
  }

  const STORAGE_KEY = 'osu_estimates_v1'; // { [ruleset]: { total, samples, weight, updatedAt } }

  function parseNumberLike(s) {
    if (!s) return NaN;
    // tausendertrennzeichen (., Leerzeichen, NBSP, thin space) entfernen
    const digits = s.replace(/[^\d]/g, '');
    if (!digits) return NaN;
    return parseInt(digits, 10);
  }

  function parsePercentLike(s) {
    if (!s) return NaN;
    const m = s.match(/([\d.,]+)\s*%/);
    if (!m) return NaN;
    const n = m[1].replace(/\s+/g, '').replace(',', '.');
    const v = parseFloat(n);
    return isFinite(v) ? v : NaN;
  }

  function estimateTotal(players, percent) {
    if (!isFinite(players) || !isFinite(percent) || percent <= 0) return NaN;
    return Math.max(1, Math.round(players / (percent / 100)));
  }

  function normalizeRuleset(s) {
    switch ((s || '').toLowerCase()) {
      case 'osu':
      case 'standard':
        return 'osu';
      case 'taiko':
        return 'taiko';
      case 'fruits':
      case 'ctb':
      case 'catch':
        return 'fruits';
      case 'mania':
        return 'mania';
      default:
        return '';
    }
  }

  function getRulesetFromUrl(urlStr = location.href) {
    try {
      const url = new URL(urlStr);
      const qMode = url.searchParams.get('mode');
      if (qMode) return normalizeRuleset(qMode);
      const parts = url.pathname.split('/').filter(Boolean);
      for (const p of parts) {
        const rs = normalizeRuleset(p);
        if (rs && p.toLowerCase() !== 'medals') return rs;
      }
    } catch {}
    return '';
  }

  function getRulesetFromDom() {
    const selActive =
      'a[href*="?mode="].is-active, a[href*="?mode="][aria-current="page"], a[href*="?mode="][aria-selected="true"], a[href*="?mode="].router-link-active, a[href*="?mode="].active';
    const active = document.querySelector(selActive);
    if (active?.href) {
      try {
        const url = new URL(active.href, location.href);
        const rs = normalizeRuleset(url.searchParams.get('mode'));
        if (rs) return rs;
      } catch {}
    }
    const links = Array.from(document.querySelectorAll('a[href*="?mode="]'));
    const modes = new Set(
      links
        .map((a) => {
          try {
            const u = new URL(a.href, location.href);
            return normalizeRuleset(u.searchParams.get('mode'));
          } catch {
            return '';
          }
        })
        .filter(Boolean)
    );
    if (modes.size === 1) return Array.from(modes)[0];
    return '';
  }

  function getRulesetSmart() {
    return getRulesetFromUrl() || getRulesetFromDom() || 'osu';
  }

  // SPA URL change hook
  const urlChangeListeners = new Set();
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  function dispatchUrlChange() {
    for (const fn of urlChangeListeners) {
      try { fn(location.href); } catch (e) { log('urlchange listener error', e); }
    }
  }
  history.pushState = function (...args) { const r = origPush.apply(this, args); setTimeout(dispatchUrlChange, 0); return r; };
  history.replaceState = function (...args) { const r = origReplace.apply(this, args); setTimeout(dispatchUrlChange, 0); return r; };
  window.addEventListener('popstate', () => setTimeout(dispatchUrlChange, 0));
  function onUrlChange(fn) { urlChangeListeners.add(fn); return () => urlChangeListeners.delete(fn); }

  function i18n() {
    const lang = (navigator.language || 'en').toLowerCase();
    const de = lang.startsWith('de');
    return {
      topXWorldwide: (x) => (de ? `Top ${x}% weltweit` : `Top ${x}% worldwide`),
      calculating: de ? 'Spielerbasis wird berechnet…' : 'Estimating playerbase…',
      basedOn: (s) => (de ? `Basis: ${s} Medaillen-Beobachtungen` : `Based on ${s} medal samples`),
      lastUpdated: (d) => (de ? `Aktualisiert: ${d}` : `Updated: ${d}`)
    };
  }

  async function readEstimates() {
    return new Promise((resolve) => {
      api.storage?.local.get([STORAGE_KEY], (res) => resolve(res[STORAGE_KEY] || {}));
    });
  }
  async function writeEstimates(obj) {
    return new Promise((resolve) => {
      api.storage?.local.set({ [STORAGE_KEY]: obj }, () => resolve());
    });
  }
  async function getEstimate(ruleset) {
    const all = await readEstimates();
    return all[ruleset] || null;
  }
  async function getBestEstimate() {
    const all = await readEstimates();
    let best = null;
    for (const [rs, v] of Object.entries(all)) {
      if (v && v.total && v.samples) {
        if (!best || (v.weight || 0) > (best.weight || 0)) best = { ruleset: rs, ...v };
      }
    }
    return best;
  }

  async function addPlayerbaseSample(ruleset, sampleTotal, weightPlayers) {
    const all = await readEstimates();
    const cur = all[ruleset] || { total: 0, samples: 0, weight: 0, updatedAt: '' };
    const w = Math.max(1, Math.min(weightPlayers || 1, 10_000_000));
    const newWeight = (cur.weight || 0) + w;
    const newTotal =
      newWeight > 0
        ? Math.round(((cur.total || 0) * (cur.weight || 0) + sampleTotal * w) / newWeight)
        : sampleTotal;

    all[ruleset] = {
      total: Math.max(1, newTotal),
      samples: (cur.samples || 0) + 1,
      weight: newWeight,
      updatedAt: new Date().toISOString()
    };
    await writeEstimates(all);
    try {
      window.dispatchEvent(new CustomEvent('osu-ext:estimate-updated', { detail: { ruleset, estimate: all[ruleset] } }));
    } catch {}
    return all[ruleset];
  }

  function findGlobalRankElement() {
    // 1) Am Label "Global Ranking" orientieren
    const sections = Array.from(document.querySelectorAll('*, *:not(script):not(style)')).filter(
      (el) => /Global Ranking/i.test(el.textContent || '')
    );
    for (const sec of sections) {
      // Suche in Elternkette und Geschwistern nach dem "#123,456"
      let scope = sec;
      for (let i = 0; i < 4 && scope; i++) {
        const rankEl = Array.from(scope.querySelectorAll('*')).find((n) =>
          /^#\s*\d[\d,.\s]*$/.test((n.textContent || '').trim())
        );
        if (rankEl) return rankEl;
        scope = scope.parentElement;
      }
    }
    // 2) Fallback: Irgendein Node mit "#Zahl"
    const candidates = Array.from(document.querySelectorAll('*, *:not(script):not(style)')).filter(
      (el) => {
        const t = (el.textContent || '').trim();
        return /^#\s*\d[\d,.\s]*$/.test(t) && t.length < 24;
      }
    );
    return candidates[0] || null;
  }

  function parseRankNumber(text) {
    if (!text) return NaN;
    const m = text.match(/#\s*([\d.,\s]+)/);
    if (!m) return NaN;
    return parseNumberLike(m[1]);
  }

  function fmtNum(n) { try { return new Intl.NumberFormat().format(n); } catch { return String(n); } }
  function fmtPercent1(x) {
    if (!Number.isFinite(x)) return String(x);
    return x.toFixed(PERCENT_DECIMALS);
  }

  window.__osuExtShared = {
    api,
    log,
    estimateTotal,
    parseNumberLike,
    parsePercentLike,
    getRulesetSmart,
    onUrlChange,
    addPlayerbaseSample,
    getEstimate,
    getBestEstimate,
    readEstimates,
    i18n,
    findGlobalRankElement,
    parseRankNumber,
    fmtNum,
    fmtPercent1
  };
})();
