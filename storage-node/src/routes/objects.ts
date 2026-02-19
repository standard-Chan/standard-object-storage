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
} from "../services/storage/fileStorage";
import {
  sendErrorResponse,
  createSuccessResponse,
} from "../services/response/apiResponse";

/**
 * 객체 스토리지 API 엔드포인트
 *
 * PUT /objects/:bucket/:key
 * - Presigned URL 방식으로 파일 업로드
 * - 로컬 파일시스템에 저장
 */

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
   * 파일 업로드 엔드포인트
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

      // 5. Multipart 파일 데이터 받기
      const fileData = await request.file();
      const fileValidation = validateFileData(fileData);
      if (!fileValidation.isValid && fileValidation.error) {
        return sendErrorResponse(
          reply,
          fileValidation.error.code,
          fileValidation.error.message,
        );
      }

      // 6. 파일 저장
      const filePath = await saveFileToStorage(bucket, key, fileData!);

      // 7. 파일 정보 수집
      const fileInfo = await collectFileInfo(bucket, key, filePath, fileData!);

      // 8. TODO: MySQL에 메타데이터 저장
      // await saveMetadataToDatabase(fastify.mysql, fileInfo)

      // 9. 로그 기록
      fastify.log.info({ fileInfo }, "파일 업로드 성공");

      // 10. 성공 응답 전송
      return reply.code(201).send(createSuccessResponse(fileInfo));
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
