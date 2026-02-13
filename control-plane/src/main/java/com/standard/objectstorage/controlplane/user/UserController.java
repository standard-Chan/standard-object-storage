package com.standard.objectstorage.controlplane.user;

import com.standard.objectstorage.controlplane.user.dto.CreateUserRequest;
import com.standard.objectstorage.controlplane.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<UserResponse> createUser(
            @RequestBody CreateUserRequest request
    ) {

        UserResponse response = userService.createUser(request);
        return ResponseEntity.status(201).body(response);
    }
}
