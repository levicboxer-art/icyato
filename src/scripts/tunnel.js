/**
 * GradeTunnel
 * A perspective plane for the commercial grades. Scroll drives depth,
 * the pointer adds a light camera parallax, and every grade converges to
 * the centre before handing over to the next one.
 *
 * Vanilla, dependency-free. Without JS the section stays a readable grid.
 */
(() => {
  "use strict";

  const section = document.querySelector("[data-tunnel]");
  if (!section) return;

  const track = section.querySelector("[data-tunnel-track]");
  const stage = section.querySelector("[data-tunnel-stage]");
  const anchor = section.querySelector("[data-tunnel-anchor]");
  const cards = Array.from(section.querySelectorAll("[data-tunnel-card]"));
  const inners = cards.map((card) => card.querySelector(".tunnel-card__inner"));
  const dots = Array.from(section.querySelectorAll("[data-tunnel-dot]"));
  const count = section.querySelector("[data-tunnel-count]");
  const nameEl = section.querySelector("[data-tunnel-name]");
  const linkEl = section.querySelector("[data-tunnel-link]");
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!track || !stage || !anchor || cards.length < 2) return;

  const N = cards.length;
  const START_OFFSET = -0.06;

  const codes = cards.map(
    (card) => card.querySelector(".tunnel-card__code")?.textContent.trim() || ""
  );
  const names = cards.map(
    (card) => card.querySelector(".tunnel-card__name")?.textContent.trim() || ""
  );

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  let view = null;
  let enabled = false;
  let current = 0;
  let target = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let rafId = 0;
  let active = -1;

  function measure() {
    const width = stage.clientWidth || window.innerWidth;
    const height = stage.clientHeight || window.innerHeight;
    const compact = width < 720;

    view = {
      width,
      height,
      compact,
      span: compact ? 0.42 : 0.36,
      far: compact ? -1700 : -1450,
      near: compact ? 60 : 330,
      pan: compact ? 16 : 38,
    };
  }

  // Cards are staggered across the scroll travel: the first opens early,
  // the last arrives just before the section releases.
  const startFor = (index, span) => (index / (N - 1)) * (1 - span) + START_OFFSET;

  function scrollProgress() {
    const rect = track.getBoundingClientRect();
    const travel = track.offsetHeight - stage.offsetHeight;
    if (travel <= 0) return 0;
    return clamp(-rect.top / travel, 0, 1);
  }

  function render() {
    if (!view) return;
    const { width, height, span, far, pan } = view;
    let bestIndex = 0;
    let bestPresence = -1;

    for (let i = 0; i < N; i++) {
      const card = cards[i];
      const local = clamp((current - startFor(i, span)) / span, 0, 1);

      // The final grade settles instead of flying past, so the pinned
      // stage never ends on an empty frame.
      const near = i === N - 1 ? view.near * 0.6 : view.near;
      const z = far + local * (near - far);

      // Cards spiral in from their golden-angle seats and gather at centre.
      // Compact screens converge earlier, so an incoming card sits inside the
      // outgoing one instead of peeking out beside it on a narrow viewport.
      const focus = view.compact
        ? smoothstep(0.3, 0.62, local)
        : smoothstep(0.4, 0.78, local);
      const gather = 1 - focus * (view.compact ? 0.94 : 0.9);

      const angle = (i * 137.5 * Math.PI) / 180;
      const radiusX = 0.26 + (i % 3) * 0.075;
      const radiusY = 0.22 + (i % 2) * 0.07;
      const baseX = Math.cos(angle) * width * radiusX;
      const baseY = Math.sin(angle) * height * radiusY;

      const x = baseX * gather - pointerX * pan;
      const y = baseY * gather - pointerY * pan;
      const tilt = (i % 2 === 0 ? 1 : -1) * (2 + (i % 4) * 1.5) * (1 - focus);

      // Cards stay opaque through the flight so the nearer card occludes the
      // one behind it; fading is reserved for the far entry and the exit.
      // On compact screens the incoming card is held back until it is close,
      // because a large card behind a large card reads as clutter.
      const appear = smoothstep(
        view.compact ? 0.55 : 0.02,
        view.compact ? 0.7 : 0.18,
        local
      );
      const leave = i === N - 1 ? 0 : smoothstep(0.93, 1, local);
      const opacity = appear * (1 - leave);

      // The card that visually owns the stage: opaque and the most advanced.
      const presence = opacity * Math.min(local, 1);
      if (presence > bestPresence) {
        bestPresence = presence;
        bestIndex = i;
      }

      card.style.transform =
        `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px), ${z.toFixed(1)}px) ` +
        `rotateZ(${tilt.toFixed(2)}deg)`;
      // Opacity lives on the inner surface: fading the 3D-positioned element
      // itself would flatten it and break depth sorting against its siblings.
      if (inners[i]) inners[i].style.opacity = opacity.toFixed(3);
    }

    // The headline steps back as the first grade arrives.
    const retreat = smoothstep(0.02, 0.18, current);
    anchor.style.opacity = (1 - retreat).toFixed(3);
    anchor.style.transform =
      `translate3d(-50%, ${(-retreat * 18).toFixed(1)}px, 0) scale(${(1 + current * 0.05).toFixed(3)})`;

    section.style.setProperty("--tunnel-p", current.toFixed(4));

    setActive(bestIndex);
  }

  function setActive(best) {
    if (best === active) return;
    active = best;

    dots.forEach((dot, i) => {
      if (i === best) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });

    if (count) count.textContent = String(best + 1).padStart(2, "0");
    if (nameEl) nameEl.textContent = names[best];

    if (linkEl) {
      linkEl.href = `/contact/?grade=${encodeURIComponent(codes[best])}&category=specifications`;
      linkEl.setAttribute(
        "aria-label",
        `Request specifications for ${codes[best]} — ${names[best]}`
      );
    }
  }

  function frame() {
    const delta = target - current;
    const dx = pointerTargetX - pointerX;
    const dy = pointerTargetY - pointerY;

    current = Math.abs(delta) < 0.0004 ? target : current + delta * 0.14;
    pointerX = Math.abs(dx) < 0.001 ? pointerTargetX : pointerX + dx * 0.1;
    pointerY = Math.abs(dy) < 0.001 ? pointerTargetY : pointerY + dy * 0.1;

    render();

    if (current !== target || pointerX !== pointerTargetX || pointerY !== pointerTargetY) {
      rafId = requestAnimationFrame(frame);
    } else {
      rafId = 0;
    }
  }

  function kick() {
    if (!enabled || rafId) return;
    rafId = requestAnimationFrame(frame);
  }

  function onScroll() {
    if (!enabled) return;
    target = scrollProgress();
    kick();
  }

  function onPointer(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;
    pointerTargetX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointerTargetY = (event.clientY / window.innerHeight - 0.5) * 2;
    kick();
  }

  function onPointerLeave() {
    pointerTargetX = 0;
    pointerTargetY = 0;
    kick();
  }

  function onResize() {
    if (!enabled) return;
    measure();
    onScroll();
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    section.classList.add("is-enhanced");
    measure();
    active = -1;
    current = scrollProgress();
    target = current;
    render();
  }

  function disable() {
    enabled = false;
    section.classList.remove("is-enhanced");
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    cards.forEach((card, i) => {
      card.style.transform = "";
      if (inners[i]) inners[i].style.opacity = "";
    });
    anchor.style.transform = "";
    anchor.style.opacity = "";
    section.style.removeProperty("--tunnel-p");
    active = -1;
  }

  function syncMode() {
    if (reduceQuery.matches) disable();
    else enable();
  }

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      if (!enabled || !view) return;
      const progress = clamp(startFor(i, view.span) + 0.78 * view.span, 0, 1);
      const travel = track.offsetHeight - stage.offsetHeight;
      const top = track.getBoundingClientRect().top + window.scrollY + progress * travel;
      window.scrollTo({ top, behavior: reduceQuery.matches ? "auto" : "smooth" });
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  stage.addEventListener("pointermove", onPointer, { passive: true });
  stage.addEventListener("pointerleave", onPointerLeave);

  if (reduceQuery.addEventListener) reduceQuery.addEventListener("change", syncMode);

  syncMode();
})();
