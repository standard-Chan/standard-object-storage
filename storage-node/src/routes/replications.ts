import { FastifyPluginAsync } from "fastify";
import {
  validateFileData,
  saveFileToStorage,
  collectFileInfo,
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
  /**
   * PUT /replicate
   * - 내부 데이터 복제용 엔드포인트
   * - X-Replication-Request 헤더 검증
   * - Primary에서 Secondary로 데이터 복제 시 사용
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

      // Multipart 파일 데이터 받기 및 검증
      const fileData = await request.file();
      validateFileData(fileData);

      // 파일 저장
      filePath = await saveFileToStorage(bucket, objectKey, fileData!);
      const fileInfo = await collectFileInfo(
        bucket,
        objectKey,
        filePath,
        fileData!,
      );

      fastify.log.info({ fileInfo }, "파일 복제 완료");

      const responseData = {
        ...fileInfo,
      };

      return reply.code(200).send(createSuccessResponse(responseData));
    } catch (error) {
      // HttpError는 상태 코드와 메시지를 포함
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

      // 기타 예상치 못한 에러
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
