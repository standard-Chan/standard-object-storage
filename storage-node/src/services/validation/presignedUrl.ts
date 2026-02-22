import { isExpired, verifySignature } from './crypto'
import { HttpError } from '../../utils/HttpError'

/**
 * 필수 파라미터 검증
 */
export function validateRequiredParams(
  bucket: string,
  objectKey: string,
  method: string,
  exp: string,
  signature: string
): void {
  if (!bucket || !objectKey || !method || !exp || !signature) {
    throw new HttpError(
      400,
      '필수 파라미터가 누락되었습니다',
      { required: ['bucket', 'objectKey', 'method', 'exp', 'signature'] }
    )
  }
}

/**
 * 만료 시간 검증
 */
export function validateExpiration(exp: string): void {
  const expTimestamp = parseInt(exp, 10)
  
  if (isNaN(expTimestamp)) {
    throw new HttpError(
      400,
      '만료 시간(exp)이 유효하지 않습니다'
    )
  }

  if (isExpired(expTimestamp)) {
    throw new HttpError(
      403,
      '요청이 만료되었습니다'
    )
  }
}

/**
 * HTTP 메서드 검증
 */
export function validateMethod(method: string, expectedMethod: string = 'PUT'): void {
  if (method.toUpperCase() !== expectedMethod.toUpperCase()) {
    throw new HttpError(
      400,
      `메서드가 일치하지 않습니다. 요청: ${expectedMethod}, 서명: ${method}`
    )
  }
}

/**
 * 서명 검증
 */
export function validateRequestSignature(
  method: string,
  bucket: string,
  key: string,
  exp: string,
  signature: string,
  secretKey: string
): void {
  const expTimestamp = parseInt(exp, 10)
  const isValidSignature = verifySignature(
    method.toUpperCase(),
    bucket,
    key,
    expTimestamp,
    signature,
    secretKey
  )

  if (!isValidSignature) {
    throw new HttpError(
      403,
      '서명이 유효하지 않습니다'
    )
  }
}
