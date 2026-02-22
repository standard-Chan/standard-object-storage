package com.standard.objectstorage.controlplane.storage.dto;

import lombok.Getter;

@Getter
public class PresignedUrlRequest {

    private String bucket;
    private String objectKey;
}