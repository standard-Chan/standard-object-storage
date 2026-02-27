import { FastifyPluginAsync } from "fastify";
import {
  sendErrorResponse,
  createSuccessResponse,
} from "../services/response/apiResponse";
import { HttpError } from "../utils/HttpError";
import {
  receiveReplication,
  ReplicateQuery,
} from "../services/replication/receiveReplication";

const replications: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // multipart 파서가 처리하지 않는 Content-Type(raw binary 등)을 스트림으로 그대로 통과
  fastify.addContentTypeParser(
    "*",
    function (_request, payload, done) {
      done(null, payload);
    },
  );

  /* PUT /internal/replications : 내부 데이터 복제용 */
  fastify.put<{
    Querystring: ReplicateQuery;
  }>("/internal/replications", async function (request, reply) {
    try {
      const fileInfo = await receiveReplication(request);

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
