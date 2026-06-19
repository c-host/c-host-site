(() => {
  const root = document.documentElement;
  const THEME_KEY = "site-theme";

  const preferredTheme = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const readTheme = () => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === "dark" || saved === "light" ? saved : preferredTheme();
    } catch {
      return preferredTheme();
    }
  };

  const writeTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage errors in restrictive browser modes.
    }
  };

  const updateToggleLabel = (button, theme) => {
    button.textContent = theme === "dark" ? "Light" : "Dark";
    button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  };

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "theme-toggle";
  const initialTheme = readTheme();
  writeTheme(initialTheme);
  updateToggleLabel(toggle, initialTheme);
  toggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    writeTheme(next);
    updateToggleLabel(toggle, next);
  });
  const wrap = document.querySelector(".wrap");
  (wrap || document.body).appendChild(toggle);

  const path = (location.pathname || "/").replace(/\/+$/, "/");
  const links = document.querySelectorAll("a[href]");

  for (const a of links) {
    const href = a.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("http:") || href.startsWith("https:") || href.startsWith("mailto:")) continue;
    const url = new URL(href, location.href);
    const normalized = (url.pathname || "/").replace(/\/+$/, "/");
    if (normalized === path) a.classList.add("active");
  }

  const accordions = Array.from(document.querySelectorAll(".project-accordion"));
  for (const accordion of accordions) {
    const items = Array.from(accordion.querySelectorAll(".project-item"));
    const collapse = (item) => {
      const trigger = item.querySelector(".project-trigger");
      const panel = item.querySelector(".project-panel");
      if (!trigger || !panel) return;
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-current", "false");
      panel.hidden = true;
    };

    const expand = (item) => {
      const trigger = item.querySelector(".project-trigger");
      const panel = item.querySelector(".project-panel");
      if (!trigger || !panel) return;
      trigger.setAttribute("aria-expanded", "true");
      trigger.setAttribute("aria-current", "true");
      panel.hidden = false;
    };

    for (const item of items) {
      const trigger = item.querySelector(".project-trigger");
      if (!trigger) continue;
      trigger.addEventListener("click", () => {
        const isOpen = trigger.getAttribute("aria-expanded") === "true";
        if (isOpen) {
          collapse(item);
          return;
        }
        for (const other of items) collapse(other);
        expand(item);
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      });
    }
  }

  const zoomableImages = Array.from(document.querySelectorAll("main img")).filter(
    (img) => !img.closest("a") && !img.hasAttribute("data-no-lightbox")
  );

  if (zoomableImages.length > 0) {
    const lightbox = document.createElement("div");
    lightbox.className = "image-lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Image preview");

    const lightboxImage = document.createElement("img");
    lightboxImage.alt = "";
    lightbox.appendChild(lightboxImage);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "lightbox-close";
    closeButton.setAttribute("aria-label", "Close image preview");
    closeButton.textContent = "Close";

    let activeSourceImage = null;

    const closeLightbox = () => {
      lightbox.hidden = true;
      closeButton.hidden = true;
      document.body.classList.remove("lightbox-open");
      lightboxImage.src = "";
      if (activeSourceImage) activeSourceImage.focus();
      activeSourceImage = null;
    };

    const openLightbox = (sourceImage) => {
      activeSourceImage = sourceImage;
      lightboxImage.src = sourceImage.currentSrc || sourceImage.src;
      lightboxImage.alt = sourceImage.alt || "Expanded image";
      lightbox.hidden = false;
      closeButton.hidden = false;
      document.body.classList.add("lightbox-open");
      closeButton.focus();
    };

    for (const image of zoomableImages) {
      image.classList.add("zoomable-image");
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      if (!image.getAttribute("aria-label")) {
        const label = image.alt ? `Expand image: ${image.alt}` : "Expand image";
        image.setAttribute("aria-label", label);
      }
      image.addEventListener("click", () => openLightbox(image));
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(image);
        }
      });
    }

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    closeButton.addEventListener("click", closeLightbox);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !lightbox.hidden) closeLightbox();
    });

    document.body.appendChild(lightbox);
    document.body.appendChild(closeButton);
    closeButton.hidden = true;
  }

  // Inline info links: hover/focus to show extra text, contained within `.wrap`.
  // Usage:
  //   <span class="info-link" tabindex="0" data-tooltip="...">Some text</span>
  // Optional external link icon:
  //   add `data-ext-href="https://..."` anda small icon link will be injected next to the text.
  const INFO_LINK_SELECTOR = ".info-link[data-tooltip]";
  let infoTooltipEl = null;
  let activeInfoLink = null;

  const ensureInfoTooltip = (wrapEl) => {
    if (infoTooltipEl && infoTooltipEl.closest(".wrap") === wrapEl) return infoTooltipEl;
    if (infoTooltipEl) infoTooltipEl.remove();
    infoTooltipEl = document.createElement("div");
    infoTooltipEl.className = "info-tooltip";
    infoTooltipEl.hidden = true;
    wrapEl.appendChild(infoTooltipEl);
    return infoTooltipEl;
  };

  const hideInfoTooltip = () => {
    if (!infoTooltipEl) return;
    infoTooltipEl.hidden = true;
    infoTooltipEl.textContent = "";
    activeInfoLink = null;
  };

  const showInfoTooltip = (linkEl) => {
    const wrapEl = linkEl.closest(".wrap") || document.body;
    if (!(wrapEl instanceof HTMLElement)) return;
    const tooltip = ensureInfoTooltip(wrapEl);
    const text = linkEl.getAttribute("data-tooltip") || "";
    if (!text) return;

    activeInfoLink = linkEl;
    tooltip.textContent = text;
    tooltip.hidden = false;

    // Measure and position within wrap: prefer above, else below.
    tooltip.style.visibility = "hidden";
    tooltip.style.top = "0px";
    const wrapRect = wrapEl.getBoundingClientRect();
    const linkRect = linkEl.getBoundingClientRect();
    const tipH = tooltip.offsetHeight || 0;
    // Adjust for the padding of the tooltip itself
    const gap = 10;

    let top = linkRect.top - wrapRect.top - tipH - gap;
    if (top < 6) top = linkRect.bottom - wrapRect.top + gap;
    tooltip.style.top = `${Math.max(6, top)}px`;
    tooltip.style.visibility = "";
  };

  const ensureInfoExternalIcons = () => {
    for (const linkEl of document.querySelectorAll(`${INFO_LINK_SELECTOR}[data-ext-href]`)) {
      if (linkEl.dataset.infoExtInjected === "1") continue;
      const href = linkEl.getAttribute("data-ext-href");
      if (!href) continue;

      const a = document.createElement("a");
      a.className = "info-ext";
      a.href = href;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.setAttribute("aria-label", "Open external link (opens in new tab)");
      a.setAttribute("title", "Open external link");
      // Icon is provided via CSS mask; keep markup minimal.

      linkEl.insertAdjacentElement("afterend", a);
      linkEl.dataset.infoExtInjected = "1";
    }
  };

  ensureInfoExternalIcons();

  document.addEventListener("mouseover", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const linkEl = target.closest(INFO_LINK_SELECTOR);
    if (linkEl) showInfoTooltip(linkEl);
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const linkEl = target.closest(INFO_LINK_SELECTOR);
    if (linkEl) showInfoTooltip(linkEl);
  });

  document.addEventListener("mouseout", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !activeInfoLink) return;
    if (target === activeInfoLink || target.closest(INFO_LINK_SELECTOR) === activeInfoLink) hideInfoTooltip();
  });

  document.addEventListener("focusout", () => hideInfoTooltip());

  window.addEventListener("scroll", () => {
    if (activeInfoLink) showInfoTooltip(activeInfoLink);
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (activeInfoLink) showInfoTooltip(activeInfoLink);
  });

  // Close any open `<details class="portfolios">` menu on outside click.
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    for (const menu of document.querySelectorAll("details.portfolios[open]")) {
      if (!target || !menu.contains(target)) menu.open = false;
    }
  });

  // "Special links": add class `special-link` and data fields.
  // Required: href
  // Optional: data-passcode (copy button), data-special-title, data-special-hint, data-special-field-*
  const SPECIAL_LINK_SELECTOR = "a.special-link";
  const SPECIAL_FIELD_PREFIX = "data-special-field-";
  const SPECIAL_MODAL_ID = "specialLinkModal";
  const DEFAULT_SPECIAL_TITLE = "This link requires additional information";
  const DEFAULT_SPECIAL_HINT = "Copy the information and then open the link";

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const prettyLabel = (raw) =>
    String(raw || "")
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase()) || "Field";

  const ensureSpecialLinkModal = () => {
    let modal = document.getElementById(SPECIAL_MODAL_ID);
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = SPECIAL_MODAL_ID;
    modal.className = "special-link-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="special-link-modal__backdrop" data-special-link-close></div>
      <div class="special-link-modal__panel" role="dialog" aria-modal="true" aria-labelledby="specialLinkTitle">
        <h2 class="special-link-modal__title" id="specialLinkTitle"></h2>
        <p class="special-link-modal__hint small" id="specialLinkHint"></p>
        <div class="special-link-modal__kv" id="specialLinkKv"></div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  };

  let lastFocusedSpecial = null;
  let specialCloseButton = null;

  const ensureSpecialCloseButton = () => {
    if (specialCloseButton) return specialCloseButton;
    specialCloseButton = document.createElement("button");
    specialCloseButton.type = "button";
    // Reuse the exact close-button pattern from the image lightbox.
    specialCloseButton.className = "lightbox-close";
    specialCloseButton.setAttribute("aria-label", "Close");
    specialCloseButton.textContent = "Close";
    specialCloseButton.hidden = true;
    document.body.appendChild(specialCloseButton);
    return specialCloseButton;
  };

  const copyText = async (text) => {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const openSpecialLinkModal = (trigger) => {
    const modal = ensureSpecialLinkModal();
    const closeBtn = ensureSpecialCloseButton();
    const titleEl = modal.querySelector("#specialLinkTitle");
    const hintEl = modal.querySelector("#specialLinkHint");
    const kvRoot = modal.querySelector("#specialLinkKv");
    if (!titleEl || !hintEl || !kvRoot) return;

    lastFocusedSpecial = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const url = trigger.getAttribute("href") || "";
    const title = trigger.getAttribute("data-special-title") || DEFAULT_SPECIAL_TITLE;
    const hint = trigger.getAttribute("data-special-hint") || DEFAULT_SPECIAL_HINT;
    const passcode = trigger.getAttribute("data-passcode") || trigger.getAttribute("data-special-passcode") || "";

    titleEl.textContent = title;
    hintEl.textContent = hint;

    let rows = `
      <div class="special-link-modal__row">
        <div class="special-link-modal__label">Link</div>
        <div class="special-link-modal__value">
          <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url || "Open link")}</a>
        </div>
      </div>`;

    if (passcode) {
      rows += `
        <div class="special-link-modal__row">
          <div class="special-link-modal__label">Passcode</div>
          <div class="special-link-modal__value">
            <code id="specialLinkPasscode">${escapeHtml(passcode)}</code>
            <button class="special-link-modal__btn" type="button" id="specialLinkCopyBtn">Copy</button>
          </div>
        </div>`;
    }

    for (const attr of trigger.attributes) {
      if (!attr.name.startsWith(SPECIAL_FIELD_PREFIX)) continue;
      const key = attr.name.slice(SPECIAL_FIELD_PREFIX.length);
      const value = attr.value;
      if (!value) continue;
      rows += `
        <div class="special-link-modal__row">
          <div class="special-link-modal__label">${escapeHtml(prettyLabel(key))}</div>
          <div class="special-link-modal__value"><span>${escapeHtml(value)}</span></div>
        </div>`;
    }

    kvRoot.innerHTML = rows;

    const copyBtn = modal.querySelector("#specialLinkCopyBtn");
    if (copyBtn) {
      copyBtn.addEventListener(
        "click",
        async () => {
          const ok = await copyText(passcode);
          copyBtn.textContent = ok ? "Copied" : "Copy failed";
        },
        { once: true }
      );
    }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    closeBtn.hidden = false;
    closeBtn.onclick = closeSpecialLinkModal;
    closeBtn.focus();
  };

  const closeSpecialLinkModal = () => {
    const modal = document.getElementById(SPECIAL_MODAL_ID);
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    const closeBtn = ensureSpecialCloseButton();
    closeBtn.hidden = true;
    closeBtn.onclick = null;
    if (lastFocusedSpecial) lastFocusedSpecial.focus();
    lastFocusedSpecial = null;
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const trigger = target.closest(SPECIAL_LINK_SELECTOR);
    if (trigger) {
      event.preventDefault();
      openSpecialLinkModal(trigger);
      return;
    }
    const close = target.closest("[data-special-link-close]");
    if (close) {
      event.preventDefault();
      closeSpecialLinkModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById(SPECIAL_MODAL_ID);
    if (!modal || modal.hidden) return;
    if (event.key === "Escape") closeSpecialLinkModal();
  });
})();

