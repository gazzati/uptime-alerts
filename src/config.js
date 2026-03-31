import fs from "node:fs/promises";
import path from "node:path";

const SUPPORTED_TYPES = new Set(["website", "server"]);

export function getEnvConfig() {
  const checkIntervalMs = toPositiveNumber(process.env.CHECK_INTERVAL_MS, 60_000);
  const requestTimeoutMs = toPositiveNumber(process.env.REQUEST_TIMEOUT_MS, 10_000);
  const certificateWarningDays = toPositiveNumber(process.env.CERTIFICATE_WARNING_DAYS, 10);
  const serviceFailureThreshold = toPositiveNumber(process.env.SERVICE_FAILURE_THRESHOLD, 2);
  const serviceRecoveryThreshold = toPositiveNumber(process.env.SERVICE_RECOVERY_THRESHOLD, 2);
  const servicesConfigPath = path.resolve(
    process.cwd(),
    process.env.SERVICES_CONFIG_PATH || "./services.json",
  );

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  if (!telegramChatId) {
    throw new Error("TELEGRAM_CHAT_ID is required");
  }

  return {
    telegramBotToken,
    telegramChatId,
    servicesConfigPath,
    checkIntervalMs,
    requestTimeoutMs,
    certificateWarningDays,
    serviceFailureThreshold,
    serviceRecoveryThreshold,
  };
}

export async function loadServices(configPath) {
  const raw = await fs.readFile(configPath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!parsed || !Array.isArray(parsed.services) || parsed.services.length === 0) {
    throw new Error("services.json must contain a non-empty services array");
  }

  return parsed.services.map(validateService);
}

function validateService(service, index) {
  if (!service || typeof service !== "object") {
    throw new Error(`Service at index ${index} must be an object`);
  }

  const { name, type, url } = service;

  if (!name || typeof name !== "string") {
    throw new Error(`Service at index ${index} must have a string name`);
  }

  if (!SUPPORTED_TYPES.has(type)) {
    throw new Error(`Service "${name}" has unsupported type "${type}"`);
  }

  if (!url || typeof url !== "string") {
    throw new Error(`Service "${name}" must have a string url`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Service "${name}" has invalid url "${url}"`);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(`Service "${name}" must use http or https`);
  }

  return {
    name,
    type,
    url,
  };
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
