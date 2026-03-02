package com.standard.objectstorage.controlplane.storage.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class PresignedUrlRequest {

    @NotBlank(message = "bucket이 누락되었습니다.")
    private String bucket;

    @NotBlank(message = "objectKey가 누락되었습니다.")
    private String objectKey;

    @NotNull(message = "fileSize가 누락되었습니다.")
    @Min(value = 1, message = "fileSize는 1 이상이어야 합니다.")
    private Long fileSize;
}