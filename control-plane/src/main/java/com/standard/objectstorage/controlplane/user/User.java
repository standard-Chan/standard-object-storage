package com.standard.objectstorage.controlplane.user;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "TB_USERS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    User(String email) {
        this.email = email;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
