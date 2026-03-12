import { removeMultipartUploadStorage } from "../../storage/multipartStorage";
import { HttpError } from "../../../utils/HttpError";
import { IMultipartSessionStore, MultipartSession } from "./SessionStore";

export class InMemoryMultipartSessionStore implements IMultipartSessionStore {
  private static instance: InMemoryMultipartSessionStore;
  private sessions = new Map<string, MultipartSession>();

  private constructor() {}

  static getInstance(): InMemoryMultipartSessionStore {
    if (!InMemoryMultipartSessionStore.instance) {
      InMemoryMultipartSessionStore.instance = new InMemoryMultipartSessionStore();
    }
    return InMemoryMultipartSessionStore.instance;
  }

  getActiveSession(uploadId: string): MultipartSession {
    const session = this.sessions.get(uploadId);
    if (!session) {
      throw new HttpError(404, "존재하지 않는 uploadId입니다");
    }
    if (session.expiresAt <= Date.now()) {
      this.delete(uploadId);
      throw new HttpError(410, "업로드 세션이 만료되었습니다");
    }
    return session;
  }

  set(uploadId: string, session: MultipartSession): void {
    this.sessions.set(uploadId, session);
  }

  delete(uploadId: string): void {
    this.sessions.delete(uploadId);
  }

  entries(): IterableIterator<[string, MultipartSession]> {
    return this.sessions.entries();
  }

  sweepExpired(): string[] {
    const now = Date.now();
    const expiredIds: string[] = [];
    for (const [uploadId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        expiredIds.push(uploadId);
      }
    }
    for (const uploadId of expiredIds) {
      this.sessions.delete(uploadId);
    }
    return expiredIds;
  }

  async sweepExpiredUploads(): Promise<void> {
    const expiredIds = this.sweepExpired();
    await Promise.all(
      expiredIds.map((uploadId) => removeMultipartUploadStorage(uploadId)),
    );
  }

  clear(): void {
    this.sessions.clear();
  }
}
