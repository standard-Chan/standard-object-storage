package com.standard.objectstorage.controlplane.storage.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class PresignedUrlRequest {
    private String bucket;
    private String key;
}