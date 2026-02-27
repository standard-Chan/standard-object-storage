/* replication_queue 테이블 DDL */
export const CREATE_REPLICATION_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS replication_queue (
    bucket            TEXT     NOT NULL,
    objectKey         TEXT     NOT NULL,

    firstAttemptAt    DATETIME NOT NULL,
    lastTriedAt       DATETIME,

    retryCount        INTEGER  NOT NULL DEFAULT 0,
    nextRetryAt       DATETIME NOT NULL,

    status            TEXT     NOT NULL,

    lastErrorType       TEXT,
    lastErrorMessage    TEXT,

    PRIMARY KEY (bucket, objectKey)
  )
` as const;
