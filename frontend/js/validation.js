export class ConfigValidationError extends Error {
  constructor(errors) {
    super("Configuração inválida.");
    this.name = "ConfigValidationError";
    this.errors = errors;
  }
}

export const DEFAULT_THEME = Object.freeze({
  background: "#171016",
  surface: "#21151F",
  primary: "#A84C6A",
  secondary: "#3A1728",
  accent: "#A8B9A3",
  text: "#FFF9F2",
  mutedText: "#D3C7C0"
});

const SAFE_TEXT_PATTERN = /^[^<>{}\u0000-\u001F\u007F]*$/;
const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_URL_LENGTH = 500;
const MAX_COUNTS = Object.freeze({
  businessHours: 14,
  services: 24,
  professionals: 24,
  gallery: 16,
  testimonials: 12,
  faq: 20
});

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeText(value, max = 240) {
  return String(value ?? "")
    .replace(/[<>{}\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function isSafeText(value) {
  return typeof value === "string" && SAFE_TEXT_PATTERN.test(value);
}

export function isValidHexColor(value) {
  return typeof value === "string" && HEX_PATTERN.test(value.trim());
}

export function normalizeWhatsapp(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidWhatsapp(value) {
  const normalized = normalizeWhatsapp(value);
  return normalized.length >= 10 && normalized.length <= 15;
}

export function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isPastDate(value, now = new Date()) {
  if (!isValidDateString(value)) return true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selected = new Date(`${value}T00:00:00`);
  return selected < today;
}

export function isValidTimeString(value) {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function isSafeHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_URL_LENGTH) return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafeAssetUrl(value) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;
  if (/[<>"'`(){}\\;\s\u0000-\u001F\u007F]/.test(trimmed)) return false;

  if (trimmed.startsWith("./")) {
    return !trimmed.includes("..");
  }

  return isSafeHttpsUrl(trimmed);
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function readText(source, key, path, errors, options = {}) {
  const { required = false, max = 240, fallback = "" } = options;
  const value = source?.[key];

  if (value == null || value === "") {
    if (required) addError(errors, path, "campo obrigatório.");
    return fallback;
  }

  if (typeof value !== "string") {
    addError(errors, path, "deve ser texto.");
    return fallback;
  }

  if (!isSafeText(value)) {
    addError(errors, path, "contém caracteres não permitidos.");
  }

  if (value.length > max) {
    addError(errors, path, `deve ter no máximo ${max} caracteres.`);
  }

  return sanitizeText(value, max);
}

function readBoolean(source, key, fallback = false) {
  return typeof source?.[key] === "boolean" ? source[key] : fallback;
}

function readBooleanStrict(source, key, path, errors, fallback = false) {
  if (source?.[key] == null) return fallback;
  if (typeof source[key] !== "boolean") {
    addError(errors, path, "deve ser booleano.");
    return fallback;
  }
  return source[key];
}

function readEnabled(source, path, errors) {
  return readBooleanStrict(source, "enabled", `${path}.enabled`, errors, true);
}

function enforceArrayLimit(items, path, max, errors) {
  if (items.length > max) {
    addError(errors, path, `deve conter no máximo ${max} itens.`);
  }
}

function normalizeTheme(theme, errors) {
  if (!isPlainObject(theme)) {
    addError(errors, "theme", "deve ser um objeto.");
    return { ...DEFAULT_THEME };
  }

  return Object.fromEntries(
    Object.entries(DEFAULT_THEME).map(([key, fallback]) => {
      const value = theme[key];
      if (value == null || value === "") return [key, fallback];
      if (!isValidHexColor(value)) {
        addError(errors, `theme.${key}`, "deve ser uma cor hexadecimal válida.");
        return [key, fallback];
      }
      return [key, value.trim()];
    })
  );
}

function normalizeBusinessHours(hours, errors) {
  if (hours == null) return [];
  if (!Array.isArray(hours)) {
    addError(errors, "salon.businessHours", "deve ser uma lista.");
    return [];
  }
  enforceArrayLimit(hours, "salon.businessHours", MAX_COUNTS.businessHours, errors);

  return hours.map((item, index) => {
    const path = `salon.businessHours[${index}]`;
    if (!isPlainObject(item)) {
      addError(errors, path, "deve ser um objeto.");
      return null;
    }

    return {
      days: readText(item, "days", `${path}.days`, errors, { required: true, max: 80 }),
      hours: readText(item, "hours", `${path}.hours`, errors, { required: true, max: 80 })
    };
  }).filter(Boolean);
}

function normalizeAssets(assets, errors) {
  if (!isPlainObject(assets)) {
    addError(errors, "assets", "deve ser um objeto.");
    return { logo: "", hero: "", gallery: [] };
  }

  const logo = assets.logo ? String(assets.logo).trim() : "";
  const hero = assets.hero ? String(assets.hero).trim() : "";

  if (logo && !isSafeAssetUrl(logo)) addError(errors, "assets.logo", "deve ser uma URL HTTPS ou caminho relativo seguro.");
  if (hero && !isSafeAssetUrl(hero)) addError(errors, "assets.hero", "deve ser uma URL HTTPS ou caminho relativo seguro.");

  if (assets.gallery != null && !Array.isArray(assets.gallery)) {
    addError(errors, "assets.gallery", "deve ser uma lista.");
  }
  if (Array.isArray(assets.gallery)) {
    enforceArrayLimit(assets.gallery, "assets.gallery", MAX_COUNTS.gallery, errors);
  }

  const gallery = Array.isArray(assets.gallery)
    ? assets.gallery.map((item, index) => {
      const value = String(item ?? "").trim();
      if (!isSafeAssetUrl(value)) {
        addError(errors, `assets.gallery[${index}]`, "deve ser uma URL HTTPS ou caminho relativo seguro.");
        return null;
      }
      return value;
    }).filter(Boolean)
    : [];

  return { logo, hero, gallery };
}

function normalizeServices(services, errors) {
  if (!Array.isArray(services)) {
    addError(errors, "services", "deve ser uma lista.");
    return [];
  }

  if (services.length === 0) {
    addError(errors, "services", "deve conter ao menos um serviço.");
  }
  enforceArrayLimit(services, "services", MAX_COUNTS.services, errors);

  return services.map((service, index) => {
    const path = `services[${index}]`;
    if (!isPlainObject(service)) {
      addError(errors, path, "deve ser um objeto.");
      return null;
    }

    const name = readText(service, "name", `${path}.name`, errors, { required: true, max: 80 });
    const id = readText(service, "id", `${path}.id`, errors, {
      max: 80,
      fallback: slugify(name || `servico-${index + 1}`)
    }) || slugify(name || `servico-${index + 1}`);

    const duration = service.durationMinutes;
    if (duration != null && (!Number.isInteger(duration) || duration < 5 || duration > 720)) {
      addError(errors, `${path}.durationMinutes`, "deve ser um número inteiro entre 5 e 720.");
    }

    return {
      id: slugify(id),
      name,
      description: readText(service, "description", `${path}.description`, errors, { max: 220 }),
      price: readText(service, "price", `${path}.price`, errors, { max: 80 }),
      durationMinutes: Number.isInteger(duration) ? duration : null,
      enabled: readEnabled(service, path, errors)
    };
  }).filter(Boolean);
}

function normalizeProfessionals(professionals, errors) {
  if (professionals == null) return [];
  if (!Array.isArray(professionals)) {
    addError(errors, "professionals", "deve ser uma lista.");
    return [];
  }
  enforceArrayLimit(professionals, "professionals", MAX_COUNTS.professionals, errors);

  return professionals.map((professional, index) => {
    const path = `professionals[${index}]`;
    if (!isPlainObject(professional)) {
      addError(errors, path, "deve ser um objeto.");
      return null;
    }

    const name = readText(professional, "name", `${path}.name`, errors, { required: true, max: 80 });
    const id = readText(professional, "id", `${path}.id`, errors, {
      max: 80,
      fallback: slugify(name || `profissional-${index + 1}`)
    }) || slugify(name || `profissional-${index + 1}`);
    const photo = professional.photo ? String(professional.photo).trim() : "";

    if (photo && !isSafeAssetUrl(photo)) {
      addError(errors, `${path}.photo`, "deve ser uma URL HTTPS ou caminho relativo seguro.");
    }

    return {
      id: slugify(id),
      name,
      role: readText(professional, "role", `${path}.role`, errors, { max: 80 }),
      photo,
      enabled: readEnabled(professional, path, errors)
    };
  }).filter(Boolean);
}

function normalizeTestimonials(testimonials, errors) {
  if (testimonials == null) return [];
  if (!Array.isArray(testimonials)) {
    addError(errors, "testimonials", "deve ser uma lista.");
    return [];
  }
  enforceArrayLimit(testimonials, "testimonials", MAX_COUNTS.testimonials, errors);

  return testimonials.map((testimonial, index) => {
    const path = `testimonials[${index}]`;
    if (!isPlainObject(testimonial)) {
      addError(errors, path, "deve ser um objeto.");
      return null;
    }

    return {
      name: readText(testimonial, "name", `${path}.name`, errors, { required: true, max: 80 }),
      text: readText(testimonial, "text", `${path}.text`, errors, { required: true, max: 240 }),
      enabled: readEnabled(testimonial, path, errors)
    };
  }).filter(Boolean);
}

function normalizeFaq(faq, errors) {
  if (faq == null) return [];
  if (!Array.isArray(faq)) {
    addError(errors, "faq", "deve ser uma lista.");
    return [];
  }
  enforceArrayLimit(faq, "faq", MAX_COUNTS.faq, errors);

  return faq.map((item, index) => {
    const path = `faq[${index}]`;
    if (!isPlainObject(item)) {
      addError(errors, path, "deve ser um objeto.");
      return null;
    }

    return {
      question: readText(item, "question", `${path}.question`, errors, { required: true, max: 140 }),
      answer: readText(item, "answer", `${path}.answer`, errors, { required: true, max: 420 }),
      enabled: readEnabled(item, path, errors)
    };
  }).filter(Boolean);
}

function normalizeBooking(booking, errors) {
  if (!isPlainObject(booking)) {
    addError(errors, "booking", "deve ser um objeto.");
    return {
      mode: "whatsapp",
      allowProfessionalSelection: true,
      allowDateSelection: true,
      allowTimeSelection: true,
      messageTemplate: "Olá! Gostaria de solicitar um agendamento."
    };
  }

  const mode = booking.mode || "whatsapp";
  if (mode !== "preview" && mode !== "whatsapp") {
    addError(errors, "booking.mode", "deve ser preview ou whatsapp.");
  }

  const messageTemplate = readText(booking, "messageTemplate", "booking.messageTemplate", errors, {
    max: 160,
    fallback: "Olá! Gostaria de solicitar um agendamento."
  });

  if (!/solicitar/i.test(messageTemplate)) {
    addError(errors, "booking.messageTemplate", "deve usar a palavra solicitar.");
  }

  return {
    mode,
    allowProfessionalSelection: readBooleanStrict(booking, "allowProfessionalSelection", "booking.allowProfessionalSelection", errors, true),
    allowDateSelection: readBooleanStrict(booking, "allowDateSelection", "booking.allowDateSelection", errors, true),
    allowTimeSelection: readBooleanStrict(booking, "allowTimeSelection", "booking.allowTimeSelection", errors, true),
    messageTemplate
  };
}

export function validateConfig(input) {
  const errors = [];

  if (!isPlainObject(input)) {
    throw new ConfigValidationError(["config: deve ser um objeto JSON."]);
  }

  const salon = input.salon;
  if (!isPlainObject(salon)) addError(errors, "salon", "deve ser um objeto.");

  const booking = normalizeBooking(input.booking, errors);
  const normalizedWhatsapp = normalizeWhatsapp(salon?.whatsapp);
  if (booking.mode === "whatsapp" && !isValidWhatsapp(normalizedWhatsapp)) {
    addError(errors, "salon.whatsapp", "deve conter de 10 a 15 números.");
  }

  const instagram = salon?.instagram ? String(salon.instagram).trim() : "";
  const mapsUrl = salon?.mapsUrl ? String(salon.mapsUrl).trim() : "";

  if (instagram && !isSafeHttpsUrl(instagram)) {
    addError(errors, "salon.instagram", "deve ser uma URL HTTPS.");
  }

  if (mapsUrl && !isSafeHttpsUrl(mapsUrl)) {
    addError(errors, "salon.mapsUrl", "deve ser uma URL HTTPS.");
  }

  const services = normalizeServices(input.services, errors);
  const professionals = normalizeProfessionals(input.professionals, errors);

  const serviceIds = services.map((service) => service.id).filter(Boolean);
  if (new Set(serviceIds).size !== serviceIds.length) {
    addError(errors, "services", "não deve conter IDs duplicados.");
  }

  const professionalIds = professionals.map((professional) => professional.id).filter(Boolean);
  if (new Set(professionalIds).size !== professionalIds.length) {
    addError(errors, "professionals", "não deve conter IDs duplicados.");
  }

  if (!services.some((service) => service.enabled)) {
    addError(errors, "services", "deve haver ao menos um serviço ativo.");
  }

  const config = {
    salon: {
      name: readText(salon, "name", "salon.name", errors, { required: true, max: 80 }),
      shortName: readText(salon, "shortName", "salon.shortName", errors, { max: 40 }),
      tagline: readText(salon, "tagline", "salon.tagline", errors, { max: 120 }),
      description: readText(salon, "description", "salon.description", errors, { max: 360 }),
      aboutTitle: readText(salon, "aboutTitle", "salon.aboutTitle", errors, { max: 140 }),
      aboutText: readText(salon, "aboutText", "salon.aboutText", errors, { max: 520 }),
      whatsapp: normalizedWhatsapp,
      instagram,
      address: readText(salon, "address", "salon.address", errors, { required: true, max: 180 }),
      mapsUrl,
      businessHours: normalizeBusinessHours(salon?.businessHours, errors)
    },
    theme: normalizeTheme(input.theme, errors),
    assets: normalizeAssets(input.assets, errors),
    services,
    professionals,
    testimonials: normalizeTestimonials(input.testimonials, errors),
    faq: normalizeFaq(input.faq, errors),
    booking
  };

  if (!config.salon.shortName) config.salon.shortName = config.salon.name;
  if (!config.salon.tagline) config.salon.tagline = "Solicitação de agendamento pelo WhatsApp";
  if (!config.salon.description) {
    config.salon.description = "Escolha o serviço, informe o melhor horário e envie tudo organizado pelo WhatsApp.";
  }
  if (!config.salon.aboutTitle) config.salon.aboutTitle = `Beleza com atendimento próximo em ${config.salon.shortName}.`;
  if (!config.salon.aboutText) config.salon.aboutText = config.salon.description;

  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }

  return config;
}
