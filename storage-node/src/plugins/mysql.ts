import fp from "fastify-plugin";
import fastifyMysql, { FastifyMySQLOptions } from "@fastify/mysql";

/**
 * MySQL 데이터베이스 연결 플러그인
 */
export interface MySQLPluginOptions extends FastifyMySQLOptions {
  // 추가 옵션이 필요한 경우 여기에 정의
}

export default fp<MySQLPluginOptions>(async (fastify) => {
  // 환경변수로 MySQL 사용 여부 결정 (기본값: true)
  const enableMySQL = process.env.ENABLE_MYSQL !== "false";

  if (!enableMySQL) {
    fastify.log.info("MySQL plugin is disabled by ENABLE_MYSQL environment variable");
    return;
  }

  const mysqlOptions: FastifyMySQLOptions = {
    promise: true,
    connectionString: buildMySQLConnectionString(),

    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
  };

  fastify.register(fastifyMysql, mysqlOptions);

  // 서버 시작 시 연결 테스트
  fastify.addHook("onReady", async function () {
    try {
      const connection = await fastify.mysql.getConnection();
      fastify.log.info("MySQL database connection established successfully");
      connection.release();
    } catch (err) {
      fastify.log.error({ err }, "MySQL connection failed");
      throw err;
    }
  });

  // 서버 종료 시 연결 정리
  fastify.addHook("onClose", async (instance) => {
    await instance.mysql.pool.end();
    instance.log.info("MySQL connection closed");
  });
});

/** 연결 설정 string */
function buildMySQLConnectionString(): string {
  if (process.env.MYSQL_CONNECTION_STRING) {
    return process.env.MYSQL_CONNECTION_STRING;
  }

  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "password";
  const host = process.env.MYSQL_HOST || "localhost";
  const port = process.env.MYSQL_PORT || "3306";
  const database = process.env.MYSQL_DATABASE || "test";

  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}
