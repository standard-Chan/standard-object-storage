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
  deleteFile,
  getFileStream,
  getContentTypeFromExtension,
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
   * GET /objects/:bucket/:key
   * - 파일 다운로드 엔드포인트
   * - Presigned URL 검증 후 파일 스트림 반환
   */
  fastify.get<{
    Params: PutObjectParams;
    Querystring: PutObjectQuery;
  }>("/:bucket/*", async function (request, reply) {
    try {
      const { bucket, objectKey, method, exp, signature } = request.query;

      validateRequiredParams(bucket, objectKey, method, exp, signature);
      validateExpiration(exp);
      validateMethod(method, "GET");
      validateRequestSignature(method, bucket, objectKey, exp, signature);

      // 5. Bucket 존재 확인 및 ID 조회
      // TODO: DB에서 버킷 존재 여부 확인
      // const bucketId = await getBucketIdByName(fastify.mysql, bucket);

      // 6. 객체 존재 확인
      // TODO: DB에서 객체 메타데이터 조회
      // const objectMetadata = await getObjectMetadata(fastify.mysql, bucketId, objectKey);

      // 7. 파일 스트림 생성
      const fileStream = getFileStream(bucket, objectKey);

      // 8. Content-Type 설정
      const contentType = getContentTypeFromExtension(objectKey);
      reply.header('Content-Type', contentType);

      // 9. 파일 스트림 반환
      fastify.log.info({ bucket, objectKey, contentType }, "File download started");
      return reply.send(fileStream);
    } catch (error) {
      // HttpError는 상태 코드와 메시지를 포함
      if (error instanceof HttpError) {
        fastify.log.warn({ error: error.message, statusCode: error.statusCode }, "Validation failed");
        return sendErrorResponse(
          reply,
          error.statusCode,
          error.message,
          error.data,
        );
      }
      
      // 기타 예상치 못한 에러
      fastify.log.error({ error }, "File download error");
      return sendErrorResponse(
        reply,
        500,
        "파일 다운로드 중 오류가 발생했습니다",
        { error: error instanceof Error ? error.message : "알 수 없는 오류" },
      );
    }
  });

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

      // 검증 로직
      validateRequiredParams(bucket, objectKey, method, exp, signature);
      validateExpiration(exp);
      validateMethod(method, "PUT");
      validateRequestSignature(method, bucket, objectKey, exp, signature);

      // 로그: PUT 요청 objectKey
      fastify.log.info({ objectKey }, "PUT request received");

      // // 5. Bucket 존재 확인 및 ID 조회
      // const bucketId = await getBucketIdByName(fastify.mysql, bucket);

      // // 6. 객체 중복 확인
      // await checkObjectExists(fastify.mysql, bucketId, objectKey, bucket);

      // 7. Multipart 파일 데이터 받기 및 검증
      const fileData = await request.file();
      validateFileData(fileData);

      // 8. 파일 저장
      try {
        filePath = await saveFileToStorage(bucket, objectKey, fileData!);

        // 9. 파일 정보 수집
        const fileInfo = await collectFileInfo(bucket, objectKey, filePath, fileData!);

        // // 10. MySQL에 메타데이터 저장
        // const objectId = await saveMetadataToDatabase(fastify.mysql, bucketId, fileInfo);

        // // 11. 로그 기록
        // fastify.log.info({ objectId, fileInfo }, "파일 업로드 성공");

        // 12. 성공 응답 전송
        // const responseData = {
        //   objectId,
        //   ...fileInfo
        // };

        const responseData = {
          ...fileInfo
        };
        return reply.code(201).send(createSuccessResponse(responseData));
      } catch (dbError) {
        // DB 저장 실패 시 파일 삭제 (롤백)
        if (filePath) {
          await deleteFile(filePath);
          fastify.log.warn({ filePath }, "File deleted due to DB save failure");
        }
        throw dbError;
      }
    } catch (error) {
      // HttpError는 상태 코드와 메시지를 포함
      if (error instanceof HttpError) {
        fastify.log.warn({ error: error.message, statusCode: error.statusCode }, "Validation failed");
        return sendErrorResponse(
          reply,
          error.statusCode,
          error.message,
          error.data,
        );
      }
      
      // 기타 예상치 못한 에러
      fastify.log.error({ error }, "File upload error");
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
