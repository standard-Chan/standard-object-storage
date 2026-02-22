import { FastifyPluginAsync } from "fastify";
import {
  validateRequiredParams,
  validateExpiration,
  validateMethod,
  validateRequestSignature,
} from "../services/validation/presignedUrl";
import {
  validateFileData,
  saveFileToStorage,
  collectFileInfo,
  saveMetadataToDatabase,
  getBucketIdByName,
  checkObjectExists,
  deleteFile,
} from "../services/storage/fileStorage";
import {
  sendErrorResponse,
  createSuccessResponse,
} from "../services/response/apiResponse";
import { HttpError } from "../utils/HttpError";

interface PutObjectQuery {
  bucket: string;
  objectKey: string;
  method: string;
  exp: string;
  signature: string;
}

interface PutObjectParams {
  bucket: string;
  "*": string; // wildcard 경로를 위한 타입
}

const objects: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  /**
   * PUT /objects/:bucket/:key
   * - 파일 업로드 엔드포인트
   * - 로컬 파일시스템에 저장
   */
  fastify.put<{
    Params: PutObjectParams;
    Querystring: PutObjectQuery;
  }>("/:bucket/*", async function (request, reply) {
    let filePath: string | null = null;
    
    try {
      const { bucket, objectKey, method, exp, signature } = request.query;

      // 1. 필수 파라미터 검증
      validateRequiredParams(bucket, objectKey, method, exp, signature);

      // 2. 만료 시간 검증
      validateExpiration(exp);

      // 3. HTTP 메서드 검증
      validateMethod(method, "PUT");

      // 4. 서명 검증
      const secretKey = process.env.PRESIGNED_URL_SECRET_KEY;
      if (!secretKey) {
        throw new Error("SECRET_KEY 환경 변수가 설정되지 않았습니다");
      }
      
      validateRequestSignature(method, bucket, objectKey, exp, signature, secretKey);

      // 5. Bucket 존재 확인 및 ID 조회
      const bucketId = await getBucketIdByName(fastify.mysql, bucket);

      // 6. 객체 중복 확인
      await checkObjectExists(fastify.mysql, bucketId, objectKey, bucket);

      // 7. Multipart 파일 데이터 받기 및 검증
      const fileData = await request.file();
      validateFileData(fileData);

      // 8. 파일 저장
      try {
        filePath = await saveFileToStorage(bucket, objectKey, fileData!);

        // 9. 파일 정보 수집
        const fileInfo = await collectFileInfo(bucket, objectKey, filePath, fileData!);

        // 10. MySQL에 메타데이터 저장
        const objectId = await saveMetadataToDatabase(fastify.mysql, bucketId, fileInfo);7

        // 11. 로그 기록
        fastify.log.info({ objectId, fileInfo }, "파일 업로드 성공");

        // 12. 성공 응답 전송
        const responseData = {
          objectId,
          ...fileInfo
        };
        return reply.code(201).send(createSuccessResponse(responseData));
      } catch (dbError) {
        // DB 저장 실패 시 파일 삭제 (롤백)
        if (filePath) {
          await deleteFile(filePath);
          fastify.log.warn({ filePath }, "DB 저장 실패로 파일 삭제");
        }
        throw dbError;
      }
    } catch (error) {
      // HttpError는 상태 코드와 메시지를 포함
      if (error instanceof HttpError) {
        fastify.log.warn({ error: error.message, statusCode: error.statusCode }, "검증 실패");
        return sendErrorResponse(
          reply,
          error.statusCode,
          error.message,
          error.data,
        );
      }
      
      // 기타 예상치 못한 에러
      fastify.log.error({ error }, "파일 업로드 오류");
      return sendErrorResponse(
        reply,
        500,
        "파일 업로드 중 오류가 발생했습니다",
        { error: error instanceof Error ? error.message : "알 수 없는 오류" },
      );
    }
  });
};

export default objects;
