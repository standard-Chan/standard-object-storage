import dotenv from "dotenv";
import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";
import {
  startReplicationRetryWorker,
  stopReplicationRetryWorker,
} from "./services/replication/replicationRetryWorker";

dotenv.config();
export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
// CLI 명령어를 통해 --options 인자로 추가 옵션 전달하는 용도
const options: AppOptions = {
  disableRequestLogging: true,
};

/**
 *  Fastify 앱의 메인 플러그인 함수
 * @param fastify Fastify 인스턴스 (서버 객체)
 * @param opts 전달받은 옵션들
 */
const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  void fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
  });

  // Primary 노드만 replication retry worker 실행
  if (process.env.ROLE === "primary") {
    fastify.addHook("onReady", function (done) {
      startReplicationRetryWorker(fastify.replicationQueue, fastify.log);
      done();
    });

    fastify.addHook("onClose", function (_instance, done) {
      stopReplicationRetryWorker(fastify.log);
      done();
    });
  } else {
    fastify.log.info(
      `[retryWorker] ROLE=${process.env.ROLE ?? "(unset)"} - worker 비활성화`,
    );
  }
};

export default app;
export { app, options };
