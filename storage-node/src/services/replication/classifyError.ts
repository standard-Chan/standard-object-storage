import { ErrorType } from "../../repository/replicationQueue";
import { HttpError } from "../../utils/HttpError";
import {
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_ERROR_RANGE_MAX,
  HTTP_STATUS_ERROR_RANGE_MIN,
  HTTP_STATUS_GATEWAY_TIMEOUT,
} from "../../constants/httpStatus";

/**
 * replicateToSecondary가 던지는 HttpError의 statusCode를 기준으로 ErrorType을 분류
 */
export function classifyReplicationError(error: unknown): ErrorType {
  if (!(error instanceof HttpError)) return "UNKNOWN";

  const { statusCode } = error;

  if (statusCode === HTTP_STATUS_GATEWAY_TIMEOUT) return "TIMEOUT";
  if (statusCode === HTTP_STATUS_BAD_GATEWAY) return "NETWORK";
  if (statusCode >= HTTP_STATUS_ERROR_RANGE_MIN && statusCode <= HTTP_STATUS_ERROR_RANGE_MAX) return "HTTP_NON_2XX";

  return "UNKNOWN";
}
