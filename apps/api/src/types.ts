import type { AuthUser } from "./services/users";

type CloudflareBindings = Omit<Cloudflare.Env, "ENVIRONMENT" | "ALLOW_DEV_AUTH_TOKEN"> & {
  ENVIRONMENT: string;
};

export type Env = CloudflareBindings & {
  RESEND_API_KEY?: string;
  SESSION_PEPPER?: string;
  ALLOW_DEV_AUTH_TOKEN?: string;
  TURNSTILE_SECRET?: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
    user: AuthUser;
    sessionToken: string;
  };
};
