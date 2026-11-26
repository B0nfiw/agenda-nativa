function qs(selector, root = document) {
  return root.querySelector(selector);
}

function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function setText(selector, text) {
  const element = qs(selector);
  if (element) element.textContent = text || "";
}

function activeItems(items) {
  return items.filter((item) => item.enabled !== false);
}

function formatDuration(minutes) {
  if (!Number.isInteger(minutes)) return "";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h${String(remaining).padStart(2, "0")}` : `${hours}h`;
}

function initialsFromName(name) {
  return String(name || "AN")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AN";
}

function setExternalLink(selector, href, hidden = false) {
  const link = qs(selector);
  if (!link) return;

  if (href && !hidden) {
    link.href = href;
    link.hidden = false;
  } else {
    link.removeAttribute("href");
    link.hidden = true;
  }
}

function wireImageFallback(img, label, onFallback) {
  img.addEventListener("error", () => {
    console.warn(`Imagem não carregada: ${label}`);
    if (typeof onFallback === "function") onFallback();
  }, { once: true });
}

function setBackgroundImage(element, url, label) {
  if (!element || !url) return;

  const image = new Image();
  image.onload = () => {
    element.style.backgroundImage = [
      "linear-gradient(160deg, rgba(0,0,0,.05), rgba(0,0,0,.35))",
      `url("${url}")`
    ].join(", ");
    element.classList.add("has-image");
    element.setAttribute("aria-label", label);
  };
  image.onerror = () => {
    console.warn(`Imagem não carregada: ${label}`);
    element.classList.add("image-fallback");
  };
  image.src = url;
}

function renderLogo(config) {
  const logo = qs("[data-logo]");
  const initials = qs("[data-brand-initials]");

  if (!logo || !initials) return;

  initials.textContent = initialsFromName(config.salon.shortName);

  if (!config.assets.logo) {
    logo.hidden = true;
    initials.hidden = false;
    return;
  }

  logo.alt = `Logo ${config.salon.name}`;
  logo.src = config.assets.logo;
  logo.hidden = false;
  initials.hidden = true;

  wireImageFallback(logo, `Logo ${config.salon.name}`, () => {
    logo.hidden = true;
    initials.hidden = false;
  });
}

function renderServices(services) {
  const grid = qs("[data-services-grid]");
  clearChildren(grid);

  activeItems(services).forEach((service, index) => {
    const card = createElement("article", "service-card reveal");
    const number = createElement("span", "", String(index + 1).padStart(2, "0"));
    const title = createElement("h3", "", service.name);
    const description = createElement("p", "", service.description);
    const meta = createElement("strong", "service-meta");
    const price = document.createTextNode(service.price || "Sob consulta");

    meta.appendChild(price);

    const duration = formatDuration(service.durationMinutes);
    if (duration) {
      const durationElement = createElement("small", "", `Duração média: ${duration}`);
      meta.appendChild(durationElement);
    }

    card.append(number, title, description, meta);
    grid.appendChild(card);
  });
}

function renderProfessionals(config) {
  const section = qs("#equipe");
  const grid = qs("[data-professionals-grid]");
  const professionals = activeItems(config.professionals);

  clearChildren(grid);

  if (!section || professionals.length === 0) {
    if (section) section.hidden = true;
    return;
  }

  professionals.forEach((professional) => {
    const card = createElement("article", "professional-card reveal");
    const photoFrame = createElement("div", "professional-photo image-fallback");
    const title = createElement("h3", "", professional.name);
    const role = createElement("p", "", professional.role || "Profissional do salão");

    if (professional.photo) {
      const img = document.createElement("img");
      img.src = professional.photo;
      img.alt = `${professional.name}, ${professional.role || "profissional do salão"}`;
      wireImageFallback(img, `Foto de ${professional.name}`, () => {
        img.remove();
        photoFrame.classList.add("image-fallback");
      });
      photoFrame.appendChild(img);
    }

    card.append(photoFrame, title, role);
    grid.appendChild(card);
  });

  section.hidden = false;
}

function renderGallery(config) {
  const grid = qs("[data-gallery-grid]");
  clearChildren(grid);

  const gallery = config.assets.gallery;
  if (gallery.length === 0) {
    const fallback = createElement("div", "gallery-item tall image-fallback reveal");
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", `Galeria de ${config.salon.name}`);
    grid.appendChild(fallback);
    return;
  }

  gallery.forEach((src, index) => {
    const item = createElement("div", "gallery-item reveal");
    if (index === 0) item.classList.add("tall");
    if (index === 3) item.classList.add("wide");

    const img = document.createElement("img");
    img.src = src;
    img.alt = `Foto ${index + 1} de ${config.salon.name}`;
    wireImageFallback(img, `Galeria ${index + 1}`, () => {
      img.remove();
      item.classList.add("image-fallback");
      item.setAttribute("role", "img");
      item.setAttribute("aria-label", `Imagem indisponível da galeria ${index + 1}`);
    });

    item.appendChild(img);
    grid.appendChild(item);
  });
}

function renderTestimonials(testimonials) {
  const section = qs("[data-testimonials-section]");
  const grid = qs("[data-testimonials-grid]");
  const activeTestimonials = activeItems(testimonials);

  clearChildren(grid);

  if (!section || activeTestimonials.length === 0) {
    if (section) section.hidden = true;
    return;
  }

  activeTestimonials.forEach((testimonial) => {
    const card = createElement("article", "quote-card reveal");
    const quote = createElement("p", "", `“${testimonial.text}”`);
    const name = createElement("strong", "", testimonial.name);
    card.append(quote, name);
    grid.appendChild(card);
  });

  section.hidden = false;
}

function renderHours(config) {
  const list = qs("[data-hours-list]");
  clearChildren(list);

  config.salon.businessHours.forEach((item) => {
    const row = createElement("div", "hours-item");
    const days = createElement("strong", "", item.days);
    const hours = createElement("span", "", item.hours);
    row.append(days, hours);
    list.appendChild(row);
  });

  const summary = config.salon.businessHours
    .slice(0, 2)
    .map((item) => `${item.days}: ${item.hours}`)
    .join(" • ");

  setText("[data-business-summary]", summary || "Consulte a disponibilidade pelo WhatsApp");
}

function renderFaq(faq) {
  const section = qs("#faq");
  const list = qs("[data-faq-list]");
  const activeFaq = activeItems(faq);

  clearChildren(list);

  if (!section || activeFaq.length === 0) {
    if (section) section.hidden = true;
    return;
  }

  activeFaq.forEach((item) => {
    const details = createElement("details", "faq-item reveal");
    const summary = createElement("summary", "", item.question);
    const answer = createElement("p", "", item.answer);
    details.append(summary, answer);
    list.appendChild(details);
  });

  section.hidden = false;
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.background);
  root.style.setProperty("--panel", theme.surface);
  root.style.setProperty("--panel-2", theme.surface);
  root.style.setProperty("--rose", theme.primary);
  root.style.setProperty("--rose-2", theme.primary);
  root.style.setProperty("--wine", theme.secondary);
  root.style.setProperty("--sage", theme.accent);
  root.style.setProperty("--white", theme.text);
  root.style.setProperty("--sand", theme.text);
  root.style.setProperty("--muted", theme.mutedText);
}

export function showLoading() {
  const status = qs("#appStatus");
  const app = qs("#app");
  const footer = qs(".footer");

  if (status) {
    status.hidden = false;
    status.className = "app-status";
    status.textContent = "Carregando informações do salão...";
  }
  if (app) app.hidden = true;
  if (footer) footer.hidden = true;
}

export function showError() {
  const status = qs("#appStatus");
  const app = qs("#app");
  const footer = qs(".footer");

  if (app) app.hidden = true;
  if (footer) footer.hidden = true;
  if (!status) return;

  status.hidden = false;
  status.className = "app-error";
  clearChildren(status);

  const title = createElement("h1", "", "Configuração indisponível");
  const message = createElement(
    "p",
    "",
    "Não foi possível carregar as informações do salão. Verifique a configuração ou entre em contato com o responsável técnico."
  );

  status.append(title, message);
}

export function renderSite(config) {
  applyTheme(config.theme);

  document.title = `${config.salon.name} | Solicitar agendamento`;

  renderLogo(config);

  setText("[data-brand-name]", config.salon.name);
  setText("[data-brand-tagline]", config.salon.tagline);
  setText("[data-hero-eyebrow]", config.booking.mode === "preview"
    ? config.salon.tagline
    : `${config.salon.tagline} • solicitação pelo WhatsApp`);
  setText("[data-hero-title]", `Solicite seu horário no ${config.salon.shortName}.`);
  setText("[data-hero-description]", config.salon.description);
  setText("[data-about-title]", config.salon.aboutTitle);
  setText("[data-about-text]", config.salon.aboutText);
  setText("[data-location-title]", `Atendimento no ${config.salon.shortName}`);
  setText("[data-location-address]", config.salon.address);
  setText("[data-map-title]", config.salon.shortName);
  setText("[data-map-subtitle]", config.salon.address);
  setText("[data-footer-text]", `${config.salon.name} • Agenda Nativa`);

  setExternalLink("[data-maps-link]", config.salon.mapsUrl);
  setExternalLink("[data-instagram-link]", config.salon.instagram, !config.salon.instagram);

  setBackgroundImage(qs("[data-hero-image]"), config.assets.hero, `Imagem de capa de ${config.salon.name}`);
  renderHours(config);
  renderServices(config.services);
  renderProfessionals(config);
  renderGallery(config);
  renderTestimonials(config.testimonials);
  renderFaq(config.faq);

  const status = qs("#appStatus");
  const app = qs("#app");
  const footer = qs(".footer");

  if (status) status.hidden = true;
  if (app) app.hidden = false;
  if (footer) footer.hidden = false;
}

export function setupNavigation() {
  const navToggle = qs(".nav-toggle");
  const nav = qs(".nav");

  navToggle?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navToggle?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    navToggle.click();
  });

  document.querySelectorAll(".nav a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      navToggle?.setAttribute("aria-expanded", "false");
    });
  });
}

export function setupReveal() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
    return;
  }

  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });

  revealItems.forEach((item) => revealObserver.observe(item));
}
