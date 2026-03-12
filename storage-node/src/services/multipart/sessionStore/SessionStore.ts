export type MultipartStatus = "INITIATED" | "COMPLETING";

export interface MultipartSession {
  uploadId: string;
  bucket: string;
  objectKey: string;
  contentType: string;
  expiresAt: number;
  status: MultipartStatus;
}

export interface IMultipartSessionStore {
  /** uploadId로 활성 세션을 조회한다. 세션이 없으면 404, 만료되었으면 410 에러를 던진다. */
  getActiveSession(uploadId: string): MultipartSession;

  /** 새 세션을 저장한다. */
  set(uploadId: string, session: MultipartSession): void;

  /** 세션을 삭제한다. */
  delete(uploadId: string): void;

  /** 저장된 모든 세션을 순회할 수 있는 이터레이터를 반환한다. */
  entries(): IterableIterator<[string, MultipartSession]>;

  /** 만료된 세션을 스토어에서 제거하고, 연관된 임시 파일도 정리한다. */
  sweepExpiredUploads(): Promise<void>;

  /** 모든 세션을 초기화한다. (테스트 용도) */
  clear(): void;
}
