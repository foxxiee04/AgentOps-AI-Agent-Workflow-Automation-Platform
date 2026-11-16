export function isDemoLoginEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.DEMO_LOGIN_ENABLED === "true") {
    return true;
  }
  if (env.DEMO_LOGIN_ENABLED === "false") {
    return false;
  }

  return (env.APP_ENV ?? "local") === "local";
}
