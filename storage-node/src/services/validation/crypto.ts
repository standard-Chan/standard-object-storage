import crypto from 'crypto'

/**
 * HMAC SHA256 방식으로 데이터를 암호화하고 Base64 URL 인코딩합니다.
 * Java의 CryptoUtils.hmacSha256Base64Url과 동일한 방식으로 동작합니다.
 * 
 * @param data - 암호화할 데이터
 * @param secret - 비밀 키
 * @returns Base64 URL 인코딩된 HMAC SHA256 서명 (padding 없음)
 * 
 * @example
 * const signature = hmacSha256Base64Url('PUT|photos|picture/a.jpg|1771477681', 'my-secret-key')
 */
export function hmacSha256Base64Url(data: string, secret: string): string {
  try {
    // HMAC SHA256 생성
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(data, 'utf8')
    
    // Base64 URL 인코딩 (padding 제거)
    const signature = hmac
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    
    return signature
  } catch (error) {
    throw new Error(`HMAC SHA256 서명 생성 실패: ${error}`)
  }
}

/**
 * Presigned URL의 signature를 검증합니다.
 * Java의 PresignedUrlService와 동일한 형식으로 서명 데이터를 생성합니다.
 * 
 * @param method - HTTP 메서드 (PUT, GET 등)
 * @param bucket - 버킷 이름
 * @param objectKey - 객체 키 (경로)
 * @param exp - 만료 시간 (Unix timestamp)
 * @param signature - 검증할 서명
 * @param secret - 비밀 키
 * @returns 서명이 유효하면 true, 그렇지 않으면 false
 */
export function verifySignature(
  method: string,
  bucket: string,
  objectKey: string,
  exp: number,
  fileSize: string,
  signature: string,
  secret: string
): boolean {
  // 서명 데이터 생성: bucket=...&objectKey=...&method=...&exp=...&fileSize=...
  // Java의 PresignedUrlService.generateSignature()와 동일한 형식
  const data = `bucket=${bucket}&objectKey=${objectKey}&method=${method}&exp=${exp}&fileSize=${fileSize}`
  
  // 기대하는 서명 생성
  const expectedSignature = hmacSha256Base64Url(data, secret)
  
  // 타이밍 공격 방지를 위한 안전한 비교
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    // Buffer 길이가 다르면 false 반환
    console.error('timingSafeEqual 오류 (길이 불일치):', error)
    return false
  }
}

/**
 * 만료 시간 검증
 * 
 * @param exp - 만료 시간 (Unix timestamp, 초 단위)
 * @returns 만료되지 않았으면 true, 만료되었으면 false
 */
export function isExpired(exp: number): boolean {
  const now = Math.floor(Date.now() / 1000) // 현재 시간을 초 단위로 변환
  return now > exp
}
