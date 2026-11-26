export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  ROOM: DurableObjectNamespace;
  JOBS: Queue;
  ENVIRONMENT: string;
  WEB_ORIGIN: string;
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  SESSION_PEPPER?: string;
  TURNSTILE_SECRET?: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
  };
};
