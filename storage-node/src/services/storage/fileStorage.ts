import path from 'path'
import { promises as fsPromises } from 'fs'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { MultipartFile } from '@fastify/multipart'
import crypto from 'crypto'
import { HttpError } from '../../utils/HttpError'

/**
 * 객체 상태 enum
 */
export enum ObjectStatus {
  PENDING = 'PENDING',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED'
}

/**
 * 파일 정보 타입
 */
export interface FileInfo {
  bucket: string
  objectKey: string
  filename: string
  mimetype: string
  encoding: string
  size: number
  uploadedAt: string
  storagePath: string
  etag?: string
}

/**
 * 파일 업로드 데이터 검증
 */
export function validateFileData(data: MultipartFile | undefined): void {
  if (!data) {
    throw new HttpError(
      400,
      '파일이 업로드되지 않았습니다'
    )
  }
}

/**
 * 파일을 로컬 파일시스템에 저장
 */
export async function saveFileToStorage(
  bucket: string,
  objectKey: string,
  fileData: MultipartFile
): Promise<string> {
  const filePath = path.join(process.cwd(), 'uploads', bucket, objectKey)
  const fileDir = path.dirname(filePath)

  // 디렉토리 생성 (없으면)
  await fsPromises.mkdir(fileDir, { recursive: true })

  // 파일 저장
  await pipeline(fileData.file, fs.createWriteStream(filePath))

  return filePath
}

/**
 * 파일 정보 수집
 */
export async function collectFileInfo(
  bucket: string,
  objectKey: string,
  filePath: string,
  fileData: MultipartFile
): Promise<FileInfo> {
  const fileStats = await fsPromises.stat(filePath)
  const etag = await generateETag(filePath)
  
  return {
    bucket,
    objectKey: objectKey,
    filename: fileData.filename,
    mimetype: fileData.mimetype,
    encoding: fileData.encoding,
    size: fileStats.size,
    uploadedAt: new Date().toISOString(),
    storagePath: filePath,
    etag
  }
}

/**
 * 파일의 SHA-256 해시를 생성하여 ETag로 사용
 */
export async function generateETag(filePath: string): Promise<string> {
  const fileBuffer = await fsPromises.readFile(filePath)
  const hash = crypto.createHash('sha256')
  hash.update(fileBuffer)
  return hash.digest('hex')
}

/**
 * 저장된 파일 삭제 (롤백용)
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fsPromises.unlink(filePath)
  } catch (error) {
    // 파일이 없어도 무시
  }
}

/**
 * 객체가 이미 존재하는지 확인
 */
export async function checkObjectExists(
  mysql: any,
  bucketId: number,
  objectKey: string,
  bucket: string
): Promise<void> {
  const connection = await mysql.getConnection()
  try {
    const [rows] = await connection.query(
      'SELECT COUNT(*) as count FROM tb_objects WHERE bucket_id = ? AND object_key = ? LIMIT 1',
      [bucketId, objectKey]
    )
    if (rows[0].count > 0) {
      throw new HttpError(
        409,
        `이미 존재하는 객체입니다: ${bucket}/${objectKey}`
      )
    }
  } finally {
    connection.release()
  }
}

/**
 * Bucket 이름으로 Bucket ID 조회
 */
export async function getBucketIdByName(
  mysql: any,
  bucketName: string
): Promise<number> {
  const connection = await mysql.getConnection()
  try {
    const [rows] = await connection.query(
      'SELECT id FROM tb_buckets WHERE name = ? LIMIT 1',
      [bucketName]
    )
    
    if (!rows || rows.length === 0) {
      throw new HttpError(
        404,
        `버킷을 찾을 수 없습니다: ${bucketName}`
      )
    }
    return rows[0].id
  } finally {
    connection.release()
  }
}

/**
 * MySQL에 StoredObject 메타데이터 저장
 * 
 * @param mysql - MySQL 연결 객체
 * @param bucketId - Bucket ID
 * @param fileInfo - 파일 정보
 * @returns 생성된 StoredObject의 UUID
 */
export async function saveMetadataToDatabase(
  mysql: any,
  bucketId: number,
  fileInfo: FileInfo
): Promise<string> {
  const connection = await mysql.getConnection()
  try {
    // UUID 생성
    const objectId = crypto.randomUUID()
    const now = new Date()

    // TB_OBJECTS에 데이터 삽입
    await connection.query(
      `INSERT INTO tb_objects
        (id, bucket_id, object_key, storage_path, size, etag, status, created_at, updated_at) 
       VALUES 
        (UNHEX(REPLACE(?, '-', '')), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        objectId,
        bucketId,
        fileInfo.objectKey,
        fileInfo.storagePath,
        fileInfo.size,
        fileInfo.etag,
        ObjectStatus.COMPLETE,
        now,
        now
      ]
    )

    return objectId
  } catch (error: any) {
    // 중복 키 에러 처리
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error(`이미 존재하는 객체입니다: ${fileInfo.bucket}/${fileInfo.objectKey}`)
    }
    throw error
  } finally {
    connection.release()
  }
}
