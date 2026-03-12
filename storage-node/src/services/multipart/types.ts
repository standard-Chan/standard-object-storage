import { FileInfo } from "../storage/fileStorage";
import { MultipartStatus } from "./sessionStore/SessionStore";

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
