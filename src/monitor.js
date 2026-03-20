import { checkCertificate } from "./certificate.js";

export class Monitor {
  constructor({ services, notifier, requestTimeoutMs, certificateWarningDays, logger = console }) {
    this.services = services;
    this.notifier = notifier;
    this.requestTimeoutMs = requestTimeoutMs;
    this.certificateWarningDays = certificateWarningDays;
    this.logger = logger;
    this.serviceStates = new Map();
    this.certificateStates = new Map();
    this.isRunning = false;
  }

  async runOnce() {
    if (this.isRunning) {
      this.logger.warn("Skipping monitoring iteration because the previous one is still running");
      return;
    }

    this.isRunning = true;

    try {
      await Promise.all(this.services.map((service) => this.checkService(service)));
    } finally {
      this.isRunning = false;
    }
  }

  async checkService(service) {
    const result = await this.performHttpCheck(service);
    await this.handleServiceState(service, result);

    if (service.type === "website") {
      const certificateResult = await this.performCertificateCheck(service);
      await this.handleCertificateState(service, certificateResult);
    }
  }

  async performHttpCheck(service) {
    const startedAt = Date.now();

    try {
      const response = await fetch(service.url, {
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      return {
        isHealthy: response.ok,
        statusCode: response.status,
        responseTimeMs: Date.now() - startedAt,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        isHealthy: false,
        statusCode: null,
        responseTimeMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async performCertificateCheck(service) {
    try {
      return await checkCertificate(service.url, this.certificateWarningDays);
    } catch (error) {
      return {
        checked: true,
        shouldAlert: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async handleServiceState(service, result) {
    const previous = this.serviceStates.get(service.name);
    const currentStatus = result.isHealthy ? "healthy" : "unhealthy";

    if (!previous) {
      this.serviceStates.set(service.name, currentStatus);

      if (!result.isHealthy) {
        await this.notifier.send(
          [
            `🚨 Service is down`,
            `Name: ${service.name}`,
            `Type: ${service.type}`,
            `URL: ${service.url}`,
            `Error: ${result.error}`,
            result.statusCode ? `Status: ${result.statusCode}` : null,
            `Response time: ${result.responseTimeMs}ms`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      return;
    }

    if (previous !== currentStatus) {
      if (result.isHealthy) {
        await this.notifier.send(
          [
            `✅ Service recovered`,
            `Name: ${service.name}`,
            `Type: ${service.type}`,
            `URL: ${service.url}`,
            `Status: ${result.statusCode}`,
            `Response time: ${result.responseTimeMs}ms`,
          ].join("\n"),
        );
      } else {
        await this.notifier.send(
          [
            `🚨 Service is down`,
            `Name: ${service.name}`,
            `Type: ${service.type}`,
            `URL: ${service.url}`,
            `Error: ${result.error}`,
            result.statusCode ? `Status: ${result.statusCode}` : null,
            `Response time: ${result.responseTimeMs}ms`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      this.serviceStates.set(service.name, currentStatus);
      return;
    }

    this.serviceStates.set(service.name, currentStatus);
    this.logger.info(
      `[service-check] ${service.name}: ${currentStatus} (${result.statusCode ?? result.error})`,
    );
  }

  async handleCertificateState(service, result) {
    if (!result.checked) {
      return;
    }

    const currentStatus = result.shouldAlert ? "alert" : "ok";
    const previous = this.certificateStates.get(service.name);

    if (!previous) {
      this.certificateStates.set(service.name, currentStatus);

      if (currentStatus === "alert") {
        await this.notifier.send(buildCertificateAlert(service, result));
      }

      return;
    }

    if (previous === currentStatus) {
      return;
    }

    if (currentStatus === "alert") {
      await this.notifier.send(buildCertificateAlert(service, result));
    } else if (previous === "alert") {
      await this.notifier.send(
        [
          `✅ Certificate issue resolved`,
          `Name: ${service.name}`,
          `URL: ${service.url}`,
          `Expires at: ${result.expiresAt.toISOString()}`,
          `Days remaining: ${result.daysRemaining}`,
        ].join("\n"),
      );
    }

    this.certificateStates.set(service.name, currentStatus);
  }
}

function buildCertificateAlert(service, result) {
  if (result.error) {
    return [
      `🚨 Certificate check failed`,
      `Name: ${service.name}`,
      `URL: ${service.url}`,
      `Error: ${result.error}`,
    ].join("\n");
  }

  if (result.authorizationError) {
    return [
      `🚨 TLS certificate problem`,
      `Name: ${service.name}`,
      `URL: ${service.url}`,
      `TLS error: ${result.authorizationError}`,
      `Expires at: ${result.expiresAt.toISOString()}`,
      `Days remaining: ${result.daysRemaining}`,
    ].join("\n");
  }

  if (result.isExpired) {
    return [
      `🚨 Certificate expired`,
      `Name: ${service.name}`,
      `URL: ${service.url}`,
      `Expired at: ${result.expiresAt.toISOString()}`,
    ].join("\n");
  }

  return [
    `⚠️ Certificate expires soon`,
    `Name: ${service.name}`,
    `URL: ${service.url}`,
    `Expires at: ${result.expiresAt.toISOString()}`,
    `Days remaining: ${result.daysRemaining}`,
  ].join("\n");
}
