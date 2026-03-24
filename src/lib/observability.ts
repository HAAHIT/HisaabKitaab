type RequestLike = {
  headers: Headers;
};

type LogContext = Record<string, unknown>;
type LogSeverity = "INFO" | "WARNING" | "ERROR";

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeValue(nestedValue),
      ])
    );
  }

  return value;
}

function writeLog(severity: LogSeverity, event: string, context: LogContext = {}) {
  const payload = {
    severity,
    event,
    service: "doorcraft-pro",
    timestamp: new Date().toISOString(),
    ...(normalizeValue(context) as Record<string, unknown>),
  };
  const serialized = JSON.stringify(payload);

  if (severity === "ERROR") {
    console.error(serialized);
    return;
  }

  if (severity === "WARNING") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export function logInfo(event: string, context?: LogContext) {
  writeLog("INFO", event, context);
}

export function logWarn(event: string, context?: LogContext) {
  writeLog("WARNING", event, context);
}

export function logError(event: string, context?: LogContext) {
  writeLog("ERROR", event, context);
}

export function getRequestId(request: RequestLike) {
  const requestId = request.headers.get("x-request-id")?.trim();
  return requestId || crypto.randomUUID();
}

export function getClientIp(request: RequestLike) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstAddress = forwardedFor.split(",")[0]?.trim();
    if (firstAddress) {
      return firstAddress;
    }
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function attachRequestIdHeader<T extends Response | import("next/server").NextResponse>(
  response: T,
  requestId: string
): T {
  response.headers.set("x-request-id", requestId);
  return response;
}
