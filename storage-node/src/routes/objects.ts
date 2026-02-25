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
import {
  httpRequestDuration,
  httpRequestTotal,
  fileUploadSize,
  activeConnections,
} from "./metrics";

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

      const fileStream = getFileStream(bucket, objectKey);
      const contentType = getContentTypeFromExtension(objectKey);
      reply.header("Content-Type", contentType);

      fastify.log.info(
        { bucket, objectKey, contentType },
        "File download started",
      );

      const response = reply.send(fileStream);

      return response;
    } catch (error) {
      // HttpError는 상태 코드와 메시지를 포함
      if (error instanceof HttpError) {
        fastify.log.warn(
          { error: error.message, statusCode: error.statusCode },
          "Validation failed",
        );
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
      // Multipart 파일 데이터 받기 및 검증
      const fileData = await request.file();
      validateFileData(fileData);

      fastify.log.info({ objectKey }, "PUT request received");

      // 파일 저장
      filePath = await saveFileToStorage(bucket, objectKey, fileData!);
      const fileInfo = await collectFileInfo(
        bucket,
        objectKey,
        filePath,
        fileData!,
      );
      fastify.log.info({ fileInfo }, "파일 업로드 성공");

      // TODO: MySQL에 메타데이터 저장

      const responseData = {
        ...fileInfo,
      };

      return reply.code(201).send(createSuccessResponse(responseData));
    } catch (error) {
      // HttpError는 상태 코드와 메시지를 포함
      if (error instanceof HttpError) {
        fastify.log.warn(
          { error: error.message, statusCode: error.statusCode },
          "Validation failed",
        );
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
