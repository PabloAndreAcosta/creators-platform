// Supabase GoTrue applies per-IP rate limits on auth endpoints (token, signin,
// signup, recover, otp). When tripped it returns HTTP 429 with error code
// `over_request_rate_limit`. The raw message ("Request rate limit reached") is
// cryptic, so users assume a wrong password and keep retrying — which extends
// the limit. Detect it so the UI can show a clear "wait a moment" message and
// pause retries instead of passing the raw error straight through.
export function isRateLimitError(
  error: { status?: number; code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    /rate limit/i.test(error.message ?? "")
  );
}
