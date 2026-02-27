import type Database from "better-sqlite3";

export type ReplicationStatus = "RETRYABLE" | "FAILED_PERM";

export type ErrorType = "HTTP_NON_2XX" | "TIMEOUT" | "NETWORK" | "UNKNOWN";

const MAX_RETRY = 10;
const RETRY_INTERVAL_MS = 10_000;

export interface ReplicationQueueRow {
  bucket: string;
  objectKey: string;
  firstAttemptAt: string;
  lastTriedAt: string | null;
  retryCount: number;
  nextRetryAt: string;
  status: ReplicationStatus;
  lastErrorType: ErrorType | null;
  lastErrorMessage: string | null;
}

export interface ReplicationQueueRepository {
  /**
   * 업로드 경로에서 복제 실패 시 호출.
   * - row 없으면 INSERT (retryCount = 0)
   * - row 있으면 retryCount++, nextRetryAt 갱신
   */
  upsertOnFailure(
    bucket: string,
    objectKey: string,
    errorType: ErrorType,
    errorMessage: string,
  ): void;

  /**
   * status = RETRYABLE & nextRetryAt <= now 인 row를
   * nextRetryAt ASC 순서로 최대 batchSize 개 반환
   */
  fetchRetryBatch(batchSize: number): ReplicationQueueRow[];

  /** 재시도 복제 성공 시 row 삭제 */
  deleteOnSuccess(bucket: string, objectKey: string): void;

  /**
   * 재시도 복제 실패 시 호출.
   * retryCount++, nextRetryAt 갱신, MAX_RETRY 초과 시 FAILED_PERM
   */
  updateOnRetryFailure(
    bucket: string,
    objectKey: string,
    errorType: ErrorType,
    errorMessage: string,
  ): void;
}

// ---------- helper ----------

function nowIso(): string {
  return new Date().toISOString();
}

function nextRetryIso(): string {
  return new Date(Date.now() + RETRY_INTERVAL_MS).toISOString();
}

// ---------- factory ----------

export function createReplicationQueueRepository(
  db: InstanceType<typeof Database>,
): ReplicationQueueRepository {
  const upsertStmt = db.prepare(`
    INSERT INTO replication_queue
      (bucket, objectKey, firstAttemptAt, lastTriedAt, retryCount, nextRetryAt,
       status, lastErrorType, lastErrorMessage)
    VALUES
      (@bucket, @objectKey, @now, @now, 0, @nextRetryAt,
       'RETRYABLE', @errorType, @errorMessage)
    ON CONFLICT(bucket, objectKey) DO UPDATE SET
      retryCount       = replication_queue.retryCount + 1,
      lastTriedAt      = @now,
      nextRetryAt      = @nextRetryAt,
      status           = CASE
                           WHEN replication_queue.retryCount + 1 >= ${MAX_RETRY}
                           THEN 'FAILED_PERM'
                           ELSE 'RETRYABLE'
                         END,
      lastErrorType    = @errorType,
      lastErrorMessage = @errorMessage
  `);

  const fetchBatchStmt = db.prepare(`
    SELECT *
    FROM   replication_queue
    WHERE  status = 'RETRYABLE'
      AND  nextRetryAt <= @now
    ORDER  BY nextRetryAt ASC
    LIMIT  @batchSize
  `);

  const deleteStmt = db.prepare(`
    DELETE FROM replication_queue
    WHERE bucket = @bucket AND objectKey = @objectKey
  `);

  const updateOnRetryFailureStmt = db.prepare(`
    UPDATE replication_queue
    SET
      retryCount       = retryCount + 1,
      lastTriedAt      = @now,
      nextRetryAt      = @nextRetryAt,
      status           = CASE
                           WHEN retryCount + 1 >= ${MAX_RETRY}
                           THEN 'FAILED_PERM'
                           ELSE 'RETRYABLE'
                         END,
      lastErrorType    = @errorType,
      lastErrorMessage = @errorMessage
    WHERE bucket = @bucket AND objectKey = @objectKey
  `);

  return {
    upsertOnFailure(bucket, objectKey, errorType, errorMessage) {
      upsertStmt.run({
        bucket,
        objectKey,
        now: nowIso(),
        nextRetryAt: nextRetryIso(),
        errorType,
        errorMessage,
      });
    },

    fetchRetryBatch(batchSize) {
      return fetchBatchStmt.all({
        now: nowIso(),
        batchSize,
      }) as ReplicationQueueRow[];
    },

    deleteOnSuccess(bucket, objectKey) {
      deleteStmt.run({ bucket, objectKey });
    },

    updateOnRetryFailure(bucket, objectKey, errorType, errorMessage) {
      updateOnRetryFailureStmt.run({
        bucket,
        objectKey,
        now: nowIso(),
        nextRetryAt: nextRetryIso(),
        errorType,
        errorMessage,
      });
    },
  };
}
