/**
 * Cyato Tea — site interactions
 * Navigation, reveals, parallax, and the business inquiry form.
 */
(() => {
  "use strict";

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = () => reduceQuery.matches;

  /* ------------------------------------------------------------------ */
  /* Header                                                              */
  /* ------------------------------------------------------------------ */
  const header = document.querySelector("[data-header]");

  const syncHeader = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 30);
  };

  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  /* ------------------------------------------------------------------ */
  /* Active navigation state                                             */
  /* ------------------------------------------------------------------ */
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href")?.replace(/\/+$/, "") || "/";
    if (href === path || (href === "/" && path === "")) {
      link.setAttribute("aria-current", "page");
    }
  });

  /* ------------------------------------------------------------------ */
  /* Mobile navigation                                                   */
  /* ------------------------------------------------------------------ */
  const toggle = document.querySelector("[data-nav-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");

  if (toggle && mobileNav) {
    const close = () => {
      toggle.setAttribute("aria-expanded", "false");
      mobileNav.classList.remove("is-open");
      mobileNav.setAttribute("aria-hidden", "true");
      document.body.classList.remove("nav-open");
    };

    const open = () => {
      toggle.setAttribute("aria-expanded", "true");
      mobileNav.classList.add("is-open");
      mobileNav.setAttribute("aria-hidden", "false");
      document.body.classList.add("nav-open");
      mobileNav.querySelector("a")?.focus();
    };

    toggle.addEventListener("click", () => {
      if (toggle.getAttribute("aria-expanded") === "true") close();
      else open();
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", close);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileNav.classList.contains("is-open")) {
        close();
        toggle.focus();
      }
    });

    window.matchMedia("(min-width: 1081px)").addEventListener("change", (event) => {
      if (event.matches) close();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveals                                                      */
  /* ------------------------------------------------------------------ */
  const revealNodes = Array.from(document.querySelectorAll("[data-reveal]"));

  if (revealNodes.length) {
    if (prefersReduced() || !("IntersectionObserver" in window)) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
      );
      revealNodes.forEach((node) => observer.observe(node));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Subtle parallax for editorial imagery                               */
  /* ------------------------------------------------------------------ */
  const parallaxNodes = Array.from(document.querySelectorAll("[data-parallax]"));
  const canParallax = parallaxNodes.length && !prefersReduced() && window.innerWidth > 900;

  if (canParallax) {
    let ticking = false;

    const apply = () => {
      ticking = false;
      const vh = window.innerHeight;
      parallaxNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) return;
        const strength = Number(node.dataset.parallax) || 0.06;
        const offset = (rect.top + rect.height / 2 - vh / 2) * strength;
        node.style.transform = `translate3d(0, ${Math.max(-60, Math.min(60, offset)).toFixed(2)}px, 0)`;
      });
    };

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(apply);
      },
      { passive: true }
    );

    apply();
  }

  /* ------------------------------------------------------------------ */
  /* Business inquiry form                                               */
  /* ------------------------------------------------------------------ */
  const form = document.querySelector("[data-inquiry-form]");

  if (form) {
    const status = form.querySelector("[data-form-status]");
    const fields = {
      name: form.querySelector("#name"),
      company: form.querySelector("#company"),
      email: form.querySelector("#email"),
      country: form.querySelector("#country"),
      category: form.querySelector("#category"),
      quantity: form.querySelector("#quantity"),
      grade: form.querySelector("#grade"),
      requirements: form.querySelector("#requirements"),
    };

    const setError = (field, message) => {
      const wrapper = field.closest(".field");
      const errorNode = wrapper?.querySelector("[data-error]");
      if (message) {
        field.setAttribute("aria-invalid", "true");
        if (errorNode) errorNode.textContent = message;
      } else {
        field.removeAttribute("aria-invalid");
        if (errorNode) errorNode.textContent = "";
      }
    };

    const emailIsValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

    const validators = {
      name: (value) => (value.trim().length >= 2 ? "" : "Please enter your full name."),
      company: (value) => (value.trim().length >= 2 ? "" : "Please enter your company name."),
      email: (value) =>
        emailIsValid(value) ? "" : "Please enter a valid business email address.",
      country: (value) => (value.trim().length >= 2 ? "" : "Please enter your country."),
      category: (value) => (value ? "" : "Please select an inquiry category."),
    };

    Object.entries(validators).forEach(([key, validate]) => {
      const field = fields[key];
      if (!field) return;
      field.addEventListener("blur", () => setError(field, validate(field.value)));
      field.addEventListener("input", () => {
        if (field.getAttribute("aria-invalid") === "true") {
          setError(field, validate(field.value));
        }
      });
      field.addEventListener("change", () => {
        if (field.getAttribute("aria-invalid") === "true") {
          setError(field, validate(field.value));
        }
      });
    });

    const showStatus = (html, isError) => {
      if (!status) return;
      status.hidden = false;
      status.classList.toggle("form__status--error", !!isError);
      status.innerHTML = html;
      status.focus?.({ preventScroll: true });
      status.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "center" });
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let firstInvalid = null;

      Object.entries(validators).forEach(([key, validate]) => {
        const field = fields[key];
        if (!field) return;
        const message = validate(field.value);
        setError(field, message);
        if (message && !firstInvalid) firstInvalid = field;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        showStatus(
          "<strong>Please check the highlighted fields.</strong> A few details are missing before this inquiry can be reviewed.",
          true
        );
        return;
      }

      const name = fields.name?.value.trim() || "";
      const company = fields.company?.value.trim() || "";
      const email = fields.email?.value.trim() || "";
      const country = fields.country?.value.trim() || "";
      const category = fields.category?.value || "Not specified";
      const quantity = fields.quantity?.value.trim() || "Not specified";
      const grade = fields.grade?.value || "Not specified";

      // Honest state: there is no inquiry endpoint yet. Nothing is transmitted.
      showStatus(
        `<strong>Inquiry captured in this browser only — not sent.</strong><br />
         Online submission is awaiting server configuration, so no data has left this page.
         To reach the commercial team now, call
         <a href="tel:+250788310481" style="text-decoration:underline">+250 788 310 481</a>
         and quote the reference below.<br /><br />
         <span style="display:block;letter-spacing:.02em;font-size:.82rem;color:#5c6357">
           Reference: ${name} · ${company} · ${email} · ${country}<br />
           Category: ${category} · Quantity: ${quantity} · Grade: ${grade}
         </span>`,
        false
      );
      form.reset();
      Object.values(fields).forEach((field) => field && setError(field, ""));
    });

    // Prefill from campaign links, e.g. /contact/?category=private-label&grade=BP1
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const grade = params.get("grade");
    if (category && fields.category) fields.category.value = category;
    if (grade && fields.grade) fields.grade.value = grade;
  }

  /* ------------------------------------------------------------------ */
  /* Lazy map                                                            */
  /* ------------------------------------------------------------------ */
  const map = document.querySelector("[data-map]");
  const mapLoad = map?.querySelector("[data-map-load]");

  if (map && mapLoad) {
    mapLoad.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = map.dataset.mapSrc;
      iframe.title = "Map showing Cyato Tea's location in Nyamasheke District, Rwanda";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.allowFullscreen = true;
      map.querySelector("[data-map-placeholder]")?.replaceWith(iframe);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Anchor links: close mobile nav, respect reduced motion              */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });
})();
