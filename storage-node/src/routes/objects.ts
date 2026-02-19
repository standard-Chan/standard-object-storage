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

interface PutObjectQuery {
  bucket: string;
  key: string;
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
    try {
      const { bucket, key, method, exp, signature } = request.query;

      // 1. 필수 파라미터 검증
      const paramsValidation = validateRequiredParams(
        bucket,
        key,
        method,
        exp,
        signature,
      );
      if (!paramsValidation.isValid && paramsValidation.error) {
        return sendErrorResponse(
          reply,
          paramsValidation.error.code,
          paramsValidation.error.message,
          paramsValidation.error.data,
        );
      }

      // 2. 만료 시간 검증
      const expirationValidation = validateExpiration(exp);
      if (!expirationValidation.isValid && expirationValidation.error) {
        return sendErrorResponse(
          reply,
          expirationValidation.error.code,
          expirationValidation.error.message,
        );
      }

      // 3. HTTP 메서드 검증
      const methodValidation = validateMethod(method, "PUT");
      if (!methodValidation.isValid && methodValidation.error) {
        return sendErrorResponse(
          reply,
          methodValidation.error.code,
          methodValidation.error.message,
        );
      }

      // 4. 서명 검증
      // SECRET_KEY 환경변수 가져오기 (Java와 동일한 이름)
      const secretKey = process.env.PRESIGNED_URL_SECRET_KEY;
      if (!secretKey) {
        throw new Error("SECRET_KEY 환경 변수가 설정되지 않았습니다");
      }
      
      const signatureValidation = validateRequestSignature(
        method,
        bucket,
        key,
        exp,
        signature,
        secretKey,
      );
      if (!signatureValidation.isValid && signatureValidation.error) {
        return sendErrorResponse(
          reply,
          signatureValidation.error.code,
          signatureValidation.error.message,
        );
      }

      // 5. Bucket 존재 확인
      const bucketId = await getBucketIdByName(fastify.mysql, bucket);
      if (!bucketId) {
        return sendErrorResponse(
          reply,
          404,
          `버킷을 찾을 수 없습니다: ${bucket}`,
        );
      }

      // 6. 객체 중복 확인
      const exists = await checkObjectExists(fastify.mysql, bucketId, key);
      if (exists) {
        return sendErrorResponse(
          reply,
          409,
          `이미 존재하는 객체입니다: ${bucket}/${key}`,
        );
      }

      // 7. Multipart 파일 데이터 받기
      const fileData = await request.file();
      const fileValidation = validateFileData(fileData);
      if (!fileValidation.isValid && fileValidation.error) {
        return sendErrorResponse(
          reply,
          fileValidation.error.code,
          fileValidation.error.message,
        );
      }

      // 8. 파일 저장
      let filePath: string | null = null;
      try {
        filePath = await saveFileToStorage(bucket, key, fileData!);

        // 9. 파일 정보 수집
        const fileInfo = await collectFileInfo(bucket, key, filePath, fileData!);

        // 10. MySQL에 메타데이터 저장
        const objectId = await saveMetadataToDatabase(fastify.mysql, bucketId, fileInfo);

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
