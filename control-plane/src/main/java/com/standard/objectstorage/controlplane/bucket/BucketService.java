package com.standard.objectstorage.controlplane.bucket;

import com.standard.objectstorage.controlplane.bucket.dto.BucketListResponse;
import com.standard.objectstorage.controlplane.bucket.dto.BucketResponse;
import com.standard.objectstorage.controlplane.bucket.dto.CreateBucketRequest;
import com.standard.objectstorage.controlplane.user.User;
import com.standard.objectstorage.controlplane.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BucketService {

    private final BucketRepository bucketRepository;
    private final UserService userService;

    public BucketResponse createBucket(CreateBucketRequest request, Long userId) {
        User user = userService.getUser(userId);

        if (bucketRepository.existsByOwnerAndName(user, request.getName())) {
            throw new IllegalArgumentException("이미 존재하는 Bucket 입니다.");
        }

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

    public BucketListResponse getBuckets() {
        List<BucketResponse> bucketResponses = bucketRepository
                .findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(bucket -> BucketResponse.builder()
                        .id(bucket.getId())
                        .name(bucket.getName())
                        .createdAt(bucket.getCreatedAt())
                        .build())
                .toList();

        return BucketListResponse.builder()
                .buckets(bucketResponses)
                .build();
    }

    public void deleteBucket(String name) {
        Bucket bucket = bucketRepository.findByName(name)
                .orElseThrow(() -> new IllegalArgumentException("Bucket not found"));

        // TODO: 추후 Object 추가 될 경우, Bucket이 비워졌는지 확인 검증 필요

        bucketRepository.delete(bucket);
    }
}