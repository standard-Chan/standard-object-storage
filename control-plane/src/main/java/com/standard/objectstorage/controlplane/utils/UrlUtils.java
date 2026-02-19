package com.standard.objectstorage.controlplane.utils;

import java.nio.charset.StandardCharsets;
import org.springframework.web.util.UriUtils;

public final class UrlUtils {

    private UrlUtils() {
    }

    public static String encodePathSegment(String value) {
        return UriUtils.encodePathSegment(value, StandardCharsets.UTF_8);
    }

    public static String encodePath(String value) {
        return UriUtils.encodePath(value, StandardCharsets.UTF_8);
    }
}