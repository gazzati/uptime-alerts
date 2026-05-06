import tls from "node:tls";

export async function checkCertificate(urlString, warningDays) {
  const url = new URL(urlString);

  if (url.protocol !== "https:") {
    return {
      checked: false,
      shouldAlert: false,
      reason: "Certificate check is skipped for non-HTTPS URLs",
    };
  }

  const certificateInfo = await getPeerCertificateWithRetry(url.hostname, Number(url.port) || 443);
  const expiresAt = new Date(certificateInfo.validTo);
  const msRemaining = expiresAt.getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  const hasTlsError = Boolean(certificateInfo.authorizationError);
  const expiresSoon = daysRemaining < warningDays;
  const isExpired = msRemaining <= 0;

  return {
    checked: true,
    shouldAlert: hasTlsError || expiresSoon || isExpired,
    isExpired,
    expiresSoon,
    expiresAt,
    daysRemaining,
    authorizationError: certificateInfo.authorizationError,
  };
}

async function getPeerCertificateWithRetry(hostname, port, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await getPeerCertificate(hostname, port);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function getPeerCertificate(hostname, port) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        const certificate = socket.getPeerCertificate();

        if (!certificate || !certificate.valid_to) {
          socket.end();
          reject(new Error("Peer certificate was not provided"));
          return;
        }

        const result = {
          validTo: certificate.valid_to,
          authorizationError: socket.authorizationError || null,
        };

        socket.end();
        resolve(result);
      },
    );

    socket.setTimeout(10_000, () => {
      socket.destroy(new Error("TLS handshake timed out"));
    });

    socket.on("error", reject);
  });
}
