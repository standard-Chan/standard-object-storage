package com.standard.objectstorage.controlplane.storage;

import com.standard.objectstorage.controlplane.utils.CryptoUtils;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

@Service
public class PresignedUrlService {

    @Value("${SECRET_KEY}")
    private String SECRET_KEY;
    @Value("${NODE_ENDPOINT}")
    private String NODE_ENDPOINT;

    public String generatePutPresignedUrl(String bucket, String key) {
        try {
            if ((SECRET_KEY == null || SECRET_KEY.isBlank())
                || (NODE_ENDPOINT == null || NODE_ENDPOINT.isBlank())) {
                throw new IllegalStateException("환경 변수 SECRET_KEY 또는 NODE_ENDPOINT가 설정되지 않았습니다.");
            }
            String method = HttpMethod.PUT.name();
            long expiresAt = Instant.now().plusSeconds(60 * 15).getEpochSecond();

            String signature = generateSignature(bucket, key, method, expiresAt);

            String encodedBucket = UriUtils.encodePathSegment(bucket, StandardCharsets.UTF_8);
            String encodedKey = UriUtils.encodePath(key, StandardCharsets.UTF_8);

            return String.format(
                "%s/objects/%s/%s?bucket=%s&key=%s&method=%s&exp=%d&signature=%s",
                NODE_ENDPOINT,
                encodedBucket,
                encodedKey,
                bucket,
                key,
                method,
                expiresAt,
                signature
            );

        } catch (Exception e) {
            throw new RuntimeException("Presigned URL 생성에 실패하였습니다", e);
        }
    }

    private String generateSignature(
        String bucket,
        String key,
        String method,
        long exp
    ) throws Exception {
        String canonicalString = String.format(
            "bucket=%s&key=%s&method=%s&exp=%d",
            bucket,
            key,
            method,
            exp
        );
        return CryptoUtils.hmacSha256Base64Url(canonicalString, SECRET_KEY);
    }
}