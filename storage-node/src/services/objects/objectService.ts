import { MultipartFile } from "@fastify/multipart";
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
): Promise<DownloadResult> {
  validatePresignedUrlRequest(query, "GET");

  const { bucket, objectKey } = query;
  const fileStream = getFileStream(bucket, objectKey);
  const contentType = getContentTypeFromExtension(objectKey);

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
): Promise<FileInfo> {
  validatePresignedUrlRequest(query, "PUT");
  validateFileData(fileData);
  
  const { bucket, objectKey } = query;

  const filePath = await saveFileToStorage(bucket, objectKey, fileData!);
  const fileInfo = await collectFileInfo(bucket, objectKey, filePath, fileData!);

  await replicateToSecondary(bucket, objectKey);

  return fileInfo;
}
