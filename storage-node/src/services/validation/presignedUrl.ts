import { isExpired, verifySignature } from "./crypto";
import { HttpError } from "../../utils/HttpError";

/**
 * 필수 파라미터 검증
 */
export function validateRequiredParams(
  bucket: string,
  objectKey: string,
  method: string,
  exp: string,
  signature: string,
): void {
  if (!bucket || !objectKey || !method || !exp || !signature) {
    throw new HttpError(400, "필수 파라미터가 누락되었습니다", {
      required: ["bucket", "objectKey", "method", "exp", "signature"],
    });
  }
}

/**
 * 만료 시간 검증
 */
export function validateExpiration(exp: string): void {
  const expTimestamp = parseInt(exp, 10);

  if (isNaN(expTimestamp)) {
    throw new HttpError(400, "만료 시간(exp)이 유효하지 않습니다");
  }

  if (isExpired(expTimestamp)) {
    throw new HttpError(403, "요청이 만료되었습니다");
  }
}

/**
 * HTTP 메서드 검증
 */
export function validateMethod(
  method: string,
  expectedMethod: string = "PUT",
): void {
  if (method.toUpperCase() !== expectedMethod.toUpperCase()) {
    throw new HttpError(
      400,
      `메서드가 일치하지 않습니다. 요청: ${expectedMethod}, 서명: ${method}`,
    );
  }
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(fileSize: string): void {
  const size = Number(fileSize);

  if (isNaN(size) || !Number.isInteger(size)) {
    throw new HttpError(400, "파일 크기(fileSize)가 유효하지 않습니다");
  }

  if (size <= 0) {
    throw new HttpError(400, "파일 크기(fileSize)는 0보다 커야 합니다");
  }
}

/**
 * 서명 검증
 */
export function validateRequestSignature(
  method: string,
  bucket: string,
  key: string,
  exp: string,
  fileSize: string,
  signature: string,
): void {
  const secretKey = process.env.PRESIGNED_URL_SECRET_KEY;
  if (!secretKey) {
    throw new HttpError(500, "SECRET_KEY 환경 변수가 설정되지 않았습니다");
  }

  const expTimestamp = parseInt(exp, 10);
  const isValidSignature = verifySignature(
    method.toUpperCase(),
    bucket,
    key,
    expTimestamp,
    fileSize,
    signature,
    secretKey,
  );

  if (!isValidSignature) {
    throw new HttpError(403, "서명이 유효하지 않습니다");
  }
}

/**
 * Presigned URL 요청 통합 검증
 * - 필수 파라미터, 만료 시간, 메서드, 서명을 한 번에 검증
 */
export function validatePresignedUrlRequest(
  query: {
    bucket: string;
    objectKey: string;
    method: string;
    exp: string;
    fileSize: string;
    signature: string;
  },
  expectedMethod: "GET" | "PUT",
): void {
  const { bucket, objectKey, method, exp, fileSize, signature } = query;
  validateRequiredParams(bucket, objectKey, method, exp, signature);
  validateExpiration(exp);
  validateMethod(method, expectedMethod);
  validateFileSize(fileSize);
  validateRequestSignature(method, bucket, objectKey, exp, fileSize, signature);
}
