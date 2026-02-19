package com.standard.objectstorage.controlplane.utils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class CryptoUtils {

    private CryptoUtils() {
    }

    public static String hmacSha256Base64Url(
        String data,
        String secret
    ) {
        try {
            Mac mac =
                Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec =
                new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");

            mac.init(secretKeySpec);

            byte[] hmacBytes =
                mac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(hmacBytes);

        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
