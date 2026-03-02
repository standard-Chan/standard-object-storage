import { FastifyPluginAsync } from "fastify";

/**
 * TUS 프로토콜 테스트 라우트
 *
 * POST   /tus-upload        → 업로드 세션 생성 (Location 헤더로 파일 URL 반환)
 * PATCH  /tus-upload/:id    → 파일 청크 업로드 (이어받기)
 * HEAD   /tus-upload/:id    → 현재 업로드 오프셋 확인
 * DELETE /tus-upload/:id    → 업로드 중단 및 파일 삭제
 *
 * 모든 요청은 fastify.tusServer 에 위임됩니다.
 */
const tusRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  // OPTIONS 포함 모든 메서드: /tus-upload (업로드 세션 생성)
  fastify.all("/tus-upload", (req, res) => {
    fastify.tusServer.handle(req.raw, res.raw);
  });

  // OPTIONS 포함 모든 메서드: /tus-upload/:fileId (청크 업로드 / 상태 조회 / 삭제)
  fastify.all("/tus-upload/*", (req, res) => {
    fastify.tusServer.handle(req.raw, res.raw);
  });
};

export default tusRoutes;
