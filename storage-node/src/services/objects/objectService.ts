import { MultipartFile } from "@fastify/multipart";
import { FastifyBaseLogger } from "fastify";
import { validatePresignedUrlRequest } from "../validation/presignedUrl";
import {
  validateFileData,
  saveFileToStorage,
  collectFileInfo,
  getFileStream,
  getContentTypeFromExtension,
  FileInfo,
} from "../storage/fileStorage";
import { replicateToSecondary } from "../replication/replicateToSecondary";
import {
  ErrorType,
  ReplicationQueueRepository,
} from "../../repository/replicationQueue";
import { HttpError } from "../../utils/HttpError";

/**
 * replicateToSecondary가 던지는 HttpError 메시지 패턴으로
 * ErrorType을 분류한다.
 */
function classifyReplicationError(error: unknown): ErrorType {
  if (error instanceof HttpError) {
    const msg = error.message;
    if (msg.includes("Secondary 복제 실패 (HTTP")) return "HTTP_NON_2XX";
    if (msg.includes("Secondary 복제 타임아웃")) return "TIMEOUT";
    if (msg.includes("Secondary 복제 중 오류가 발생했습니다")) return "NETWORK";
  }
  return "UNKNOWN";
}

interface PresignedQuery {
  bucket: string;
  objectKey: string;
  method: string;
  exp: string;
  signature: string;
}

export interface DownloadResult {
  fileStream: ReturnType<typeof getFileStream>;
  contentType: string;
}

/**
 * 파일 다운로드 서비스
 * - Presigned URL 검증
 * - 파일 스트림 및 Content-Type 반환
 */
export async function downloadObject(
  query: PresignedQuery,
  log: FastifyBaseLogger,
): Promise<DownloadResult> {
  const { bucket, objectKey } = query;
  log.info({ objectKey }, "GET request received");

  validatePresignedUrlRequest(query, "GET");
  const fileStream = getFileStream(bucket, objectKey);
  const contentType = getContentTypeFromExtension(objectKey);

  log.info(
    { bucket, objectKey, contentType },
    "GET 처리 완료 - download할 수 있습니다",
  );

  return { fileStream, contentType };
}

/**
 * 파일 업로드 서비스
 * - Presigned URL 검증
 * - 파일 저장 → 정보 수집 → Secondary 복제
 * - Secondary 복제 실패 시 replication_queue에 upsert 후 성공 응답 유지
 */
export async function uploadObject(
  query: PresignedQuery,
  fileData: MultipartFile | undefined,
  log: FastifyBaseLogger,
  replicationQueue: ReplicationQueueRepository,
): Promise<FileInfo> {
  const { bucket, objectKey } = query;
  log.info({ objectKey }, "PUT request received");

  validatePresignedUrlRequest(query, "PUT");
  validateFileData(fileData);

  const filePath = await saveFileToStorage(bucket, objectKey, fileData!);
  const fileInfo = await collectFileInfo(
    bucket,
    objectKey,
    filePath,
    fileData!,
  );
  log.info({ fileInfo }, "파일 업로드 성공");

  try {
    await replicateToSecondary(bucket, objectKey, log);
    log.info({ bucket, objectKey }, "Secondary-Node 복제 완료");
  } catch (error) {
    const errorType = classifyReplicationError(error);
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";

    log.warn(
      { bucket, objectKey, errorType, errorMessage },
      "Secondary 복제 실패 - replication_queue에 등록",
    );

    replicationQueue.upsertOnFailure(bucket, objectKey, errorType, errorMessage);
  }

  return fileInfo;
}
