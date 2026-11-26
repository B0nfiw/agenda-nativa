import { ConfigValidationError, validateConfig } from "./validation.js";

const MAX_CONFIG_BYTES = 150 * 1024;

export async function loadSalonConfig(configUrl = "./config.json") {
  let response;

  try {
    response = await fetch(configUrl, { cache: "no-store" });
  } catch (error) {
    throw new Error("Não foi possível carregar a configuração do salão.", { cause: error });
  }

  if (!response.ok) {
    throw new Error("Não foi possível carregar a configuração do salão.");
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_CONFIG_BYTES) {
    throw new Error("O arquivo de configuração é maior que o permitido.");
  }

  let rawText;
  try {
    rawText = await response.text();
  } catch (error) {
    throw new Error("Não foi possível ler o arquivo de configuração.", { cause: error });
  }

  if (new TextEncoder().encode(rawText).length > MAX_CONFIG_BYTES) {
    throw new Error("O arquivo de configuração é maior que o permitido.");
  }

  let rawConfig;
  try {
    rawConfig = JSON.parse(rawText);
  } catch (error) {
    throw new Error("O arquivo de configuração não é um JSON válido.", { cause: error });
  }

  try {
    return validateConfig(rawConfig);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }
    throw new Error("A configuração do salão não pôde ser validada.", { cause: error });
  }
}
