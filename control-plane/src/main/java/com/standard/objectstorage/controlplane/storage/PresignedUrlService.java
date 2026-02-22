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

    @Value("${SECRET_KEY}")
    private String SECRET_KEY;

    @Value("${NODE_ENDPOINT}")
    private String NODE_ENDPOINT;

    public String generatePutPresignedUrl(String bucket, String objectKey) {
        log.info("PUT Presigned URL 생성 요청 - bucket: {}, objectKey: {}", bucket, objectKey);
        return generatePresignedUrl(bucket, objectKey, HttpMethod.PUT.name());
    }

    public String generateGetPresignedUrl(String bucket, String objectKey) {
        log.info("GET Presigned URL 생성 요청 - bucket: {}, objectKey: {}", bucket, objectKey);
        return generatePresignedUrl(bucket, objectKey, HttpMethod.GET.name());
    }

    // 공통 Presigned URL 생성 로직
    private String generatePresignedUrl(
        String bucket,
        String objectKey,
        String method
    ) {
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
                expiresAt
            );

            String encodedBucket =
                UriUtils.encodePathSegment(bucket, StandardCharsets.UTF_8);

            String encodedObjectKey =
                UriUtils.encodePath(objectKey, StandardCharsets.UTF_8);

            return String.format(
                "%s/objects/%s/%s?bucket=%s&objectKey=%s&method=%s&exp=%d&signature=%s",
                NODE_ENDPOINT,
                encodedBucket,
                encodedObjectKey,
                bucket,
                objectKey,
                method,
                expiresAt,
                signature
            );

        } catch (Exception e) {
            log.error("Presigned URL 생성 실패", e);
            throw new RuntimeException("Presigned URL 생성에 실패하였습니다", e);
        }
    }

    private String generateSignature(
        String bucket,
        String objectKey,
        String method,
        long exp
    ) throws Exception {
        String canonicalString = String.format(
            "bucket=%s&objectKey=%s&method=%s&exp=%d",
            bucket,
            objectKey,
            method,
            exp
        );
        return CryptoUtils.hmacSha256Base64Url(
            canonicalString,
            SECRET_KEY
        );
    }
}