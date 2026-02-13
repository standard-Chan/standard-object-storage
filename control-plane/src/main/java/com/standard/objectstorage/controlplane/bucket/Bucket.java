package com.standard.objectstorage.controlplane.bucket;

import jakarta.persistence.*;
import lombok.*;
import org.apache.catalina.User;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "TB_BUCKETS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Bucket {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 63)
    private String name;

//    @ManyToOne(fetch = FetchType.LAZY)
//    @JoinColumn(name = "owner_id", nullable = false)
//    private User owner;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    Bucket(String name, User owner) {
        this.name = name;
//        this.owner = owner;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}