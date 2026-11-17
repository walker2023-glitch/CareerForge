/**
 * Maximum raw request body size in bytes for POST /api/jobs/parse.
 *
 * Calculation:
 * - Maximum job description length: 20,000 characters (enforced by JobDraftSchema per AGENTS.md).
 * - In UTF-8 encoding, multibyte characters (such as emojis or 4-byte astral characters) can take up to 4 bytes:
 *     20,000 chars * 4 bytes/char = 80,000 bytes.
 * - Other fields:
 *     - title: max 200 chars * 4 = 800 bytes
 *     - company: max 200 chars * 4 = 800 bytes
 *     - location: max 200 chars * 4 = 800 bytes
 *     - sourceUrl: max 2,048 bytes
 *     - deadline: 10 bytes (YYYY-MM-DD)
 *     - jobType, workMode enums: ~50 bytes
 * - JSON syntax envelope (field names, quotes, colons, brackets, whitespace): ~2,000 bytes.
 * - Total maximum size for legitimate input: ~86,500 bytes.
 *
 * Setting the bound at 100,000 bytes (100 KB) safely accommodates any valid
 * 20,000-character description with full multibyte text and JSON envelope,
 * while preventing memory exhaustion attacks from unbounded bodies.
 */
export const MAX_RAW_BODY_BYTES = 100_000;

export type ReadBoundedBodyResult =
  | { ok: true; text: string; bytesRead: number }
  | { ok: false; status: 400 | 413; code: string; message: string; bytesRead?: number };

/**
 * Reads a raw request body up to a hard byte limit.
 *
 * 1. Checks `Content-Length` header first: if present and greater than `maxBytes`,
 *    aborts immediately before buffering any stream chunks.
 * 2. If `Content-Length` is omitted, chunked, or within limits, streams the body
 *    incrementally. If accumulated bytes exceed `maxBytes`, the stream reader is
 *    cancelled immediately and a 413 Payload Too Large error is returned.
 * 3. Never logs or leaks the raw body contents.
 */
export async function readBoundedBody(
  request: Pick<Request, 'headers' | 'body' | 'text'>,
  maxBytes: number = MAX_RAW_BODY_BYTES,
): Promise<ReadBoundedBodyResult> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds maximum allowed size of ${maxBytes.toLocaleString()} bytes`,
      };
    }
  }

  // If request has no body stream, fallback to text() if available
  if (!request.body) {
    try {
      const text = await request.text();
      const byteLength = new TextEncoder().encode(text).byteLength;
      if (byteLength > maxBytes) {
        return {
          ok: false,
          status: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body exceeds maximum allowed size of ${maxBytes.toLocaleString()} bytes`,
          bytesRead: byteLength,
        };
      }
      return { ok: true, text, bytesRead: byteLength };
    } catch {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Failed to read request body',
      };
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel('payload_too_large').catch(() => {});
          return {
            ok: false,
            status: 413,
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body exceeds maximum allowed size of ${maxBytes.toLocaleString()} bytes`,
            bytesRead: totalBytes,
          };
        }
        chunks.push(value);
      }
    }
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_INPUT',
      message: 'Failed to read request body stream',
    };
  }

  const concatenated = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder('utf-8').decode(concatenated);
  return { ok: true, text, bytesRead: totalBytes };
}
