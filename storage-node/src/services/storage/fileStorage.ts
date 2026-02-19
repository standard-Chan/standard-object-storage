import path from 'path'
import { promises as fsPromises } from 'fs'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { MultipartFile } from '@fastify/multipart'
import crypto from 'crypto'

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
export function validateFileData(data: MultipartFile | undefined): {
  isValid: boolean
  error?: { code: number; message: string }
} {
  if (!data) {
    return {
      isValid: false,
      error: {
        code: 400,
        message: '파일이 업로드되지 않았습니다'
      }
    }
  }
  return { isValid: true }
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
 * Bucket 이름으로 Bucket ID 조회
 */
export async function getBucketIdByName(
  mysql: any,
  bucketName: string
): Promise<number | null> {
  const connection = await mysql.getConnection()
  try {
    const [rows] = await connection.query(
      'SELECT id FROM tb_buckets WHERE name = ? LIMIT 1',
      [bucketName]
    )
    
    if (rows && rows.length > 0) {
      return rows[0].id
    }
    return null
  } finally {
    connection.release()
  }
}

/**
 * MySQL에 StoredObject 메타데이터 저장
 * 
 * @param mysql - MySQL 연결 객체
 * @param fileInfo - 파일 정보
 * @returns 생성된 StoredObject의 UUID
 */
export async function saveMetadataToDatabase(
  mysql: any,
  fileInfo: FileInfo
): Promise<string> {
  // 1. Bucket ID 조회
  const bucketId = await getBucketIdByName(mysql, fileInfo.bucket)
  if (!bucketId) {
    throw new Error(`버킷을 찾을 수 없습니다: ${fileInfo.bucket}`)
  }

  const connection = await mysql.getConnection()
  try {
    // 2. UUID 생성
    const objectId = crypto.randomUUID()
    const now = new Date()

    // 3. TB_OBJECTS에 데이터 삽입
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
  } finally {
    connection.release()
  }
}
