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
 */
export async function uploadObject(
  query: PresignedQuery,
  fileData: MultipartFile | undefined,
  log: FastifyBaseLogger,
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

  await replicateToSecondary(bucket, objectKey, log);
  log.info({ bucket, objectKey }, "Secondary-Node 복제 완료");

  return fileInfo;
}
