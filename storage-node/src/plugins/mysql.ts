import fp from 'fastify-plugin'
import fastifyMysql, { FastifyMySQLOptions } from '@fastify/mysql'

/**
 * MySQL 데이터베이스 연결 플러그인
 */
export interface MySQLPluginOptions extends FastifyMySQLOptions {
  // 추가 옵션이 필요한 경우 여기에 정의
}

export default fp<MySQLPluginOptions>(async (fastify) => {
  const mysqlOptions: FastifyMySQLOptions = {
    promise: true,
    connectionString: buildMySQLConnectionString(),
  }

  fastify.register(fastifyMysql, mysqlOptions)

  // 서버 시작 시 연결 테스트
  fastify.addHook('onReady', async function () {
    try {
      const connection = await fastify.mysql.getConnection()
      fastify.log.info('MySQL 데이터베이스에 성공적으로 연결되었습니다')
      connection.release()
    } catch (err) {
      fastify.log.error({ err }, 'MySQL 연결 실패')
      throw err
    }
  })

  // 서버 종료 시 연결 정리
  fastify.addHook('onClose', async (instance) => {
    await instance.mysql.pool.end()
    instance.log.info('MySQL 연결이 종료되었습니다')
  })
})

function buildMySQLConnectionString(): string {
  if (process.env.MYSQL_CONNECTION_STRING) {
    return process.env.MYSQL_CONNECTION_STRING
  }

  const user = process.env.MYSQL_USER || 'root'
  const password = process.env.MYSQL_PASSWORD || 'password'
  const host = process.env.MYSQL_HOST || 'localhost'
  const port = process.env.MYSQL_PORT || '3306'
  const database = process.env.MYSQL_DATABASE || 'test'

  return `mysql://${user}:${password}@${host}:${port}/${database}`
}
