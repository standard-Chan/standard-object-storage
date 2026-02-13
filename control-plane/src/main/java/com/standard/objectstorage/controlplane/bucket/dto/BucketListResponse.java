package com.standard.objectstorage.controlplane.bucket.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class BucketListResponse {
    private List<BucketResponse> buckets;
}