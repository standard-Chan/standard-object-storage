import { HttpError } from "../../utils/HttpError";
import {
  getContentTypeFromExtension,
  getFileStream,
} from "../storage/fileStorage";

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * 환경변수에서 복제 타임아웃(ms)을 읽어 반환
 * REPLICATION_TIMEOUT_MS 미설정 시 기본값 10,000ms 사용
 */
function getTimeoutMs(): number {
  const raw = process.env.REPLICATION_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * Secondary 노드에 파일 복제
 *
 * - SECONDARY_ENDPOINT 환경변수에 설정된 주소로 PUT /internal/replications 요청
 * - 원본 파일을 disk에서 읽어 multipart/form-data로 전송
 * - X-Replication-Request 헤더 포함
 * - REPLICATION_TIMEOUT_MS(기본 10초) 초과 시 AbortError → HttpError(500) 변환
 *
 * @param bucket    버킷 이름
 * @param objectKey 오브젝트 키
 * @param filePath  디스크에 저장된 파일의 절대 경로
 */
export async function replicateToSecondary(
  bucket: string,
  objectKey: string,
): Promise<void> {
  const secondaryNodeIp = process.env.SECONDARY_NODE_IP;
  if (!secondaryNodeIp) {
    throw new HttpError(500, "복제할 대상 IP 환경변수값이 설정되지 않았습니다");
  }

  const url =
    `${secondaryNodeIp}/internal/replications` +
    `?bucket=${encodeURIComponent(bucket)}&objectKey=${encodeURIComponent(objectKey)}`;

  const fileStream = getFileStream(bucket, objectKey);

  // timeout 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());
  controller.signal.addEventListener("abort", () => {
    fileStream.destroy();
  });

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Replication-Request": "true",
        "Content-Type": getContentTypeFromExtension(objectKey),
      },
      body: fileStream,
      signal: controller.signal,
      duplex: "half",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new HttpError(
        500,
        `Secondary 복제 실패 (HTTP ${response.status})`,
        { body },
      );
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;

    if ((error as { name?: string })?.name === "AbortError") {
      throw new HttpError(
        500,
        `Secondary 복제 타임아웃 (${getTimeoutMs()}ms 초과)`,
      );
    }

    throw new HttpError(500, "Secondary 복제 중 오류가 발생했습니다", {
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
