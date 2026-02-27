import { FastifyBaseLogger } from "fastify";
import { ReplicationQueueRepository } from "../../repository/replicationQueue";
import { replicateToSecondary } from "./replicateToSecondary";
import { classifyReplicationError } from "./classifyError";

const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 5;

let timerId: ReturnType<typeof setInterval> | null = null;

/**
 * 단일 poll 실행.
 * inFlight 플래그로 중복 실행을 방지하고, 배치 내 항목을 순차 처리한다.
 */
async function runOnePoll(
  replicationQueue: ReplicationQueueRepository,
  log: FastifyBaseLogger,
): Promise<void> {
  const batch = replicationQueue.fetchRetryBatch(BATCH_SIZE);

  if (batch.length === 0) return;

  log.debug({ count: batch.length }, "[retryWorker] 복제 재시도 시작");

  for (const row of batch) {
    const { bucket, objectKey } = row;

    try {
      await replicateToSecondary(bucket, objectKey, log);
    } catch (err) {
      const errorType = classifyReplicationError(err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "알 수 없는 오류";

      replicationQueue.updateOnRetryFailure(
        bucket,
        objectKey,
        errorType,
        errorMessage,
      );

      log.warn(
        { bucket, objectKey, errorType, errorMessage },
        "[retryWorker] 복제 재시도 실패",
      );
      continue;
    }

    try {
      replicationQueue.deleteOnSuccess(bucket, objectKey);
      log.info({ bucket, objectKey }, "[retryWorker] 복제 성공 - row 삭제");
    } catch (err) {
      log.error(
        { bucket, objectKey, error: err },
        "[retryWorker] 복제 성공 후 row 삭제 실패 (DB 오류)",
      );
    }
  }
}

/**
 * Replication Retry Worker 시작.
 *
 * - POLL_INTERVAL(1초)마다 replication_queue를 polling
 * - inFlight 플래그로 이전 poll이 끝나기 전 다음 poll 진입을 방지
 * - 앱 시작 시 단 한 번만 호출해야 한다
 */
export function startReplicationRetryWorker(
  replicationQueue: ReplicationQueueRepository,
  log: FastifyBaseLogger,
): void {
  if (timerId !== null) {
    log.warn("[retryWorker] 이미 실행 중입니다");
    return;
  }

  let inFlight = false;

  timerId = setInterval(async () => {
    if (inFlight) return;

    inFlight = true;
    try {
      await runOnePoll(replicationQueue, log);
    } catch (error) {
      log.error({ error }, "[retryWorker] poll 중 예상치 못한 오류 발생");
    } finally {
      inFlight = false;
    }
  }, POLL_INTERVAL_MS);

  log.info(
    { pollIntervalMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE },
    "[retryWorker] 시작",
  );
}

/**
 * Replication Retry Worker 중단.
 * 앱 종료(onClose) 훅에서 호출한다.
 */
export function stopReplicationRetryWorker(log: FastifyBaseLogger): void {
  if (timerId === null) return;

  clearInterval(timerId);
  timerId = null;
  log.info("[retryWorker] 중단");
}
