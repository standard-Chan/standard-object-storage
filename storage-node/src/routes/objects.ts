import { FastifyPluginAsync } from "fastify";
import {
  sendErrorResponse,
  createSuccessResponse,
} from "../services/response/apiResponse";
import { HttpError } from "../utils/HttpError";
import {
  downloadObject,
  uploadObject,
} from "../services/objects/objectService";

interface ObjectQuery {
  bucket: string;
  objectKey: string;
  method: string;
  exp: string;
  signature: string;
}

interface ObjectParams {
  bucket: string;
  "*": string;
}

const objects: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  /**
   * GET /objects/:bucket/:key
   * - 파일 다운로드 엔드포인트
   * - Presigned URL 검증 후 파일 스트림 반환
   */
  fastify.get<{
    Params: ObjectParams;
    Querystring: ObjectQuery;
  }>("/objects/:bucket/*", async function (request, reply) {
    try {
      const { fileStream, contentType } = await downloadObject(
        request.query,
        request.log,
      );

      reply.header("Content-Type", contentType);
      return reply.send(fileStream);
    } catch (error) {
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
      fastify.log.error({ error }, "File download error");
      return sendErrorResponse(
        reply,
        500,
        "파일 다운로드 중 오류가 발생했습니다",
        {
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        },
      );
    }
  });

  /**
   * PUT /objects/:bucket/:key
   * - 파일 업로드 엔드포인트
   * - 로컬 파일시스템에 저장
   */
  fastify.put<{
    Params: ObjectParams;
    Querystring: ObjectQuery;
  }>("/:bucket/*", async function (request, reply) {
    try {
      // TODO: MySQL에 메타데이터 저장
      const fileData = await request.file();
      const fileInfo = await uploadObject(request.query, fileData, request.log);

      return reply.code(201).send(createSuccessResponse(fileInfo));
    } catch (error) {
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
      fastify.log.error({ error }, "File upload error");
      return sendErrorResponse(
        reply,
        500,
        "파일 업로드 중 오류가 발생했습니다",
        {
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        },
      );
    }
  });
};

export default objects;
