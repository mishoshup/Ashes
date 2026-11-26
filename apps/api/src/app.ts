import { bodyLimit } from "hono/body-limit";
import { Hono } from "hono";
import { hasSessionCookie } from "./lib/session-cookie";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { checkInRoutes, insightRoutes, topicRoutes } from "./routes/checkin";
import { communityRoutes } from "./routes/communities";
import type { AppEnv } from "./types";

const SERVICE = "ashes-api";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  });
  app.use(
    "*",
    bodyLimit({
      maxSize: 256 * 1024,
      onError: () => {
        throw new HTTPException(413, { message: "Request body too large" });
      },
    }),
  );
  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");
    const allowed: string[] = [c.env.WEB_ORIGIN, c.env.APP_ORIGIN].filter(Boolean);
    if (origin && allowed.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Vary", "Origin");
    }
    await next();
  });
  app.use("*", async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      return next();
    }
    if (!hasSessionCookie(c)) {
      return next();
    }
    const origin = c.req.header("Origin");
    const allowed: string[] = [c.env.WEB_ORIGIN, c.env.APP_ORIGIN].filter(Boolean);
    if (!origin || !allowed.includes(origin)) {
      throw new HTTPException(403, { message: "Cross-origin request blocked" });
    }
    await next();
  });
  app.options("*", (c) => {
    const origin = c.req.header("Origin");
    const allowed: string[] = [c.env.WEB_ORIGIN, c.env.APP_ORIGIN].filter(Boolean);
    if (origin && allowed.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Vary", "Origin");
    }
    c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    c.header(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Idempotency-Key, X-Turnstile-Token",
    );
    c.header("Access-Control-Max-Age", "86400");
    return c.body(null, 204);
  });

  app.get("/healthz", async (c) => {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return c.json({
      ok: row?.ok === 1,
      service: SERVICE,
      environment: c.env.ENVIRONMENT,
    });
  });

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      service: SERVICE,
      environment: c.env.ENVIRONMENT,
      requestId: c.get("requestId"),
    }),
  );

  app.route("/api/auth", authRoutes);
  app.route("/api/me", meRoutes);
  app.route("/api/check-in", checkInRoutes);
  app.route("/api/communities", communityRoutes);
  app.route("/api/insights", insightRoutes);
  app.route("/api/topics", topicRoutes);

  app.get("/ws/:room", async (c) => {
    if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
      return c.text("Expected WebSocket", 426);
    }
    const roomId = c.req.param("room");
    if (!roomId) {
      return c.text("Missing room", 400);
    }
    const id = c.env.ROOM.idFromName(roomId);
    return c.env.ROOM.get(id).fetch(c.req.raw);
  });

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "not_found",
          message: "Not found",
          requestId: c.get("requestId") ?? "unknown",
        },
      },
      404,
    ),
  );

  app.onError((error, c) => {
    const requestId = c.get("requestId") ?? "unknown";
    if (error instanceof HTTPException) {
      return c.json(
        {
          error: {
            code:
              error.status === 401
                ? "unauthorized"
                : error.status === 404
                  ? "not_found"
                  : error.status === 429
                    ? "rate_limited"
                    : error.status === 413
                      ? "payload_too_large"
                      : "bad_request",
            message: error.message,
            requestId,
          },
        },
        error.status,
      );
    }
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        path: c.req.path,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return c.json(
      {
        error: {
          code: "internal",
          message: "Something went wrong",
          requestId,
        },
      },
      500,
    );
  });

  return app;
}
