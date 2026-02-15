# 0. Presigned URL이란?

S3 기준의 **`Presigned URL`**은 ‘일정 시간동안 접근 가능한, 인증완료된 권한 URL`을 의미한다.

### 비유 : 친구가 집에 들어오게 하는 키

비유해서 표현하자면, 10분동안만 사용할 수 있는 열쇠키라고 생각하자!

친구가 집에 들어갈 수 있도록 하고 싶은데, 그냥 열쇠 키를 줘버리면 평생 집에 마음대로 들어갈 수 있다. 그래서 10분만 들어올 수 있게 제한 시간을 걸고 싶다. 이를 위해서 10분 동안 집에 들어갈 수 있는 일종의 서명 디지털키를 만들어주면 되는데, 이게 `Presigned URL`이다.

여기 안에는 여러 정보들이 같이 들어있다.

### 구성 요소

Presigned URL에는 다음 값들을 묶어서 키로 만든다.

- 객체
- HTTP 메서드
- 만료 시간
- 파라미터
### Presigned URL 생성 과정

```text
[서버]
   │
   │ 1. 특정 user의 SecretKey를 조회
   │
   │ 2. CanonicalRequest 생성
   │
   │ 3. SigningKey 파생
   │
   │ 4. HMAC 생성
   │
   ▼
[완성된 URL 반환]
```

위처럼 생성 과정이 끝난 후 결과적으로 다음 값들이 들어간다.

```text
X-Amz-Credential=AccessKey/날짜/리전/서비스/aws4_request
X-Amz-Signature=HMAC결과
```

각각은 다음을 의미한다고 생각하면 된다.

- **Credential → “누가 만들었는지”**
- **Signature → “위조되지 않았는지”**

아래에서는 Credential과 Signature 에 대해서 알아본다.


# 1. credential에 대해서

우선 credential을 어디에서 올까?

바로, Secret Key에서 온다. 그리고 이 Secret Key는 IAM User로부터 생성된다.

- **IAM User 생성한다**
- **AccessKey / SecretKey 발급해준다**
- **서버는 SecretKey를 안전하게 보관하고 있다가 Presigned URL 생성 시 사용한다**

## 1.1 AccessKey와 SecretKey

**AccessKey는 사용자가 누구인지 확인하는 용도의 Key이다.**

이 값을 서버에 전달하면, 해당 값으로 누구의 요청인지를 파악할 수 있다.

다음과 같은 구조로 들어온다.

```text
X-Amz-Credential=AKIA123456/20260215/ap-northeast-2/s3/aws4_request
```

여기에서 가장 앞에있는 AKIA123…. 가 `AccessKey`이다.

**SecretKey는 해당 사용자의 암호화키라고 생각하면 된다.**

이 AccessKey를 사용하여, Secret Key를 DB에서 조회할 수 있다. 또한 이렇게 조회된 Secret Key를 이용하여 Signature의 암호화를 만드는데 사용하게 된다.

### 왜 2개의 키로 나누어서 관리할까?

궁금한점이 생겼다. Access Key가 단순하게 Secret Key에 접근하기 위한 수단으로의 역할을 한다면, 단순하게 Access Key 없이, Secret Key 1개 만으로 서버에서 암호화, 복호화를 해서 사용하는 것이 더욱 좋지 않을까? 더구나 Secret Key를 DB에 일일이 저장해야한다면, 이를 저장할 공간도 낭비되는 것이 아닌가?

즉, 현재 구조는 아래이다.

```
Client에서 AccessKey를 전달 -> 서버에서 AccessKey 추출 -> DB에서 AccessKey로 SecretKey 조회
```

그런데 아래처럼 바꾼다면?

```
Client에서 암호화된 Secret Key 전달 -> 서버에서 Secret Key 복호화 -> 사용
```

이렇게 수정한다면, 불필요하게 2개의 키를 저장할 이유가 없지 않은가!

**하지만 이렇게 하면 큰 문제가 있다!**

바로 서버에 암호화키 1개를 털리게되면, 모든 사용자의 SecretKey가 털린다는 것이다. 그래서 보안상 정말 위험할 것 같다.!

# 2. Presigned URL 서명 구조

여기서 **서명**이란, 메시지 위변조 여부와 작성자를 증명할 수 있는 값을 생성하는 것을 말한다.

Presigned URL은 일종의 키 같은 거라서, 이를 확인할 인증 토큰이라던가 암호가 들어가야한다 (이른바 서명). 그래서 생성할 때, AWS Signature Version 4, 통칭 SigV4 프로토콜을 사용한다.

## 2.1 SigV4란?

‘Secret Key를 가진 사람이 만들었음을 증명할 수 있는 것’이다. 쉽게 말해서, 인증된 사람이 만들었냐? 를 확인할 수 있는 것이라고 생각하면 된다.

SigV4는 다음 암호화를 사용한다.

- SHA-256 해시
- HMAC

```mathematica
HMAC(K, m) = H( (K ⊕ opad) || H((K ⊕ ipad) || m))

- K = Secret Key
- m = 메시지
- H = SHA256
- ipad/opad = 고정 패딩
```
솔직히… 이런 것 까지 이해하면 물론 좋겠지만, 어렵기도 하고, 추상적으로 이해해도 괜찮을 것 같아서 구체적으로 학습하진 않았다.

다만 여기에서 HMAC 부분의 SecretKey를 유심히 보자. 아까 위에서 나온 **사용자별의 암호화 Key** 이다. 이를 통해 사용자 별로 다른 키를 통해서 암호화를 진행한다.
## 2.2 Presigned URL에서 서명하는 것

URL 전체에 대해서 이게 올바른 URL인지 검증하진 않고, 다음 **4가지에 대해서 서명**을 한다. 차례대로 서명하면서 최종 Signature 1개에 서명값을 담아내게 된다.

- Canonical Request
- String to Sign
- Signing Key 생성
- 최종 Signature 생성

## 3.1 Signature

```text
Signature=5f2c7e...
```

만드는 과정의 앞부부만 살짝 설명하자면,

아래의 6개를 하나의 문자열로 이어붙인다. 이걸 Canonical Request라고 한다. 요청을 정규화해서 표현한 문자열이다. 이 값을 이용해서 요청의 내용이 변조되지 않았는지를 확인할 수 있다.

```text
HTTPMethod    # GET, POST 와 같은 문자
CanonicalURI   # 요청 경로
CanonicalQueryString
CanonicalHeaders
SignedHeaders   # 포함된 헤더 이름 목록
HashedPayload   # 요청 body를 SHA-256으로 암호화
```

위를 하나의 문자열로 만든다.

이후 `String to Sign`라는 날짜, 서비스명 등의 서명을 거쳐 새롭게 묶는다.

이후 단계적인 파싱절차, 해싱절차를 거쳐 최종 `Signature`를 만들어낸다.

권한을 위임하는 중요한 값이다보니, 여러 값들을 여러 과정을 거쳐서 만들어낸다.

# 3. 최종 Presigned URL 해부해보기

실제 예시를 보면서 직접 해부해보자.

### presigned URL

```
https://my-bucket.s3.ap-northeast-2.amazonaws.com/photo.jpg?
X-Amz-Algorithm=AWS4-HMAC-SHA256
&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE/20260213/ap-northeast-2/s3/aws4_request
&X-Amz-Date=20260213T120000Z
&X-Amz-Expires=600
&X-Amz-SignedHeaders=host
&X-Amz-Signature=5e3c0d4f9a2b8...
```

## 3.1 기본 URL

```text
https://my-bucket.s3.ap-northeast-2.amazonaws.com/photo.jpg
```

각 값의 의미는 아래와 같다.

- `my-bucket` → 접근 대상 버킷
- `photo.jpg` → 접근 대상 객체
- `ap-northeast-2` → 리전

## 3.2 X-Amz-Algorithm

```text
X-Amz-Algorithm=AWS4-HMAC-SHA256
```

이건 어떤 방식으로 알고리즘화 되어있는지 설명하는 값이다. 적혀있는 알고리즘을 이용해서 서버가 해석하기 때문에 이 값이 바뀌면 안된다.

## 3.3 X-Amz-Credential

```text
X-Amz-Credential=AKIA.../20260213/ap-northeast-2/s3/aws4_request
```

서명에 사용된 키에 대한 내용이 담겨져 있다. 위 텍스트 그대로

`AccessKeyID / Date / Region / Service / aws4_request`

순서대로 작성되어있다. 이들 각각이 위 서명 절차를 통해 만들어진 서명값이다.

## 3.4 X-Amz-Date

```text
X-Amz-Date=20260213T120000Z
```

Presigned URL이 생성된 UTC 시간 값이다. 이건 이전 서명의 `StringToSign` 과정에 포함되어 서명된다. 해당 값이 달라지면, 최종 signature가 달라지기 때문에 변경할 수 없다.

## 3.5 X-Amz-Expires

```text
X-Amz-Expires=600
```

만료 시간 값이다.

S3에서는 만료 시간을 검증할 때, `현재시간 - X-Amz-Date <= X-Amz-Expires`  수식을 사용하고, 403 Forbidden을 반환한다. 마찬가지로 이 값을 바꾸면 서명이 깨지게 된다.

## 3.6 X-Amz-SignedHeaders

```text
X-Amz-SignedHeaders=host
```

어떤 HTTP 헤더가 서명에 포함되어있는지를 알려주는 값이다. host 뿐만 아니라 content-type이 들어가 있다면

```text
X-Amz-SignedHeaders=host;content-type
```

으로 값이 바뀌게 된다.

## 3.7. X-Amz-Signature

```text
X-Amz-Signature=5e3c0d4f9a2b8...
```

이건 Signature 값이다. 아까 서명과정에서 최종적으로 만들어 낸 값이 들어있다.

## 3.8 정리

```text
https://my-bucket.s3.ap-northeast-2.amazonaws.com/photo.jpg?
X-Amz-Algorithm=AWS4-HMAC-SHA256
&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE/20260213/ap-northeast-2/s3/aws4_request
&X-Amz-Date=20260213T120000Z
&X-Amz-Expires=600
&X-Amz-SignedHeaders=host
&X-Amz-Signature=5e3c0d4f9a2b8...
```

값을 정리하면 아래 표와 같다.

| 파라미터 | 의미 |
| --- | --- |
| Algorithm | 어떤 암호 방식인가 |
| Credential | 어떤 키 족보로 서명했는가 |
| Date | 언제 생성되었는가 |
| Expires | 얼마나 유효한가 |
| SignedHeaders | 어떤 요청 요소가 고정되었는가 |
| Signature | 위 모든 것의 암호학적 증명 |

## 4. 라이브러리로 Presigned URL 만들기

위 내용을 통해서 직접 구현할 수도 있겠지만, 이미 만들어진 것을 사용하는 것도 좋다고 생각한다.

awssdk에서 지원하는 S3-Presigner를 사용하면 쉽게 만들어낼 수 있다.

```text
implementation "software.amazon.awssdk:s3"
implementation "software.amazon.awssdk:s3-presigner"
```

실제 JAVA 코드를 통해, 다운로드용(GET)과 업로드용(PUT)의 Presigned URL 생성과정을 알아보자.

### 업로드(PUT) 용도

```java
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

// PUT 요청 모델 생성
PutObjectRequest putObjectRequest = PutObjectRequest.builder()
        .bucket(bucketName) // 업로드 대상 버킷
        .key("upload.jpg")  // 업로드될 객체 이름

        // contet type을 이 헤더를 서명에 포함시키면 반드시 Content-Type으로 보내야한다!
        .contentType("image/jpeg")
        .build();

// Presign 설정
PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
        .signatureDuration(Duration.ofMinutes(5)) // 제한 시간 설정 (5분 유효)
        .putObjectRequest(putObjectRequest)
        .build();

// PUT 전용 SigV4 서명  수행
String presignedPutUrl = presigner
        .presignPutObject(presignRequest)
        .url()
        .toString();

// 이제 presignedPutUrl 을 사용하면 된다.
```

### 다운로드(GET) 용도

```java
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.time.Duration;

public class GetPresignedUrlExample {

    public static void main(String[] args) {

        // 접근하려는 S3 버킷 이름
        String bucketName = "my-bucket";

        // 다운로드하려는 객체 키 (파일 경로)
        String objectKey = "photo.jpg";

        // S3Presigner는 실제 HTTP 요청을 보내지 않고, SigV4 서명만 수행하는 객체
        try (S3Presigner presigner = S3Presigner.builder()
                // 반드시 실제 S3 버킷이 존재하는 리전과 동일해야 함
                .region(Region.AP_NORTHEAST_2)

                // AWS 인증 정보 (IAM Role, 환경변수, ~/.aws/credentials 등에서 자동 탐색)
                .credentialsProvider(DefaultCredentialsProvider.create())

                .build()) {

            // 실제로 GET 요청이 만들어질 모델
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)  // 대상 버킷
                    .key(objectKey)      // 대상 객체
                    .build();

            // Presign 요청 모델
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()

                    // 이 URL이 유효한 시간 (여기선 10분)
                    .signatureDuration(Duration.ofMinutes(10))

                    // 어떤 HTTP 요청을 서명할 것인가
                    .getObjectRequest(getObjectRequest)
                    .build();

            // 실제로 SigV4 서명이 수행되는 지점
            String presignedUrl = presigner
                    .presignGetObject(presignRequest) // GET 방식 서명
                    .url()
                    .toString();

            System.out.println("GET Presigned URL:");
            System.out.println(presignedUrl);
        }
    }
}

```