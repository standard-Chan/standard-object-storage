package com.standard.objectstorage.controlplane.bucket;

import com.standard.objectstorage.controlplane.bucket.dto.BucketResponse;
import com.standard.objectstorage.controlplane.bucket.dto.CreateBucketRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/buckets")
@RequiredArgsConstructor
public class BucketController {

    private final BucketService bucketService;
    public final long TEMP_USER_ID = 1;

    @PostMapping
    public ResponseEntity<BucketResponse> createBucket(
            @RequestBody CreateBucketRequest request) {

        // TODO : 추후, USER ID를 실제 쿠키에서 추출하여 가져오도록 수정 필요
        BucketResponse response = bucketService.createBucket(request, this.TEMP_USER_ID);
        return ResponseEntity.status(201).body(response);
    }
}