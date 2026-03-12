import path from "node:path";
import { HttpError } from "../../utils/HttpError";

export function validateBucket(bucket: string): void {
  if (!bucket || !/^[A-Za-z0-9._-]+$/.test(bucket)) {
    throw new HttpError(400, "bucket 값이 유효하지 않습니다");
  }
}

export function validateObjectKey(objectKey: string): void {
  if (!objectKey || path.isAbsolute(objectKey)) {
    throw new HttpError(400, "objectKey 값이 유효하지 않습니다");
  }

  const parts = objectKey.split(/[\\/]/).filter(Boolean);
  if (parts.includes("..")) {
    throw new HttpError(400, "objectKey 경로에 '..'은 허용되지 않습니다");
  }
}

export function parsePartNumber(partNumber: string): number {
  const parsed = Number.parseInt(partNumber, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, "partNumber는 1 이상의 정수여야 합니다");
  }
  return parsed;
}
