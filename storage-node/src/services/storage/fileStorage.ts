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
 * 확장자로 Content-Type 유추
 */
export function getContentTypeFromExtension(objectKey: string): string {
  const ext = path.extname(objectKey).toLowerCase()
  const contentTypeMap: { [key: string]: string } = {
    // 이미지
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    // 문서
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // 텍스트
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    // 비디오
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    // 오디오
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    // 아카이브
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  }
  
  return contentTypeMap[ext] || 'application/octet-stream'
}

/**
 * 파일 읽기 스트림 생성
 */
export function getFileStream(bucket: string, objectKey: string): fs.ReadStream {
  const filePath = path.join(process.cwd(), 'uploads', bucket, objectKey)
  
  // 파일 존재 여부 확인 (동기)
  if (!fs.existsSync(filePath)) {
    throw new HttpError(
      404,
      `파일을 찾을 수 없습니다: ${bucket}/${objectKey}`
    )
  }
  
  return fs.createReadStream(filePath)
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
