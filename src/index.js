import "dotenv/config";

import { getEnvConfig, loadServices } from "./config.js";
import { Monitor } from "./monitor.js";
import { TelegramNotifier } from "./notifier.js";

async function main() {
  const env = getEnvConfig();
  const services = await loadServices(env.servicesConfigPath);
  const notifier = new TelegramNotifier({
    botToken: env.telegramBotToken,
    chatId: env.telegramChatId,
  });

  const monitor = new Monitor({
    services,
    notifier,
    requestTimeoutMs: env.requestTimeoutMs,
    certificateWarningDays: env.certificateWarningDays,
    serviceFailureThreshold: env.serviceFailureThreshold,
    serviceRecoveryThreshold: env.serviceRecoveryThreshold,
  });

  console.log(`Loaded ${services.length} services from ${env.servicesConfigPath}`);
  await monitor.runOnce();

  setInterval(() => {
    monitor.runOnce().catch((error) => {
      console.error("Monitoring iteration failed:", error);
    });
  }, env.checkIntervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
