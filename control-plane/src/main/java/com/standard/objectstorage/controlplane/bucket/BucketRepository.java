package com.standard.objectstorage.controlplane.bucket;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BucketRepository extends JpaRepository<Bucket, Long> {
    Optional<Bucket> findByName(String name);
    boolean existsByName(String name);
}
