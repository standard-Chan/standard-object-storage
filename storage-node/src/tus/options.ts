import { IncomingMessage } from "node:http";


/**
 * bucket/objectKey로 file id 생성
 */
export function namingFunction(req: IncomingMessage): string {
  const url = new URL(req.url!, `http://localhost`);
  const bucket = url.searchParams.get("bucket");
  const objectKey = url.searchParams.get("objectKey");

  if (!bucket || !objectKey) {
    throw new Error("bucket과 objectKey 쿼리 파라미터가 필요합니다");
  }

  return `${bucket}/${objectKey}`;
}