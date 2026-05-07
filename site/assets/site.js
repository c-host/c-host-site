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
})();

