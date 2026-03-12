import { randomUUID } from "node:crypto";
import { FastifyRequest } from "fastify";
import { HttpError } from "../../utils/HttpError";
import { DEFAULT_CONTENT_TYPE } from "../../constants/contentTypes";
import { FileInfo } from "../storage/fileStorage";
import {
	initMultipartUploadStorage,
	saveMultipartPart,
	removeMultipartUploadStorage,
	listMultipartParts,
	mergeMultipartParts,
} from "../storage/multipartStorage";
import {
	validateBucket,
	validateObjectKey,
	parsePartNumber,
} from "../validation/multipart";
import { validateReplicationBodyStream } from "../validation/replication";

export interface InitiateMultipartBody {
	bucket: string;
	objectKey: string;
	contentType?: string;
}

export interface MultipartParams {
	uploadId: string;
}

export interface UploadPartParams extends MultipartParams {
	partNumber: string;
}

const MULTIPART_TTL_MS = 60 * 60 * 1000;

type MultipartStatus = "INITIATED" | "COMPLETING";

interface MultipartSession {
	uploadId: string;
	bucket: string;
	objectKey: string;
	contentType: string;
	expiresAt: number;
	status: MultipartStatus;
}

const sessions = new Map<string, MultipartSession>();

export interface InitiateMultipartResult {
	uploadId: string;
	expiresAt: string;
	status: MultipartStatus;
}

export interface UploadPartResult {
	uploadId: string;
	partNumber: number;
	size: number;
	etag: string;
}

export interface CompleteMultipartResult {
	fileInfo: FileInfo;
	partCount: number;
}

async function sweepExpiredSessions(): Promise<void> {
	const now = Date.now();
	const expiredIds: string[] = [];

	for (const [uploadId, session] of sessions.entries()) {
		if (session.expiresAt <= now) {
			expiredIds.push(uploadId);
		}
	}

	await Promise.all(
		expiredIds.map(async (uploadId) => {
			sessions.delete(uploadId);
			await removeMultipartUploadStorage(uploadId);
		}),
	);
}

function getActiveSession(uploadId: string): MultipartSession {
	const session = sessions.get(uploadId);
	if (!session) {
		throw new HttpError(404, "존재하지 않는 uploadId입니다");
	}
	if (session.expiresAt <= Date.now()) {
		throw new HttpError(410, "업로드 세션이 만료되었습니다");
	}
	return session;
}

export async function initiateMultipartUpload(
	request: FastifyRequest<{ Body: InitiateMultipartBody }>,
): Promise<InitiateMultipartResult> {
	const payload = (request.body ?? {}) as Partial<InitiateMultipartBody>;
	const { bucket = "", objectKey = "", contentType } = payload;

	await sweepExpiredSessions();
	validateBucket(bucket);
	validateObjectKey(objectKey);

	const uploadId = randomUUID();
	const expiresAt = Date.now() + MULTIPART_TTL_MS;
	const session: MultipartSession = {
		uploadId,
		bucket,
		objectKey,
		contentType: contentType ?? DEFAULT_CONTENT_TYPE,
		expiresAt,
		status: "INITIATED",
	};

	await initMultipartUploadStorage(uploadId);
	sessions.set(uploadId, session);

	return {
		uploadId,
		expiresAt: new Date(expiresAt).toISOString(),
		status: session.status,
	};
}

export async function uploadPart(
	request: FastifyRequest<{ Params: UploadPartParams }>,
): Promise<UploadPartResult> {
	validateReplicationBodyStream(request.body);

	const { uploadId, partNumber: rawPartNumber } = request.params;
	const stream = request.body;

	await sweepExpiredSessions();
	const session = getActiveSession(uploadId);
	if (session.status === "COMPLETING") {
		throw new HttpError(409, "complete 처리 중에는 part 업로드를 할 수 없습니다");
	}

	const partNumber = parsePartNumber(rawPartNumber);
	const { size, etag } = await saveMultipartPart(uploadId, partNumber, stream);

	return { uploadId, partNumber, size, etag };
}

export async function completeMultipartUpload(
	request: FastifyRequest<{ Params: MultipartParams }>,
): Promise<CompleteMultipartResult> {
	const { uploadId } = request.params;

	await sweepExpiredSessions();
	const session = getActiveSession(uploadId);
	if (session.status === "COMPLETING") {
		throw new HttpError(409, "이미 complete 처리 중입니다");
	}

	session.status = "COMPLETING";

	try {
		const parts = await listMultipartParts(uploadId);
		if (parts.length === 0) {
			throw new HttpError(400, "업로드된 part가 없습니다");
		}

		const fileInfo = await mergeMultipartParts(
			session.bucket,
			session.objectKey,
			parts,
			session.contentType,
		);

		await removeMultipartUploadStorage(uploadId);
		sessions.delete(uploadId);

		return {
			fileInfo,
			partCount: parts.length,
		};
	} catch (error) {
		session.status = "INITIATED";
		throw error;
	}
}

export async function abortMultipartUpload(
	request: FastifyRequest<{ Params: MultipartParams }>,
): Promise<{ uploadId: string }> {
	const { uploadId } = request.params;

	await sweepExpiredSessions();
	getActiveSession(uploadId);

	await removeMultipartUploadStorage(uploadId);
	sessions.delete(uploadId);

	return { uploadId };
}

export function __resetMultipartSessionsForTests(): void {
	sessions.clear();
}
