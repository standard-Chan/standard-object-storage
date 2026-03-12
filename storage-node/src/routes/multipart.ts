import { FastifyPluginAsync } from "fastify";
import {
  createSuccessResponse,
  sendErrorResponse,
} from "../services/response/apiResponse";
import { HttpError } from "../utils/HttpError";
import {
  MultipartService,
  InitiateMultipartBody,
  MultipartParams,
  UploadPartParams,
} from "../services/multipart/MultipartService";

const multipartService = MultipartService.getInstance();

const multipart: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.addContentTypeParser("*", function (_request, payload, done) {
    done(null, payload);
  });

  fastify.post<{ Body: InitiateMultipartBody }>(
    "/multipart/initiate",
    async function (request, reply) {
      try {
        const multipartInfo = await multipartService.initiateMultipartUpload(request);

        return reply.code(201).send({
          success: true,
          message: "멀티파트 업로드가 시작되었습니다",
          data: multipartInfo,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return sendErrorResponse(reply, error.statusCode, error.message, error.data);
        }

        fastify.log.error({ error }, "Multipart initiate error");
        return sendErrorResponse(reply, 500, "multipart initiate 중 오류가 발생했습니다", {
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        });
      }
    },
  );

  fastify.put<{ Params: UploadPartParams }>(
    "/multipart/:uploadId/:partNumber",
    async function (request, reply) {
      try {
        const partInfo = await multipartService.uploadPart(request);

        return reply.code(200).send({
          success: true,
          message: "part 업로드가 완료되었습니다",
          data: partInfo,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return sendErrorResponse(reply, error.statusCode, error.message, error.data);
        }

        fastify.log.error({ error }, "Multipart part upload error");
        return sendErrorResponse(reply, 500, "part 업로드 중 오류가 발생했습니다", {
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        });
      }
    },
  );

  fastify.post<{ Params: MultipartParams }>(
    "/multipart/:uploadId/complete",
    async function (request, reply) {
      try {
        const completed = await multipartService.completeMultipartUpload(request);

        fastify.replicationQueue.registerReplicationTask(
          completed.fileInfo.bucket,
          completed.fileInfo.objectKey,
        );

        const response = createSuccessResponse(completed.fileInfo);
        return reply.code(200).send({
          ...response,
          data: {
            ...response.data,
            partCount: completed.partCount,
          },
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return sendErrorResponse(reply, error.statusCode, error.message, error.data);
        }

        fastify.log.error({ error }, "Multipart complete error");
        return sendErrorResponse(reply, 500, "multipart complete 중 오류가 발생했습니다", {
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        });
      }
    },
  );

  fastify.delete<{ Params: MultipartParams }>(
    "/multipart/:uploadId",
    async function (request, reply) {
      try {
        const uploadId = await multipartService.abortMultipartUpload(request);
        return reply.code(200).send({
          success: true,
          message: "멀티파트 업로드가 취소되었습니다",
          data: uploadId,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return sendErrorResponse(reply, error.statusCode, error.message, error.data);
        }

        fastify.log.error({ error }, "Multipart abort error");
        return sendErrorResponse(reply, 500, "multipart abort 중 오류가 발생했습니다", {
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        });
      }
    },
  );
};

export default multipart;
