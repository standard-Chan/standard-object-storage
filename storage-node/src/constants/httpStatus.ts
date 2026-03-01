// ─── 2xx Success ──────────────────────────────────────────────────────────────

export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_CREATED = 201;
export const HTTP_STATUS_NO_CONTENT = 204;

// ─── 4xx Client Error ─────────────────────────────────────────────────────────

export const HTTP_STATUS_BAD_REQUEST = 400;
export const HTTP_STATUS_UNAUTHORIZED = 401;
export const HTTP_STATUS_FORBIDDEN = 403;
export const HTTP_STATUS_NOT_FOUND = 404;
export const HTTP_STATUS_CONFLICT = 409;
export const HTTP_STATUS_PAYLOAD_TOO_LARGE = 413;
export const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

// ─── 5xx Server Error ─────────────────────────────────────────────────────────

export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

/** fetch 자체가 실패한 경우 (연결 거부, DNS 실패 등) */
export const HTTP_STATUS_BAD_GATEWAY = 502;

/** AbortController로 요청을 중단한 경우 */
export const HTTP_STATUS_GATEWAY_TIMEOUT = 504;

// ─── 오류 범위 ────────────────────────────────────────────────────────────────

/** HTTP 오류 상태 코드 범위 하한 (400 Bad Request) */
export const HTTP_STATUS_ERROR_RANGE_MIN = 400;

/** HTTP 오류 상태 코드 범위 상한 (599) */
export const HTTP_STATUS_ERROR_RANGE_MAX = 599;
