import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import { MB, GB } from '../constants/sizes'

/**
 * Multipart/form-data 파일 업로드 플러그인
 * 
 * 이 플러그인은 파일 업로드 기능을 활성화합니다.
 * - 최대 파일 크기, 필드 크기 등을 설정할 수 있습니다.
 * - 라우트에서 request.file() 또는 request.files()로 파일을 받을 수 있습니다.
 */
export default fp(async (fastify) => {
  fastify.register(multipart, {
    limits: {
      fieldNameSize: 100,       // 필드명 최대 크기 (바이트)
      fieldSize: 1 * MB,        // 필드 값 최대 크기 (1MB)
      fields: 10,               // 비파일 필드 최대 개수
      fileSize: 1 * GB,         // 파일 최대 크기 (1GB)
      files: 1,                 // 파일 최대 개수
      headerPairs: 2000,        // 헤더 키-값 쌍 최대 개수
      parts: 1000               // 파트 최대 개수
    }
  })
})
