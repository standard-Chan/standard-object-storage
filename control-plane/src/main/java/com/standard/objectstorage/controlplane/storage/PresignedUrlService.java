package com.standard.objectstorage.controlplane.storage;

import com.standard.objectstorage.controlplane.utils.CryptoUtils;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

@Service
public class PresignedUrlService {

    private static final Logger log = LoggerFactory.getLogger(PresignedUrlService.class);
    private static final long RESUMABLE_UPLOAD_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    private static final String DIRECT_UPLOAD_PATH = "uploads/direct";
    private static final String RESUMABLE_UPLOAD_PATH = "uploads/resumable";

    @Value("${SECRET_KEY}")
    private String SECRET_KEY;

    @Value("${NODE_ENDPOINT}")
    private String NODE_ENDPOINT;

    public String generatePutPresignedUrl(String bucket, String objectKey, long fileSize) {
        log.info("PUT Presigned URL 생성 요청 - bucket: {}, objectKey: {}, fileSize: {}", bucket,
            objectKey, fileSize);
        return generatePresignedUrl(bucket, objectKey, fileSize, HttpMethod.PUT.name());
    }

    public String generateGetPresignedUrl(String bucket, String objectKey, long fileSize) {
        log.info("GET Presigned URL 생성 요청 - bucket: {}, objectKey: {}", bucket, objectKey);
        return generatePresignedUrl(bucket, objectKey, fileSize, HttpMethod.GET.name());
    }

    /**
     * Presigned URL 생성 로직 fileSize에 따라 일반 업로드 또는 Resumable Upload 로 URL을 생성합니다.
     */
    private String generatePresignedUrl(
        String bucket,
        String objectKey,
        long fileSize,
        String method
    ) {
        String basePath = isResumableSize(fileSize) ? RESUMABLE_UPLOAD_PATH : DIRECT_UPLOAD_PATH;

        try {

            if ((SECRET_KEY == null || SECRET_KEY.isBlank())
                || (NODE_ENDPOINT == null || NODE_ENDPOINT.isBlank())) {
                log.error("환경 변수 누락 - SECRET_KEY 또는 NODE_ENDPOINT가 비어있습니다.");
                throw new IllegalStateException("환경 변수 SECRET_KEY 또는 NODE_ENDPOINT가 설정되지 않았습니다.");
            }

            long expiresAt = Instant.now()
                .plusSeconds(60 * 15)
                .getEpochSecond();

            String signature = generateSignature(
                bucket,
                objectKey,
                method,
                expiresAt,
                fileSize
            );

            String encodedBucket =
                UriUtils.encodePathSegment(bucket, StandardCharsets.UTF_8);

            String encodedObjectKey =
                UriUtils.encodePath(objectKey, StandardCharsets.UTF_8);

            return String.format(
                "%s/%s/%s/%s?bucket=%s&objectKey=%s&method=%s&exp=%d&fileSize=%d&signature=%s",
                NODE_ENDPOINT,
                basePath,
                encodedBucket,
                encodedObjectKey,
                bucket,
                objectKey,
                method,
                expiresAt,
                fileSize,
                signature
            );

        } catch (Exception e) {
            log.error("Presigned URL 생성 실패", e);
            throw new RuntimeException("Presigned URL 생성에 실패하였습니다", e);
        }
    }

    // resumable upload 여부 판단 (대용량인 경우에만 처리)
    private boolean isResumableSize(long fileSize) {
        return fileSize >= RESUMABLE_UPLOAD_FILE_SIZE;
    }

    private String generateSignature(
        String bucket,
        String objectKey,
        String method,
        long exp,
        long fileSize
    ) throws Exception {
        String canonicalString = String.format(
            "bucket=%s&objectKey=%s&method=%s&exp=%d&fileSize=%d",
            bucket,
            objectKey,
            method,
            exp,
            fileSize
        );
        return CryptoUtils.hmacSha256Base64Url(
            canonicalString,
            SECRET_KEY
        );
    }
}