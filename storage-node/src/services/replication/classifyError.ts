import { ErrorType } from "../../repository/replicationQueue";
import { HttpError } from "../../utils/HttpError";

/**
 * replicateToSecondary가 던지는 HttpError 메시지 패턴으로
 * ErrorType을 분류한다.
 */
export function classifyReplicationError(error: unknown): ErrorType {
  if (error instanceof HttpError) {
    const msg = error.message;
    if (msg.includes("Secondary 복제 실패 (HTTP")) return "HTTP_NON_2XX";
    if (msg.includes("Secondary 복제 타임아웃")) return "TIMEOUT";
    if (msg.includes("Secondary 복제 중 오류가 발생했습니다")) return "NETWORK";
  }
  return "UNKNOWN";
}
