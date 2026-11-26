import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { argv, stdin as input, stdout as output } from "node:process";
import { validateConfig } from "./frontend/js/validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.join(__dirname, "frontend");
const CLIENTS_DIR = path.join(__dirname, "clientes");
const CONFIG_EXAMPLE = path.join(TEMPLATE_DIR, "config.example.json");

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith("--")) continue;

    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    const key = rawKey.trim();
    const value = inlineValue ?? args[index + 1];

    if (!key) continue;
    if (inlineValue == null) index += 1;
    options[key] = String(value ?? "").trim();
  }

  return options;
}

const CLI_OPTIONS = parseArgs(argv.slice(2));
const HAS_CLI_OPTIONS = Object.keys(CLI_OPTIONS).length > 0;
const PIPED_ANSWERS = input.isTTY || HAS_CLI_OPTIONS ? [] : readFileSync(0, "utf8").split(/\r?\n/);

const DEFAULT_THEME = {
  background: "#171016",
  surface: "#21151F",
  primary: "#A84C6A",
  secondary: "#3A1728",
  accent: "#A8B9A3",
  text: "#FFF9F2",
  mutedText: "#D3C7C0"
};

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeWhatsapp(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidWhatsapp(value) {
  const normalized = normalizeWhatsapp(value);
  return normalized.length >= 10 && normalized.length <= 15;
}

function normalizeInstagram(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("@")) return `https://instagram.com/${trimmed.slice(1)}`;
  if (/^[a-zA-Z0-9._]+$/.test(trimmed)) return `https://instagram.com/${trimmed}`;
  return trimmed;
}

function isHttpsOrEmpty(value) {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function colorOrDefault(value, fallback) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
}

async function ask(rl, question, fallback = "") {
  const suffix = fallback ? ` (${fallback})` : "";
  if (PIPED_ANSWERS.length > 0) {
    const answer = PIPED_ANSWERS.shift()?.trim() || fallback;
    console.log(`${question}${suffix}: ${answer}`);
    return answer;
  }
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || fallback;
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Caminho de cliente inválido.");
  }
}

function shouldCopyTemplateItem(source) {
  const name = path.basename(source).toLowerCase();
  const blockedNames = new Set([
    ".env",
    ".ds_store",
    "thumbs.db",
    "node_modules",
    "release",
    "clientes",
    "coverage"
  ]);

  if (blockedNames.has(name) || name.startsWith(".env.")) return false;
  if (name.endsWith(".log") || name.endsWith(".tmp") || name.endsWith(".zip")) return false;
  return true;
}

async function main() {
  const nonInteractive = HAS_CLI_OPTIONS;
  const rl = nonInteractive ? null : readline.createInterface({ input, output });

  try {
    const salonName = nonInteractive
      ? String(CLI_OPTIONS.name || "").trim()
      : await ask(rl, "Nome do salão", "Studio Aurora");

    if (!salonName) {
      throw new Error("Informe o nome do salão.");
    }

    const slug = slugify(salonName);

    if (!slug) {
      throw new Error("Não foi possível gerar um slug seguro para o salão.");
    }

    const clientsRoot = path.resolve(CLIENTS_DIR);
    const targetDir = path.resolve(clientsRoot, slug);
    assertInside(clientsRoot, targetDir);

    if (existsSync(targetDir)) {
      throw new Error(`A pasta clientes/${slug} já existe. Nada foi sobrescrito.`);
    }

    const rawWhatsapp = nonInteractive
      ? String(CLI_OPTIONS.whatsapp || "").trim()
      : await ask(rl, "WhatsApp com DDI e DDD");
    const whatsapp = normalizeWhatsapp(rawWhatsapp);

    if (!isValidWhatsapp(whatsapp)) {
      throw new Error("Informe um WhatsApp válido com DDI e DDD.");
    }

    const instagram = normalizeInstagram(nonInteractive
      ? String(CLI_OPTIONS.instagram || "").trim()
      : await ask(rl, "Instagram (@perfil ou URL HTTPS)", ""));

    if (!isHttpsOrEmpty(instagram)) {
      throw new Error("Instagram deve ser uma URL HTTPS, @perfil ou ficar vazio.");
    }

    const address = nonInteractive
      ? String(CLI_OPTIONS.address || "Rua Exemplo, 123 - Centro, Osasco/SP").trim()
      : await ask(rl, "Endereço", "Rua Exemplo, 123 - Centro, Osasco/SP");
    const primary = colorOrDefault(nonInteractive ? CLI_OPTIONS.primary : await ask(rl, "Cor principal em hexadecimal", DEFAULT_THEME.primary), DEFAULT_THEME.primary);
    const background = colorOrDefault(nonInteractive ? CLI_OPTIONS.background : await ask(rl, "Cor de fundo em hexadecimal", DEFAULT_THEME.background), DEFAULT_THEME.background);
    const accent = colorOrDefault(nonInteractive ? CLI_OPTIONS.accent : await ask(rl, "Cor de destaque em hexadecimal", DEFAULT_THEME.accent), DEFAULT_THEME.accent);

    const baseConfig = JSON.parse(await readFile(CONFIG_EXAMPLE, "utf8"));
    baseConfig.salon.name = salonName;
    baseConfig.salon.shortName = salonName.split(/\s+/).slice(0, 2).join(" ");
    baseConfig.salon.tagline = `Beleza e cuidado em ${address.split("-").pop()?.trim() || "sua região"}`;
    baseConfig.salon.description = "Atendimento personalizado para quem valoriza cuidado, conforto e resultado. Escolha o serviço, informe o melhor horário e envie sua solicitação pelo WhatsApp.";
    baseConfig.salon.aboutTitle = `Beleza com atendimento próximo no ${baseConfig.salon.shortName}.`;
    baseConfig.salon.aboutText = "Atualize este texto com o estilo do salão, diferenciais do atendimento e principais serviços.";
    baseConfig.salon.whatsapp = whatsapp;
    baseConfig.booking.mode = "whatsapp";
    baseConfig.salon.instagram = instagram;
    baseConfig.salon.address = address;
    baseConfig.salon.mapsUrl = "https://maps.google.com/";
    baseConfig.theme.background = background;
    baseConfig.theme.surface = DEFAULT_THEME.surface;
    baseConfig.theme.primary = primary;
    baseConfig.theme.secondary = DEFAULT_THEME.secondary;
    baseConfig.theme.accent = accent;
    baseConfig.theme.text = DEFAULT_THEME.text;
    baseConfig.theme.mutedText = DEFAULT_THEME.mutedText;

    validateConfig(baseConfig);

    await mkdir(clientsRoot, { recursive: true });
    await cp(TEMPLATE_DIR, targetDir, {
      recursive: true,
      force: false,
      errorOnExist: true,
      filter: shouldCopyTemplateItem
    });

    await mkdir(path.join(targetDir, "assets", "galeria"), { recursive: true });
    await mkdir(path.join(targetDir, "assets", "equipe"), { recursive: true });
    await writeFile(path.join(targetDir, "config.json"), `${JSON.stringify(baseConfig, null, 2)}\n`, "utf8");

    console.log(`Cliente criado em clientes/${slug}`);
    console.log("Edite config.json e substitua as imagens em assets/ quando tiver os dados reais.");
  } finally {
    rl?.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
