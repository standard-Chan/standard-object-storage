import dotenv from "dotenv";
import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";

dotenv.config();
export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
// CLI 명령어를 통해 --options 인자로 추가 옵션 전달하는 용도
const options: AppOptions = {};

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
};

export default app;
export { app, options };
