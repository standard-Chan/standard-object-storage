import { ErrorType } from "../../repository/replicationQueue";
import { HttpError } from "../../utils/HttpError";

/**
 * replicateToSecondary가 던지는 HttpError의 statusCode를 기준으로 ErrorType을 분류
 */
export function classifyReplicationError(error: unknown): ErrorType {
  if (!(error instanceof HttpError)) return "UNKNOWN";

  const { statusCode } = error;

  if (statusCode === 504) return "TIMEOUT";
  if (statusCode === 502) return "NETWORK";
  if (statusCode >= 400 && statusCode <= 599) return "HTTP_NON_2XX";

  return "UNKNOWN";
}
