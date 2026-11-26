import {
  isPastDate,
  isSafeText,
  isValidDateString,
  isValidTimeString,
  sanitizeText
} from "./validation.js";

function activeItems(items) {
  return items.filter((item) => item.enabled !== false);
}

function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateBr(value) {
  if (!isValidDateString(value)) return value;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function option(value, text) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = text;
  return item;
}

function getBookingCollections(config) {
  const services = activeItems(config.services);
  const professionals = activeItems(config.professionals);
  const professionalSelectionEnabled = config.booking.allowProfessionalSelection && professionals.length > 0;

  return { services, professionals, professionalSelectionEnabled };
}

function readFormValue(data, key, max = 240) {
  return sanitizeText(data.get ? data.get(key) : data[key], max);
}

export function validateBookingData(data, config, now = new Date()) {
  const { services, professionals, professionalSelectionEnabled } = getBookingCollections(config);
  const values = {
    name: readFormValue(data, "name", 80),
    service: readFormValue(data, "service", 80),
    professional: readFormValue(data, "professional", 80),
    date: readFormValue(data, "date", 20),
    time: readFormValue(data, "time", 20),
    notes: readFormValue(data, "notes", 240),
    company: readFormValue(data, "company", 80)
  };

  if (values.company) {
    return { ok: false, silent: true, errors: [], values };
  }

  const errors = [];

  if (!values.name || values.name.length < 2) {
    errors.push("Informe seu nome.");
  }

  if (values.name && !isSafeText(values.name)) {
    errors.push("O nome contém caracteres não permitidos.");
  }

  const selectedService = services.find((service) => service.id === values.service);
  if (!selectedService) {
    errors.push("Selecione um serviço válido.");
  }

  let selectedProfessional = null;
  if (professionalSelectionEnabled) {
    selectedProfessional = professionals.find((professional) => professional.id === values.professional);
    if (!selectedProfessional) {
      errors.push("Selecione um profissional válido.");
    }
  }

  if (config.booking.allowDateSelection !== false) {
    if (!values.date || !isValidDateString(values.date)) {
      errors.push("Informe uma data válida.");
    } else if (isPastDate(values.date, now)) {
      errors.push("Escolha uma data de hoje em diante.");
    }
  }

  if (config.booking.allowTimeSelection !== false) {
    if (!values.time || !isValidTimeString(values.time)) {
      errors.push("Informe um horário válido.");
    }
  }

  if (values.notes && !isSafeText(values.notes)) {
    errors.push("A observação contém caracteres não permitidos.");
  }

  return {
    ok: errors.length === 0,
    silent: false,
    errors,
    values,
    selectedService,
    selectedProfessional
  };
}

export function buildWhatsappMessage(booking, config) {
  const lines = [
    config.booking.messageTemplate,
    "",
    `Nome: ${booking.values.name}`,
    `Serviço: ${booking.selectedService.name}`
  ];

  if (booking.selectedProfessional) {
    lines.push(`Profissional: ${booking.selectedProfessional.name}`);
  }

  if (config.booking.allowDateSelection !== false) {
    lines.push(`Data desejada: ${formatDateBr(booking.values.date)}`);
  }

  if (config.booking.allowTimeSelection !== false) {
    lines.push(`Horário desejado: ${booking.values.time}`);
  }

  if (booking.values.notes) {
    lines.push(`Observação: ${booking.values.notes}`);
  }

  return lines.join("\n");
}

export function buildWhatsappUrl(booking, config) {
  const message = buildWhatsappMessage(booking, config);
  return `https://wa.me/${config.salon.whatsapp}?text=${encodeURIComponent(message)}`;
}

function setFormError(form, errors) {
  const errorBox = form.querySelector("[data-form-error]");
  form.querySelectorAll(".is-invalid").forEach((field) => field.classList.remove("is-invalid"));

  if (!errorBox) return;

  if (errors.length === 0) {
    errorBox.hidden = true;
    errorBox.textContent = "";
    return;
  }

  errorBox.textContent = errors[0];
  errorBox.hidden = false;
}

function populateSelect(select, items, placeholder) {
  if (!select) return;

  while (select.firstChild) select.removeChild(select.firstChild);
  select.appendChild(option("", placeholder));

  items.forEach((item) => {
    select.appendChild(option(item.id, item.name));
  });
}

export function initBookingForm(config) {
  const form = document.getElementById("bookingForm");
  if (!form) return;

  const { services, professionals, professionalSelectionEnabled } = getBookingCollections(config);
  const serviceSelect = form.querySelector("[data-service-select]");
  const professionalField = form.querySelector("[data-professional-field]");
  const professionalSelect = form.querySelector("[data-professional-select]");
  const dateField = form.querySelector("[data-date-field]");
  const timeField = form.querySelector("[data-time-field]");
  const isPreview = config.booking.mode === "preview";
  const preview = form.querySelector("[data-booking-preview]");
  if (isPreview) {
    form.querySelector('button[type="submit"]').textContent = "Visualizar solicitação";
    document.querySelector("[data-booking-intro]").textContent =
      "Use dados fictícios para testar. A mensagem aparece aqui e nenhum dado é enviado.";
  }
  const dateInput = form.querySelector('input[name="date"]');
  const timeInput = form.querySelector('input[name="time"]');

  populateSelect(serviceSelect, services, "Selecione");
  populateSelect(professionalSelect, professionals, "Selecione");

  if (professionalField && professionalSelect) {
    professionalField.hidden = !professionalSelectionEnabled;
    professionalSelect.required = professionalSelectionEnabled;
  }

  if (dateField && dateInput) {
    const enabled = config.booking.allowDateSelection !== false;
    dateField.hidden = !enabled;
    dateInput.required = enabled;
    dateInput.min = todayIso();
  }

  if (timeField && timeInput) {
    const enabled = config.booking.allowTimeSelection !== false;
    timeField.hidden = !enabled;
    timeInput.required = enabled;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (isPreview) {
      preview.hidden = true;
      preview.textContent = "";
    }
    const data = new FormData(form);
    const validation = validateBookingData(data, config);

    if (validation.silent) return;

    if (!validation.ok) {
      setFormError(form, validation.errors);
      return;
    }

    setFormError(form, []);
    if (isPreview) {
      preview.textContent = buildWhatsappMessage(validation, config);
      preview.hidden = false;
      return;
    }
    const url = buildWhatsappUrl(validation, config);
    window.open(url, "_blank", "noopener,noreferrer");
  });
}
