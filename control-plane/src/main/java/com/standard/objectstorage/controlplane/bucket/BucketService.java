package com.standard.objectstorage.controlplane.bucket;

import com.standard.objectstorage.controlplane.bucket.dto.BucketResponse;
import com.standard.objectstorage.controlplane.bucket.dto.CreateBucketRequest;
import com.standard.objectstorage.controlplane.user.User;
import com.standard.objectstorage.controlplane.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BucketService {

    private final BucketRepository bucketRepository;
    private final UserService userService;

    public BucketResponse createBucket(CreateBucketRequest request, Long userId) {

        if (bucketRepository.existsByName(request.getName())) {
            throw new IllegalArgumentException("이미 존재하는 Bucket 입니다.");
        }

        User user = userService.getUser(userId);

        Bucket bucket = Bucket.builder()
                .name(request.getName())
                .owner(user)
                .build();

        Bucket saved = bucketRepository.save(bucket);

        return BucketResponse.builder()
                .id(saved.getId())
                .name(saved.getName())
                .createdAt(saved.getCreatedAt())
                .build();
    }
}