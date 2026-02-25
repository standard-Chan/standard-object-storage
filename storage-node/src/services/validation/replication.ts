import { HttpError } from "../../utils/HttpError";

/**
 * 복제 요청 헤더 검증
 * @param replicationHeader X-Replication-Request 헤더 값
 * @throws {HttpError} 헤더가 없으면 403 에러
 */
export function validateReplicationHeader(
  replicationHeader: string | string[] | undefined,
): void {
  if (!replicationHeader) {
    throw new HttpError(
      403,
      "복제 요청이 거부되었습니다",
      { reason: "X-Replication-Request 헤더가 필요합니다" },
    );
  }
}

/**
 * 복제 요청 필수 파라미터 검증
 * @param bucket 버킷 이름
 * @param objectKey 오브젝트 키
 * @throws {HttpError} 필수 파라미터가 없으면 400 에러
 */
export function validateReplicationParams(
  bucket: string | undefined,
  objectKey: string | undefined,
): void {
  if (!bucket || !objectKey) {
    throw new HttpError(
      400,
      "필수 파라미터가 누락되었습니다",
      { required: ["bucket", "objectKey"] },
    );
  }
}
