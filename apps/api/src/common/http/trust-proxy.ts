/**
 * Resolves how many reverse-proxy hops Express should trust.
 *
 * Only a hop count is accepted: trusting every hop (`true`) would let clients
 * spoof `X-Forwarded-For` and defeat per-IP throttling.
 */
export function resolveTrustProxy(value: string | undefined): number | false {
  const normalized = value?.trim();
  if (!normalized || normalized === "0" || normalized === "false") {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    const hops = Number(normalized);
    if (Number.isSafeInteger(hops) && hops > 0) {
      return hops;
    }
  }

  throw new Error("API_TRUST_PROXY must be a hop count");
}
