// Fügt "Top X% weltweit" neben dem Global Ranking ein (v0.4.1)
(() => {
  const {
    getRulesetSmart,
    getEstimate,
    getBestEstimate,
    i18n,
    findGlobalRankElement,
    parseRankNumber,
    fmtNum,
    fmtPercent1,
    api
  } = window.__osuExtShared || {};

  if (!getRulesetSmart) return;

  const strings = i18n();

  function insertOrUpdate(el, text, tooltip) {
    if (!el) return;
    const id = 'osu-ext-percentile';
    let span = el.parentElement?.querySelector(`#${id}`);
    if (!span) {
      span = document.createElement('span');
      span.id = id;
      span.style.marginLeft = '8px';
      span.style.fontSize = '0.95em';
      span.style.opacity = '0.85';
      span.style.padding = '2px 6px';
      span.style.borderRadius = '6px';
      span.style.border = '1px solid rgba(255,255,255,0.15)';
      span.style.background = 'rgba(255,255,255,0.06)';
      span.style.whiteSpace = 'nowrap';
      el.insertAdjacentElement('afterend', span);
    }
    span.textContent = text;
    if (tooltip) span.title = tooltip;
  }

  async function computeAndRender() {
    const el = findGlobalRankElement();
    if (!el) return;

    const rank = parseRankNumber(el.textContent || '');
    if (!isFinite(rank) || rank <= 0) return;

    const ruleset = getRulesetSmart();
    let est = await getEstimate(ruleset);
    if (!est || !est.total) {
      const best = await getBestEstimate();
      if (best) est = best;
    }

    if (!est || !est.total) {
      insertOrUpdate(el, `· ${strings.calculating}`, '');
      return;
    }

    const denom = Math.max(est.total, rank); // nie kleiner als Rank
    const pctTop = Math.min(100, (rank / denom) * 100);
    const label = strings.topXWorldwide(fmtPercent1(pctTop));
    const tip =
      `${strings.basedOn(est.samples)}\n` +
      `Total geschätzt: ${fmtNum(est.total)} Spieler\n` +
      `${strings.lastUpdated(new Date(est.updatedAt).toLocaleString())}`;

    insertOrUpdate(el, `· ${label}`, tip);
  }

  // Rank-UI rendert dynamisch → beobachten
  const obs = new MutationObserver(() => computeAndRender());
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Refresh bei neuen Samples
  (api.storage?.onChanged || { addListener: () => {} }).addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['osu_estimates_v1']) computeAndRender();
  });
  window.addEventListener('osu-ext:estimate-updated', computeAndRender);

  computeAndRender();
})();