import { isExpired, verifySignature } from '../../utils/crypto'

/**
 * 검증 결과 타입
 */
export interface ValidationResult {
  isValid: boolean
  error?: {
    code: number
    message: string
    data?: any
  }
}

/**
 * 필수 파라미터 검증
 */
export function validateRequiredParams(
  bucket: string,
  key: string,
  method: string,
  exp: string,
  signature: string
): ValidationResult {
  if (!bucket || !key || !method || !exp || !signature) {
    return {
      isValid: false,
      error: {
        code: 400,
        message: '필수 파라미터가 누락되었습니다',
        data: { required: ['bucket', 'key', 'method', 'exp', 'signature'] }
      }
    }
  }
  return { isValid: true }
}

/**
 * 만료 시간 검증
 */
export function validateExpiration(exp: string): ValidationResult {
  const expTimestamp = parseInt(exp, 10)
  
  if (isNaN(expTimestamp)) {
    return {
      isValid: false,
      error: {
        code: 400,
        message: '만료 시간(exp)이 유효하지 않습니다'
      }
    }
  }

  if (isExpired(expTimestamp)) {
    return {
      isValid: false,
      error: {
        code: 403,
        message: '요청이 만료되었습니다'
      }
    }
  }

  return { isValid: true }
}

/**
 * HTTP 메서드 검증
 */
export function validateMethod(method: string, expectedMethod: string = 'PUT'): ValidationResult {
  if (method.toUpperCase() !== expectedMethod.toUpperCase()) {
    return {
      isValid: false,
      error: {
        code: 400,
        message: `메서드가 일치하지 않습니다. 요청: ${expectedMethod}, 서명: ${method}`
      }
    }
  }
  return { isValid: true }
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
): ValidationResult {
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
    return {
      isValid: false,
      error: {
        code: 403,
        message: '서명이 유효하지 않습니다'
      }
    }
  }

  return { isValid: true }
}
