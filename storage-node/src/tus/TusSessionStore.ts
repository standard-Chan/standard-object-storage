import Database, { Statement } from "better-sqlite3";

interface UploadRow {
  expires_at: string | null;
}
interface Logger {
  info(obj: object, msg: string): void;
}

const QUERIES = {
  UPSERT_SESSION: `
    INSERT INTO tus_uploads (id, expires_at)
    VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET
      expires_at = excluded.expires_at
  `,
  GET_EXPIRES: `
    SELECT expires_at
    FROM tus_uploads
    WHERE id = ?
  `,
  DELETE_SESSION: `
    DELETE FROM tus_uploads WHERE id = ?
  `,
  DELETE_EXPIRED: `
    DELETE FROM tus_uploads
    WHERE expires_at IS NOT NULL
      AND expires_at < datetime('now')
  `,
} as const;

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1일

/** Unix timestamp(초)를 SQLite DATETIME 형식으로 변환 */
function toDatetime(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().replace("T", " ").slice(0, 19);
}

/**
 * TUS 업로드 세션 저장소.
 * tus_uploads 테이블의 expires_at 컬럼을 통해 세션 만료·인가 검증
 */
export class TusSessionStore {
  private readonly upsertSessionStmt: Statement;
  private readonly getExpiresStmt: Statement;
  private readonly deleteSessionStmt: Statement;
  private readonly deleteExpiredStmt: Statement;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly logger: Logger | null;

  constructor(
    db: InstanceType<typeof Database>,
    intervalMs = DEFAULT_INTERVAL_MS,
    logger?: Logger,
  ) {
    this.intervalMs = intervalMs;
    this.logger = logger ?? null;
    this.upsertSessionStmt = db.prepare(QUERIES.UPSERT_SESSION);
    this.getExpiresStmt = db.prepare(QUERIES.GET_EXPIRES);
    this.deleteSessionStmt = db.prepare(QUERIES.DELETE_SESSION);
    this.deleteExpiredStmt = db.prepare(QUERIES.DELETE_EXPIRED);
  }

  /**
   * 세션 등록.
   * tus가 행을 생성하기 전에 호출해도 충돌 없이 upsert된다.
   * @param fileId   tus namingFunction이 반환하는 ID (bucket/objectKey)
   * @param expiresAt Presigned URL의 exp 값 (Unix timestamp, 초 단위)
   */
  create(fileId: string, expiresAt: number): void {
    const expiresDatetime = toDatetime(expiresAt);
    this.upsertSessionStmt.run(fileId, expiresDatetime);
  }

  /**
   * 세션 유효성 검사.
   * @returns "ok" | "not_found" | "expired"
   */
  validate(fileId: string): "ok" | "not_found" | "expired" {
    const row = this.getExpiresStmt.get(fileId) as UploadRow | undefined;
    if (!row || row.expires_at === null) return "not_found";

    const expiresMs = new Date(row.expires_at + "Z").getTime();
    if (Date.now() > expiresMs) return "expired";

    return "ok";
  }

  /**
   * 세션 삭제 (업로드 완료 또는 취소 시 호출).
   * 행 전체를 삭제한다.
   */
  delete(fileId: string): void {
    this.deleteSessionStmt.run(fileId);
  }

  /**
   * 만료된 세션 일괄 삭제.
   * expires_at이 현재 시각보다 과거인 모든 행을 삭제한다.
   * @returns 삭제된 행 수
   */
  clearExpired(): number {
    const result = this.deleteExpiredStmt.run();
    return result.changes;
  }

  /**
   * 만료 세션 정리 스케줄 시작.
   * 즉시 1회 실행 후 생성자에서 지정한 intervalMs 주기로 반복 실행한다.
   * 이미 실행 중이면 무시한다.
   */
  startCleanupSchedule(): void {
    if (this.cleanupTimer !== null) return;

    const run = () => {
      const deleted = this.clearExpired();
      this.logger?.info({ deleted }, "[TUS] 만료 세션 일괄 삭제");
    };

    run();
    this.cleanupTimer = setInterval(run, this.intervalMs);
  }

  /**
   * 만료 세션 정리 스케줄 중지.
   */
  stopCleanupSchedule(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
