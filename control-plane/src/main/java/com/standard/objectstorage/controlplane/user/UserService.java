package com.standard.objectstorage.controlplane.user;

import com.standard.objectstorage.controlplane.user.dto.CreateUserRequest;
import com.standard.objectstorage.controlplane.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 User를 찾을 수 없습니다"));
    }

    public UserResponse createUser(CreateUserRequest request) {

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new IllegalArgumentException("이미 존재하는 email입니다");
        }

        User user = User.builder()
                .email(request.getEmail())
                .build();

        User saved = userRepository.save(user);

        return UserResponse.builder()
                .id(saved.getId())
                .email(saved.getEmail())
                .createdAt(saved.getCreatedAt())
                .build();
    }
}