import { FastifyPluginAsync } from "fastify";
import {
  createSuccessResponse,
  sendErrorResponse,
} from "../services/response/apiResponse";
import { HttpError } from "../utils/HttpError";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  initiateMultipartUpload,
  uploadPart,
} from "../services/objects/multipartService";
import { validateReplicationBodyStream } from "../services/validation/replication";

interface InitiateMultipartBody {
  bucket: string;
  objectKey: string;
  contentType?: string;
}

interface MultipartParams {
  uploadId: string;
}

interface UploadPartParams extends MultipartParams {
  partNumber: string;
}

const multipart: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.addContentTypeParser("*", function (_request, payload, done) {
    done(null, payload);
  });

  fastify.post<{ Body: InitiateMultipartBody }>(
    "/multipart/initiate",
    async function (request, reply) {
      try {
        const payload = (request.body ?? {}) as Partial<InitiateMultipartBody>;
        const { bucket, objectKey, contentType } = payload;
        const result = await initiateMultipartUpload(
          bucket ?? "",
          objectKey ?? "",
          contentType,
        );

        return reply.code(201).send({
          success: true,
          message: "멀티파트 업로드가 시작되었습니다",
          data: result,
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
        validateReplicationBodyStream(request.body);

        const result = await uploadPart(
          request.params.uploadId,
          request.params.partNumber,
          request.body,
        );

        return reply.code(200).send({
          success: true,
          message: "part 업로드가 완료되었습니다",
          data: result,
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
        const result = await completeMultipartUpload(request.params.uploadId);

        fastify.replicationQueue.registerReplicationTask(
          result.fileInfo.bucket,
          result.fileInfo.objectKey,
        );

        const response = createSuccessResponse(result.fileInfo);
        return reply.code(200).send({
          ...response,
          data: {
            ...response.data,
            partCount: result.partCount,
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
        const result = await abortMultipartUpload(request.params.uploadId);
        return reply.code(200).send({
          success: true,
          message: "멀티파트 업로드가 취소되었습니다",
          data: result,
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
