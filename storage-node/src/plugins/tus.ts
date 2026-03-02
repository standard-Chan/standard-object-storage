import fp from "fastify-plugin";
import { Server as TusServer, FileStore, EVENTS } from "tus-node-server";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

/**
 * TUS 프로토콜 서버 플러그인 (이력 재개 업로드)
 *
 * - 업로드 파일은 uploads/tus-test/ 에 저장됩니다.
 * - tus 클라이언트가 사용하는 Content-Type(application/offset+octet-stream)을
 *   Fastify body parser 없이 통과시킵니다.
 * - fastify.tusServer 데코레이터로 인스턴스를 노출합니다.
 */
export default fp(async (fastify) => {
  // 업로드 저장 디렉토리
  const uploadDir = join(process.cwd(), "uploads", "tus-test");
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  // TUS 서버 생성 (path 는 클라이언트가 호출할 base path)
  const tusServer = new TusServer({ path: "/tus-upload" });
  tusServer.datastore = new FileStore({ directory: uploadDir });

  // 업로드 이벤트 로깅
  tusServer.on(EVENTS.EVENT_FILE_CREATED, (event) => {
    fastify.log.info(
      { fileId: event.file?.id,
        filePath: `${join(uploadDir, event.file?.id)}`
       },
      "[TUS] 업로드 파일 생성됨",
    );
  });

  tusServer.on(EVENTS.EVENT_UPLOAD_COMPLETE, (event) => {
    fastify.log.info(
      { fileId: event.file?.id },
      "[TUS] 업로드 완료",
    );
  });

  // tus PATCH 요청이 사용하는 Content-Type 을 body parser 없이 통과
  fastify.addContentTypeParser(
    "application/offset+octet-stream",
    (_request, _payload, done) => done(null),
  );

  // 다른 플러그인 / 라우트에서 fastify.tusServer 로 접근 가능
  fastify.decorate("tusServer", tusServer);
});
