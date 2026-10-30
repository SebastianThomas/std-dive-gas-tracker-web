import axios from 'axios'

/** Pulls the human-readable ProblemDetail `detail` out of a failed request, if present - the
 * gas backend's ExceptionHandling (ws.advice) put a specific,
 * actionable message there (e.g. "trimming this range would leave fewer than 2 measurements").
 * Falls back to a plain Error's own message (e.g. a client-side fetch() that isn't routed through
 * axios/useApi, like a direct presigned-URL PUT) before giving up with a generic message. */
export function extractErrorDetail(err: unknown): string {
  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data as { detail?: string; title?: string }
    return data.detail ?? data.title ?? 'Please try again.'
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return 'Please try again.'
}
