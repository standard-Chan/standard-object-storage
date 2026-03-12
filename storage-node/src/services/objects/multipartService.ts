import path from "node:path";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { HttpError } from "../../utils/HttpError";
import { DEFAULT_CONTENT_TYPE } from "../../constants/contentTypes";
import {
	collectStreamFileInfo,
	FileInfo,
	generateETag,
} from "../storage/fileStorage";
import {
	validateBucket,
	validateObjectKey,
	parsePartNumber,
} from "../validation/multipart";

const MULTIPART_TTL_MS = 60 * 60 * 1000;
const MULTIPART_ROOT_DIR = path.join(process.cwd(), "uploads", ".multipart");

type MultipartStatus = "INITIATED" | "COMPLETING";

interface MultipartSession {
	uploadId: string;
	bucket: string;
	objectKey: string;
	contentType: string;
	expiresAt: number;
	status: MultipartStatus;
}

interface PartMeta {
	partNumber: number;
	path: string;
	size: number;
	etag: string;
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

function getUploadDir(uploadId: string): string {
	return path.join(MULTIPART_ROOT_DIR, uploadId);
}

function getPartsDir(uploadId: string): string {
	return path.join(getUploadDir(uploadId), "parts");
}

async function removeUploadDirectory(uploadId: string): Promise<void> {
	await fsPromises.rm(getUploadDir(uploadId), {
		recursive: true,
		force: true,
	});
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
			await removeUploadDirectory(uploadId);
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

async function listDiskParts(uploadId: string): Promise<PartMeta[]> {
	const partsDir = getPartsDir(uploadId);
	let entries: fs.Dirent[];

	try {
		entries = await fsPromises.readdir(partsDir, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}

	const partFiles = entries
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name)
		.map((filename) => {
			const match = /^(\d+)\.part$/.exec(filename);
			if (!match) {
				return null;
			}
			return {
				partNumber: Number.parseInt(match[1], 10),
				partPath: path.join(partsDir, filename),
			};
		})
		.filter((value): value is { partNumber: number; partPath: string } => value !== null)
		.sort((a, b) => a.partNumber - b.partNumber);

	const metaList: PartMeta[] = [];
	for (const part of partFiles) {
		const stat = await fsPromises.stat(part.partPath);
		const etag = await generateETag(part.partPath);
		metaList.push({
			partNumber: part.partNumber,
			path: part.partPath,
			size: stat.size,
			etag,
		});
	}

	return metaList;
}

export async function initiateMultipartUpload(
	bucket: string,
	objectKey: string,
	contentType?: string,
): Promise<InitiateMultipartResult> {
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

	await fsPromises.mkdir(getPartsDir(uploadId), { recursive: true });
	sessions.set(uploadId, session);

	return {
		uploadId,
		expiresAt: new Date(expiresAt).toISOString(),
		status: session.status,
	};
}

export async function uploadPart(
	uploadId: string,
	rawPartNumber: string,
	stream: Readable,
): Promise<UploadPartResult> {
	await sweepExpiredSessions();
	const session = getActiveSession(uploadId);
	if (session.status === "COMPLETING") {
		throw new HttpError(409, "complete 처리 중에는 part 업로드를 할 수 없습니다");
	}

	const partNumber = parsePartNumber(rawPartNumber);
	const partPath = path.join(getPartsDir(uploadId), `${partNumber}.part`);
	const tempPath = `${partPath}.tmp-${Date.now()}`;

	await fsPromises.mkdir(path.dirname(partPath), { recursive: true });

	try {
		await pipeline(stream, fs.createWriteStream(tempPath));
		await fsPromises.rename(tempPath, partPath);
	} catch (error) {
		await fsPromises.rm(tempPath, { force: true });
		throw error;
	}

	const stat = await fsPromises.stat(partPath);
	const etag = await generateETag(partPath);

	return {
		uploadId,
		partNumber,
		size: stat.size,
		etag,
	};
}

export async function completeMultipartUpload(
	uploadId: string,
): Promise<CompleteMultipartResult> {
	await sweepExpiredSessions();
	const session = getActiveSession(uploadId);
	if (session.status === "COMPLETING") {
		throw new HttpError(409, "이미 complete 처리 중입니다");
	}

	session.status = "COMPLETING";

	try {
		const parts = await listDiskParts(uploadId);
		if (parts.length === 0) {
			throw new HttpError(400, "업로드된 part가 없습니다");
		}

		const finalPath = path.join(
			process.cwd(),
			"uploads",
			session.bucket,
			session.objectKey,
		);
		const finalDir = path.dirname(finalPath);
		const tempFinalPath = `${finalPath}.multipart-tmp-${Date.now()}`;

		await fsPromises.mkdir(finalDir, { recursive: true });
		await fsPromises.writeFile(tempFinalPath, "");

		for (const part of parts) {
			await pipeline(
				fs.createReadStream(part.path),
				fs.createWriteStream(tempFinalPath, { flags: "a" }),
			);
		}

		await fsPromises.rename(tempFinalPath, finalPath);

		const fileInfo = await collectStreamFileInfo(
			session.bucket,
			session.objectKey,
			finalPath,
			session.contentType,
		);

		await removeUploadDirectory(uploadId);
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
	uploadId: string,
): Promise<{ uploadId: string }> {
	await sweepExpiredSessions();
	getActiveSession(uploadId);

	await removeUploadDirectory(uploadId);
	sessions.delete(uploadId);

	return { uploadId };
}

export function __resetMultipartSessionsForTests(): void {
	sessions.clear();
}
