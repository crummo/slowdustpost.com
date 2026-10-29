// In-page video player. Any a[data-embed] plays here instead of leaving the site; the href stays a
// normal link, so cmd-click / middle-click still opens it in a new tab.
//
// The video comes from data-video, or the href itself. Links with a data-slug have their own page
// at work/<slug>/ (see scripts/build-work-pages.mjs): the address bar follows the open video, and
// landing on that page (window.SLOWDUST_OPEN) opens straight into it.
(() => {
  // Same conversions as cameronrumford.com: Bunny watch links and YouTube links to embeds.
  // `autoplay` only when the visitor chose the project themselves (clicked a row); a page
  // reached by link opens the player with the video waiting for a press.
  function toEmbed(url, autoplay) {
    const bunny = url.match(/(?:video\.bunnycdn\.com|player\.mediadelivery\.net)\/play\/(\d+)\/([a-zA-Z0-9-]+)/);
    if (bunny) return `https://iframe.mediadelivery.net/embed/${bunny[1]}/${bunny[2]}?autoplay=${autoplay}&preload=true`;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=${autoplay ? 1 : 0}&rel=0&modestbranding=1`;
    return null;
  }

  const el = document.createElement('div');
  el.className = 'player';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-hidden', 'true');
  el.dataset.ui = '';
  el.innerHTML = `
    <div class="player-inner">
      <div class="player-head">
        <span class="player-caption"></span>
        <button type="button" class="player-close">Close ✕</button>
      </div>
      <div class="player-frame"></div>
    </div>`;
  document.body.append(el);

  const caption = el.querySelector('.player-caption');
  const frame = el.querySelector('.player-frame');
  const closeBtn = el.querySelector('.player-close');
  // Pages under work/<slug>/ set <base> to the site root, so this is always the home page.
  const home = new URL('./', document.baseURI);
  const siteName = document.querySelector('meta[property="og:site_name"]')?.content || document.title;
  let isOpen = false;
  let returnFocus = null;
  // How long the dust has the stage before the video appears; matches player.css.
  const HANDOVER_MS = 1600;
  // Where the address bar goes back to on close; null when the open video has no page.
  let prevUrl = null;

  // Links without a slug (like the footage slate) defer to a slugged link with the same href.
  function canonical(link) {
    if (link.dataset.slug) return link;
    return [...document.querySelectorAll('a[data-slug]')].find((a) => a.href === link.href) || link;
  }

  function open(link, { autoplay = true } = {}) {
    const source = canonical(link);
    const src = toEmbed(source.dataset.video || source.href, autoplay);
    if (!src) return false;
    const label = source.dataset.caption || link.textContent.trim();
    caption.textContent = label;
    frame.innerHTML = `<iframe src="${src}" title="${label || 'Video'}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media"></iframe>`;
    isOpen = true;
    returnFocus = document.activeElement;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    closeBtn.focus({ preventScroll: true });
    // The dust draws the player first: the frame's edge and the caption. The video, loading
    // meanwhile, fades up inside it at the handover (see .player.open in player.css).
    window.slowdust?.form([caption, closeBtn], HANDOVER_MS, (o) => {
      const r = frame.getBoundingClientRect();
      o.lineWidth = 4;
      o.strokeRect(r.left + 2, r.top + 2, r.width - 4, r.height - 4);
    });
    if (source.dataset.slug) {
      prevUrl = location.href;
      history.replaceState(null, '', new URL(`work/${source.dataset.slug}/`, home));
      document.title = `${label} — ${siteName}`;
    }
    return true;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    // Drop the iframe once faded so playback stops.
    setTimeout(() => {
      if (!isOpen) frame.innerHTML = '';
    }, 500);
    window.slowdust?.restore();
    returnFocus?.focus?.({ preventScroll: true });
    if (prevUrl !== null) {
      history.replaceState(null, '', prevUrl);
      document.title = siteName;
      prevUrl = null;
    }
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-embed]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (open(link)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  closeBtn.addEventListener('click', close);
  el.addEventListener('click', (e) => {
    if (!e.target.closest('.player-inner')) close();
  });
  // Capture phase so Escape closes the player before anything underneath reacts to it.
  window.addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape') {
      e.stopImmediatePropagation();
      close();
    }
  }, true);

  // Landing on a project's own page (window.SLOWDUST_OPEN) does not open the player: nothing
  // plays unless the visitor picks it. The page's own script opens the list with that row marked.

  window.slowdustPlayer = { open, close };
})();
