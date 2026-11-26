import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWhatsappMessage, buildWhatsappUrl, validateBookingData } from "../frontend/js/booking.js";
import { ConfigValidationError, validateConfig } from "../frontend/js/validation.js";

const rawConfig = JSON.parse(await readFile(new URL("../frontend/config.json", import.meta.url), "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mustFail(config, expectedMessage) {
  assert.throws(
    () => validateConfig(config),
    (error) => {
      assert.ok(error instanceof ConfigValidationError);
      assert.ok(error.errors.some((item) => item.includes(expectedMessage)), error.errors.join("\n"));
      return true;
    }
  );
}

const validConfig = validateConfig(rawConfig);
assert.equal(validConfig.salon.name, "Studio Aurora");
assert.equal(validConfig.booking.mode, "preview");
assert.equal(validConfig.salon.whatsapp, "");
assert.equal(validConfig.salon.instagram, "");
assert.equal(validConfig.salon.mapsUrl, "");
assert.ok(validConfig.services.length >= 4);

assert.throws(() => JSON.parse("{"), SyntaxError);

{
  const config = clone(rawConfig);
  delete config.salon.name;
  mustFail(config, "salon.name");
}

{
  const config = clone(rawConfig);
  config.booking.mode = "whatsapp";
  config.salon.whatsapp = "abc";
  mustFail(config, "salon.whatsapp");
}

{
  const config = clone(rawConfig);
  config.salon.instagram = "http://instagram.com/inseguro";
  mustFail(config, "salon.instagram");
}

{
  const config = clone(rawConfig);
  config.theme.primary = "rosa";
  mustFail(config, "theme.primary");
}

{
  const config = clone(rawConfig);
  config.assets.hero = "javascript:alert(1)";
  mustFail(config, "assets.hero");
}

{
  const config = clone(rawConfig);
  config.assets.hero = "/assets/capa.svg";
  mustFail(config, "assets.hero");
}

{
  const config = clone(rawConfig);
  config.services = Array.from({ length: 25 }, (_, index) => ({
    id: `servico-${index}`,
    name: `Servico ${index}`,
    description: "Descricao",
    price: "Sob consulta",
    enabled: true
  }));
  mustFail(config, "services");
}

{
  const config = clone(rawConfig);
  config.services[0].enabled = "sim";
  mustFail(config, "services[0].enabled");
}

{
  const config = clone(rawConfig);
  config.booking.allowDateSelection = "true";
  mustFail(config, "booking.allowDateSelection");
}

{
  const config = clone(rawConfig);
  config.services[0].enabled = false;
  const normalized = validateConfig(config);
  assert.equal(normalized.services[0].enabled, false);
  assert.ok(normalized.services.some((service) => service.enabled));
}

{
  const config = clone(rawConfig);
  config.professionals[0].enabled = false;
  const normalized = validateConfig(config);
  assert.equal(normalized.professionals[0].enabled, false);
}

{
  const config = clone(rawConfig);
  config.professionals = [];
  const normalized = validateConfig(config);
  assert.deepEqual(normalized.professionals, []);
}

{
  const result = validateBookingData({
    name: "",
    service: "",
    professional: "",
    date: "",
    time: "",
    notes: "",
    company: ""
  }, validConfig, new Date("2026-07-10T10:00:00"));

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("nome")));
}

{
  const result = validateBookingData({
    name: "Cliente Teste",
    service: validConfig.services[0].id,
    professional: validConfig.professionals[0].id,
    date: "2026-07-09",
    time: "14:30",
    notes: "",
    company: ""
  }, validConfig, new Date("2026-07-10T10:00:00"));

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("hoje")));
}

{
  const result = validateBookingData({
    name: "Cliente Teste",
    service: validConfig.services[0].id,
    professional: validConfig.professionals[0].id,
    date: "2026-07-15",
    time: "99:99",
    notes: "",
    company: ""
  }, validConfig, new Date("2026-07-10T10:00:00"));

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("horário")));
}

{
  const result = validateBookingData({
    name: "Cliente Teste",
    service: validConfig.services[0].id,
    professional: validConfig.professionals[0].id,
    date: "2026-07-15",
    time: "14:30",
    notes: "",
    company: "spam"
  }, validConfig, new Date("2026-07-10T10:00:00"));

  assert.equal(result.ok, false);
  assert.equal(result.silent, true);
}

{
  const result = validateBookingData({
    name: "Cliente Teste",
    service: validConfig.services[0].id,
    professional: validConfig.professionals[0].id,
    date: "2026-07-15",
    time: "14:30",
    notes: "Tenho preferência pelo período da tarde.",
    company: ""
  }, validConfig, new Date("2026-07-10T10:00:00"));

  assert.equal(result.ok, true);
  const message = buildWhatsappMessage(result, validConfig);
  assert.match(message, /solicitar/i);
  assert.match(message, /Data desejada: 15\/07\/2026/);
  assert.match(message, /Profissional: Ana/);
  const realFlow = validateConfig({
    ...rawConfig,
    salon: { ...rawConfig.salon, whatsapp: "12025550101" },
    booking: { ...rawConfig.booking, mode: "whatsapp" }
  });
  const url = new URL(buildWhatsappUrl(result, realFlow));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/12025550101");
  assert.equal(url.searchParams.get("text"), message);
}

console.log("MVP 1.1: testes automatizados concluídos com sucesso.");
