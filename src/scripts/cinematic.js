/**
 * CinematicScrollExperience
 * Scroll-driven 248-frame sequence rendered on a canvas, with synced chapters.
 * Vanilla, dependency-free, and progressively loaded.
 */
(() => {
  "use strict";

  const section = document.querySelector("[data-cinematic]");
  if (!section) return;

  const canvas = section.querySelector("[data-cinematic-canvas]");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const chapters = Array.from(section.querySelectorAll("[data-chapter]"));
  const dots = Array.from(section.querySelectorAll("[data-chapter-dot]"));
  const countCurrent = section.querySelector("[data-frame-current]");
  const progressFill = section.querySelector("[data-progress-fill]");
  const loaderBar = section.querySelector("[data-loader-bar]");
  const loader = section.querySelector("[data-cinematic-loader]");
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const FRAME_COUNT = Number(section.dataset.frameCount) || 248;
  const IMAGE_W = 800;
  const IMAGE_H = 450;
  const MAX_DPR = 2;

  const isCompact = window.matchMedia("(max-width: 640px)").matches;
  const variant = isCompact ? "640" : "800";
  const AHEAD = isCompact ? 16 : 24;
  const BEHIND = isCompact ? 8 : 12;
  const KEEP_RADIUS = isCompact ? 20 : 26;
  const INITIAL_AHEAD = isCompact ? 5 : 8;
  let current = -1;
  let lastDrawn = -1;
  let inView = true;
  let rafId = 0;
  let falling = false;
  let direction = 1;
  let primed = false;

  const loaded = new Map();
  const pending = new Set();
  const failed = new Set();

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const frameUrl = (i) =>
    `/assets/frames/${variant}/frame-${String(i).padStart(3, "0")}.jpg`;

  function setCanvasSize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      lastDrawn = -1;
    }
  }

  function draw(index) {
    if (!ctx) return;
    const img = loaded.get(index);
    if (!img || !img.complete || !img.naturalWidth) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / IMAGE_W, ch / IMAGE_H);
    const w = IMAGE_W * scale;
    const h = IMAGE_H * scale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#10281c";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    lastDrawn = index;
  }

  function drawNearest(target) {
    if (loaded.has(target)) {
      if (lastDrawn !== target) draw(target);
      return;
    }
    let best = -1;
    let bestDist = Infinity;
    for (const key of loaded.keys()) {
      const dist = Math.abs(key - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = key;
      }
    }
    if (best >= 0 && bestDist <= 12 && lastDrawn !== best) draw(best);
  }

  function requestFrame(i) {
    if (i < 0 || i >= FRAME_COUNT) return;
    if (loaded.has(i) || pending.has(i) || failed.has(i)) return;

    pending.add(i);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      pending.delete(i);
      loaded.set(i, img);
      if (loaderBar) {
        const preloadTarget = Math.min(FRAME_COUNT, 14);
        const pct = Math.min(100, Math.round((loaded.size / preloadTarget) * 100));
        loaderBar.style.width = `${pct}%`;
      }
      if (i === 0 || loaded.size === 1) reveal();
      if (Math.abs(i - current) <= 2) drawNearest(current);
      // Keep the window filling instead of stopping after the first batch.
      ensureWindow(current < 0 ? 0 : current, direction);
    };
    img.onerror = () => {
      pending.delete(i);
      failed.add(i);
      if (loaded.size === 0 && failed.size >= 3) fallback();
      else ensureWindow(current < 0 ? 0 : current, direction);
    };
    img.src = frameUrl(i);
  }

  function ensureWindow(center, direction) {
    // Until the visitor shows intent to scroll, only the opening frames are
    // fetched. That keeps the first paint light; the full window opens on the
    // first wheel/touch/scroll event, ahead of the actual movement.
    const ahead = primed ? (direction >= 0 ? AHEAD : BEHIND) : INITIAL_AHEAD;
    const behind = primed ? (direction >= 0 ? BEHIND : AHEAD) : 0;
    const order = [];
    for (let d = 0; d <= Math.max(ahead, behind); d++) {
      const forward = center + d;
      const back = center - d;
      if (forward <= center + ahead && forward < FRAME_COUNT) order.push(forward);
      if (d > 0 && back >= center - behind && back >= 0) order.push(back);
    }
    for (const i of order) {
      if (pending.size >= 6) break;
      requestFrame(i);
    }
    // Release decoded frames far from the playhead, but never the one on screen:
    // a long jump should not blank the canvas while the new frame arrives.
    for (const key of loaded.keys()) {
      if (key === lastDrawn) continue;
      if (Math.abs(key - center) > KEEP_RADIUS) loaded.delete(key);
    }
  }

  function prime() {
    if (primed || falling) return;
    primed = true;
    ensureWindow(current < 0 ? 0 : current, direction);
  }

  function reveal() {
    if (section.classList.contains("is-loading")) {
      section.classList.remove("is-loading");
      section.removeAttribute("aria-busy");
      window.setTimeout(() => {
        if (loader) loader.hidden = true;
      }, 900);
    }
  }

  function fallback() {
    falling = true;
    section.classList.add("cinematic--fallback");
    section.classList.remove("is-loading");
    section.removeAttribute("aria-busy");
    if (loader) loader.hidden = true;
    cancelAnimationFrame(rafId);
  }

  function activeChapterFor(index) {
    for (let i = 0; i < chapters.length; i++) {
      const start = Number(chapters[i].dataset.start);
      const end = Number(chapters[i].dataset.end);
      if (index >= start && index <= end) return i;
    }
    return index < Number(chapters[0]?.dataset.start || 0) ? 0 : chapters.length - 1;
  }

  let activeChapter = -1;

  function setActiveChapter(index) {
    if (index === activeChapter) return;
    activeChapter = index;
    chapters.forEach((chapter, i) => {
      chapter.classList.toggle("is-active", i === index);
    });
    dots.forEach((dot, i) => {
      const isActive = i === index;
      dot.classList.toggle("is-active", isActive);
      if (isActive) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
  }

  function goToChapter(i) {
    const chapter = chapters[i];
    if (!chapter) return;
    prime();
    const start = Number(chapter.dataset.start);
    const end = Number(chapter.dataset.end);
    const mid = (start + end) / 2;
    const total = section.offsetHeight - window.innerHeight;
    const top = section.offsetTop + (mid / (FRAME_COUNT - 1)) * total;
    window.scrollTo({
      top,
      behavior: reduceQuery.matches ? "auto" : "smooth",
    });
  }

  function sync() {
    if (falling || !inView) return;

    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    if (total <= 0) return;

    const progress = clamp(-rect.top / total, 0, 1);
    const index = Math.round(progress * (FRAME_COUNT - 1));

    // Visiting mid-sequence (restored scroll or a deep link) counts as intent.
    if (progress > 0.002) prime();

    if (index !== current) {
      direction = index > current ? 1 : -1;
      current = index;
      ensureWindow(index, direction);
      drawNearest(index);
      setActiveChapter(activeChapterFor(index));

      if (countCurrent) countCurrent.textContent = String(index + 1).padStart(3, "0");
      if (progressFill) progressFill.style.height = `${(progress * 100).toFixed(1)}%`;
      section.classList.toggle("has-progress", progress > 0.005);
    }
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    sync();
  }

  function onResize() {
    setCanvasSize();
    lastDrawn = -1;
    drawNearest(current < 0 ? 0 : current);
    sync();
  }

  function start() {
    if (reduceQuery.matches) {
      section.classList.add("cinematic--static");
      section.classList.remove("is-loading");
      section.removeAttribute("aria-busy");
      if (loader) loader.hidden = true;
      return;
    }

    setCanvasSize();
    ensureWindow(0, 1);

    // Open the full loading window as soon as the visitor signals intent,
    // before the scroll itself reaches the next frames.
    ["wheel", "touchstart", "keydown"].forEach((type) =>
      window.addEventListener(type, prime, { passive: true, once: true })
    );

    // Safety net: never leave the visitor staring at a loading screen.
    window.setTimeout(reveal, 2600);

    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => goToChapter(i));
    });

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          inView = entries.some((entry) => entry.isIntersecting);
          if (inView) {
            ensureWindow(current < 0 ? 0 : current, 1);
            drawNearest(current < 0 ? 0 : current);
          }
        },
        { rootMargin: "35% 0px 35% 0px" }
      );
      io.observe(section);
    }

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });
    // Scroll drives the sequence even if animation frames are throttled.
    window.addEventListener("scroll", sync, { passive: true });

    loop();
    sync();
  }

  start();

  // If the visitor switches on reduced motion mid-visit, stop scrubbing.
  reduceQuery.addEventListener?.("change", (event) => {
    if (event.matches) {
      falling = true;
      section.classList.add("cinematic--static");
      section.classList.remove("is-loading");
      section.removeAttribute("aria-busy");
      cancelAnimationFrame(rafId);
    }
  });

  // Expose a tiny hook for debugging and future integrations.
  window.CyatoCinematic = {
    get frame() { return current; },
    get count() { return FRAME_COUNT; },
    get loaded() { return loaded.size; },
  };
})();
