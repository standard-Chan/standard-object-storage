package com.standard.objectstorage.controlplane.bucket;

import com.standard.objectstorage.controlplane.user.User;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BucketRepository extends JpaRepository<Bucket, Long> {
    Optional<Bucket> findByName(String name);
    List<Bucket> findAll(Sort sort);
    boolean existsByOwnerAndName(User owner, String bucketName);
}
