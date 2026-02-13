package com.standard.objectstorage.controlplane.storedObjcet;

import com.standard.objectstorage.controlplane.bucket.Bucket;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "TB_OBJECTS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class StoredObject {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bucket_id", nullable = false)
    private Bucket bucket;

    @Column(nullable = false, length = 1024)
    private String key;

    @Column(nullable = false, length = 1024)
    private String storagePath;

    @Column
    private Long size;

    @Column(length = 255)
    private String etag;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ObjectStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.id = UUID.randomUUID();
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}