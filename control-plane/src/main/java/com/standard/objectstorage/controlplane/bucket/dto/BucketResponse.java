package com.standard.objectstorage.controlplane.bucket.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class BucketResponse {
    private Long id;
    private String name;
    private LocalDateTime createdAt;
}
