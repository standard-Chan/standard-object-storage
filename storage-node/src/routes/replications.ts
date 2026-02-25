import { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import {
  saveStreamToStorage,
  collectStreamFileInfo,
} from "../services/storage/fileStorage";
import {
  sendErrorResponse,
  createSuccessResponse,
} from "../services/response/apiResponse";
import { HttpError } from "../utils/HttpError";
import {
  validateReplicationHeader,
  validateReplicationParams,
} from "../services/validation/replication";

interface ReplicateQuery {
  bucket: string;
  objectKey: string;
}

const replications: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // multipart 파서가 처리하지 않는 Content-Type(raw binary 등)을 스트림으로 그대로 통과
  fastify.addContentTypeParser(
    "*",
    function (_request, payload, done) {
      done(null, payload);
    },
  );

  /**
   * PUT /internal/replications
   * - 내부 데이터 복제용 엔드포인트
   * - X-Replication-Request 헤더 검증
   * - Primary에서 Secondary로 데이터 복제 시 사용 (raw stream 수신)
   */
  fastify.put<{
    Querystring: ReplicateQuery;
  }>("/internal/replications", async function (request, reply) {
    let filePath: string | null = null;

    try {
      const replicationHeader = request.headers["x-replication-request"];
      validateReplicationHeader(replicationHeader);

      const { bucket, objectKey } = request.query;
      console.log(bucket, objectKey);
      validateReplicationParams(bucket, objectKey);

      fastify.log.info(
        { bucket, objectKey },
        "Replication request received",
      );

      const bodyStream = request.body as Readable;
      if (!bodyStream || typeof bodyStream.pipe !== "function") {
        throw new HttpError(400, "파일 스트림이 전달되지 않았습니다");
      }

      const mimetype =
        request.headers["content-type"] ?? "application/octet-stream";

      // 스트림을 디스크에 저장
      filePath = await saveStreamToStorage(bucket, objectKey, bodyStream);
      const fileInfo = await collectStreamFileInfo(
        bucket,
        objectKey,
        filePath,
        mimetype,
      );

      fastify.log.info({ fileInfo }, "파일 복제 완료");

      return reply.code(200).send(createSuccessResponse(fileInfo));
    } catch (error) {
      if (error instanceof HttpError) {
        fastify.log.warn(
          { error: error.message, statusCode: error.statusCode },
          "Replication failed",
        );
        return sendErrorResponse(
          reply,
          error.statusCode,
          error.message,
          error.data,
        );
      }

      fastify.log.error({ error }, "Replication error");
      return sendErrorResponse(
        reply,
        500,
        "파일 복제 중 오류가 발생했습니다",
        { error: error instanceof Error ? error.message : "알 수 없는 오류" },
      );
    }
  });
};

export default replications;
