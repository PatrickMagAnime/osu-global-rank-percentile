// Global collector: sucht überall nach "X players (Y%)" (v0.4.1)
(() => {
  const {
    estimateTotal,
    parseNumberLike,
    parsePercentLike,
    getRulesetSmart,
    addPlayerbaseSample,
    onUrlChange,
    log
  } = window.__osuExtShared || {};

  if (!estimateTotal) return;

  let observer = null;
  const seen = new Set();

  // Unterstützt normale/spitze/narrow spaces
  const pattern =
    /([\d\s.,\u00A0\u2000-\u200A\u202F]+)\s*players?\s*\(\s*([\d\s.,\u00A0\u2000-\u200A\u202F]+)\s*%\s*\)/i;

  function tryExtractAndStore(text, ruleset) {
    const m = text.match(pattern);
    if (!m) return false;
    const players = parseNumberLike(m[1]);
    const percent = parsePercentLike(m[2] + '%');
    const total = estimateTotal(players, percent);
    if (!isFinite(players) || !isFinite(percent) || !isFinite(total)) return false;

    const key = `${ruleset}|${players}|${percent}`;
    if (seen.has(key)) return true;
    seen.add(key);

    addPlayerbaseSample(ruleset, total, players).then((est) => {
      log('Sample', { ruleset, players, percent, total }, '→', est);
    });
    return true;
  }

  function scanExisting(ruleset) {
    // Spezifische Tooltip-Container (qtip + osu-Tooltipklassen)
    const containers = document.querySelectorAll(
      '#qtip-0, #qtip-1, #qtip-2, #qtip-3, #qtip-4, #qtip-5, .qtip, .qtip-content, .tooltip-achievement__achieved, .tooltip-achievement__stats'
    );
    let hits = 0;
    containers.forEach((c) => {
      const t = (c.textContent || '').trim();
      if (t && t.length < 4000 && pattern.test(t)) {
        if (tryExtractAndStore(t, ruleset)) hits++;
      }
    });

    // Fallback: kurzer Seiten-Sweep
    if (hits === 0) {
      const all = Array.from(document.querySelectorAll('body *:not(script):not(style)'));
      for (const el of all) {
        const t = (el.textContent || '').trim();
        if (t && t.length < 2000 && pattern.test(t)) {
          if (tryExtractAndStore(t, ruleset)) break;
        }
      }
    }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const ruleset = getRulesetSmart();
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // Direkt auf typische Tooltip-Container prüfen
          if (
            node.matches?.(
              '#qtip-0, #qtip-1, #qtip-2, #qtip-3, #qtip-4, #qtip-5, .qtip, .qtip-content, .tooltip-achievement__achieved, .tooltip-achievement__stats'
            )
          ) {
            const t = (node.textContent || '').trim();
            if (t && pattern.test(t)) tryExtractAndStore(t, ruleset);
          }

          // Und deren Nachfahren
          const targeteds = node.querySelectorAll?.(
            '#qtip-0, #qtip-1, #qtip-2, #qtip-3, #qtip-4, #qtip-5, .qtip, .qtip-content, .tooltip-achievement__achieved, .tooltip-achievement__stats'
          );
          targeteds?.forEach((el) => {
            const s = (el.textContent || '').trim();
            if (s && pattern.test(s)) tryExtractAndStore(s, ruleset);
          });

          // Fallback: Node selbst
          const t = node.textContent || '';
          if (t && t.length < 4000 && pattern.test(t)) {
            tryExtractAndStore(t, ruleset);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    seen.clear();
    const ruleset = getRulesetSmart();
    scanExisting(ruleset);
    startObserver();

    // Nachzügler abholen
    setTimeout(() => scanExisting(getRulesetSmart()), 400);
    setTimeout(() => scanExisting(getRulesetSmart()), 2000);
  }

  init();
  onUrlChange(() => setTimeout(init, 50));

  // Manche Tooltips kommen erst bei Hover
  window.addEventListener('mouseover', () => {
    setTimeout(() => scanExisting(getRulesetSmart()), 50);
  });
})();