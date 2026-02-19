import path from 'path'
import { promises as fsPromises } from 'fs'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import { MultipartFile } from '@fastify/multipart'

/**
 * 파일 정보 타입
 */
export interface FileInfo {
  bucket: string
  key: string
  filename: string
  mimetype: string
  encoding: string
  size: number
  uploadedAt: string
  storagePath: string
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
  key: string,
  fileData: MultipartFile
): Promise<string> {
  const filePath = path.join(process.cwd(), 'uploads', bucket, key)
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
  key: string,
  filePath: string,
  fileData: MultipartFile
): Promise<FileInfo> {
  const fileStats = await fsPromises.stat(filePath)
  
  return {
    bucket,
    key,
    filename: fileData.filename,
    mimetype: fileData.mimetype,
    encoding: fileData.encoding,
    size: fileStats.size,
    uploadedAt: new Date().toISOString(),
    storagePath: filePath
  }
}

/**
 * MySQL에 메타데이터 저장 (TODO)
 * 현재는 주석 처리됨
 * 
 * @example
 * await saveMetadataToDatabase(fastify.mysql, fileInfo)
 */
export async function saveMetadataToDatabase(
  mysql: any,
  fileInfo: FileInfo
): Promise<void> {
  const connection = await mysql.getConnection()
  try {
    await connection.query(
      'INSERT INTO objects (bucket, object_key, filename, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [fileInfo.bucket, fileInfo.key, fileInfo.filename, fileInfo.mimetype, fileInfo.size, new Date()]
    )
  } finally {
    connection.release()
  }
}
