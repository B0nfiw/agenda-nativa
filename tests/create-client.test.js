import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { validateConfig } from "../frontend/js/validation.js";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const clientsDir = path.join(root, "clientes");

async function cleanup() {
  await rm(clientsDir, { recursive: true, force: true });
}

async function runCreate(args) {
  try {
    const result = await execFileAsync(process.execPath, ["create-client.js", ...args], {
      cwd: root,
      windowsHide: true
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      code: error.code
    };
  }
}

async function readClientConfig(slug) {
  const configPath = path.join(clientsDir, slug, "config.json");
  return JSON.parse(await readFile(configPath, "utf8"));
}

await cleanup();

try {
  {
    const result = await runCreate(["--name", "Studio Aurora Teste", "--whatsapp", "12025550101"]);
    assert.equal(result.ok, true, result.stderr);
    assert.equal(existsSync(path.join(clientsDir, "studio-aurora-teste")), true);
    const config = validateConfig(await readClientConfig("studio-aurora-teste"));
    assert.equal(config.booking.mode, "whatsapp");
  }

  {
    const result = await runCreate(["--name", "Salão Águas Claras", "--whatsapp", "12025550101"]);
    assert.equal(result.ok, true, result.stderr);
    assert.equal(existsSync(path.join(clientsDir, "salao-aguas-claras")), true);
    validateConfig(await readClientConfig("salao-aguas-claras"));
  }

  {
    const result = await runCreate(["--name", "Cliente com Espaço", "--whatsapp", "12025550101"]);
    assert.equal(result.ok, true, result.stderr);
    assert.equal(existsSync(path.join(clientsDir, "cliente-com-espaco")), true);
  }

  {
    const result = await runCreate(["--name", "../Cliente ### Seguro", "--whatsapp", "12025550101"]);
    assert.equal(result.ok, true, result.stderr);
    assert.equal(existsSync(path.join(clientsDir, "cliente-seguro")), true);
  }

  {
    const result = await runCreate(["--name", "Studio Aurora Teste", "--whatsapp", "12025550101"]);
    assert.equal(result.ok, false);
    assert.match(result.stderr, /já existe|existe/i);
  }

  {
    const result = await runCreate(["--name", "", "--whatsapp", "12025550101"]);
    assert.equal(result.ok, false);
    assert.match(result.stderr, /nome/i);
  }

  {
    const result = await runCreate(["--name", "../", "--whatsapp", "12025550101"]);
    assert.equal(result.ok, false);
    assert.match(result.stderr, /slug|seguro/i);
  }

  {
    const result = await runCreate(["--name", "WhatsApp Inválido", "--whatsapp", "abc"]);
    assert.equal(result.ok, false);
    assert.match(result.stderr, /WhatsApp/i);
  }

  console.log("Create-client: testes concluídos com sucesso.");
} finally {
  await cleanup();
}
