# k6 부하 테스트 가이드

## 개요

k6를 사용하여 Presigned URL 발급부터 실제 파일 업로드까지의 전체 프로세스를 부하 테스트합니다.

## 테스트 시나리오

1. **PUT Presigned URL 발급** (Control Plane에서)
2. **파일 업로드** (Storage Node로)

### 파일 크기
- 1KB
- 10KB
- 100KB
- 1MB
- 10MB

각 요청마다 랜덤으로 파일 크기가 선택됩니다.

## 설치

k6가 설치되어 있지 않다면 먼저 설치하세요:

### Windows
```powershell
winget install k6
```

또는 Chocolatey:
```powershell
choco install k6
```

### macOS
```bash
brew install k6
```

### Linux
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## 사용법

### 기본 실행

```bash
# 기본 설정 (10 VUs, 30초)
k6 run k6-load-test.js

# 동시 사용자 수와 지속 시간 지정
k6 run --vus 50 --duration 1m k6-load-test.js

# 100명의 동시 사용자로 2분간 테스트
k6 run --vus 100 --duration 2m k6-load-test.js
```

### 환경 변수 설정

```bash
# 다른 버킷 사용
k6 run --vus 20 --duration 1m --env BUCKET=my-bucket k6-load-test.js

# Control Plane URL 변경
k6 run --vus 10 --env CONTROL_PLANE_URL=http://production:8080 k6-load-test.js
```

### 단계적 부하 증가

스크립트 파일에서 `stages` 옵션의 주석을 해제하면 단계적으로 부하를 증가시킬 수 있습니다:

```javascript
stages: [
  { duration: '30s', target: 10 },  // 30초 동안 10 VUs로 증가
  { duration: '1m', target: 50 },   // 1분 동안 50 VUs로 증가
  { duration: '1m', target: 100 },  // 1분 동안 100 VUs로 증가
  { duration: '30s', target: 0 },   // 30초 동안 0으로 감소
],
```

### 결과를 파일로 저장

```bash
# JSON 형식으로 저장
k6 run --out json=test-results.json k6-load-test.js

# CSV 형식으로 저장
k6 run --out csv=test-results.csv k6-load-test.js

# InfluxDB로 전송 (모니터링)
k6 run --out influxdb=http://localhost:8086/k6 k6-load-test.js
```

## 테스트 메트릭

### 주요 메트릭

- **http_req_duration**: HTTP 요청 응답 시간
  - `p(95)<5000`: 95%의 요청이 5초 이내
  
- **http_req_failed**: HTTP 요청 실패율
  - `rate<0.1`: 실패율 10% 미만
  
- **http_reqs**: 초당 요청 수 (RPS)

- **vus**: 활성 가상 사용자 수

- **iteration_duration**: 전체 시나리오 반복 시간

### 태그별 메트릭

- `get_presigned_url`: Presigned URL 발급 성능
- `upload_file`: 파일 업로드 성능
- `file_size`: 파일 크기별 성능 (1KB, 10KB, 100KB, 1MB, 10MB)

## 성공 기준 (Thresholds)

스크립트에 정의된 성공 기준:

```javascript
thresholds: {
  http_req_failed: ['rate<0.1'],        // 실패율 10% 미만
  http_req_duration: ['p(95)<5000'],    // 95% 요청이 5초 이내
  'http_req_duration{name:get_presigned_url}': ['p(95)<1000'],  // Presigned URL 발급 1초 이내
  'http_req_duration{name:upload_file}': ['p(95)<10000'],       // 파일 업로드 10초 이내
}
```

필요에 따라 이 기준을 조정할 수 있습니다.

## 결과 해석

테스트 완료 후 출력되는 요약:

```
✓ Presigned URL 발급 성공
✓ Presigned URL 응답에 presignedUrl 포함
✓ 파일 업로드 성공

checks.........................: 100.00% ✓ 300  ✗ 0   
http_req_duration..............: avg=1.2s   min=450ms med=1.1s  max=3.5s  p(90)=2s   p(95)=2.3s
http_req_duration{name:get_presigned_url}: avg=200ms  min=100ms med=180ms max=500ms p(90)=300ms p(95)=350ms
http_req_duration{name:upload_file}......: avg=2s     min=500ms med=1.8s  max=8s    p(90)=4s   p(95)=5s
http_req_failed................: 0.00%   ✓ 0    ✗ 300
http_reqs......................: 300     10/s
iteration_duration.............: avg=3.5s   min=2s    med=3.2s  max=9s
iterations.....................: 100     3.33/s
vus............................: 10      min=10 max=10
```

## 팁

### 1. 서버 준비 확인
테스트 전 Control Plane과 Storage Node가 실행 중인지 확인하세요:

```bash
# Control Plane
curl http://localhost:8080/health

# Storage Node
curl http://localhost:3000/health
```

### 2. 점진적 부하 증가
처음부터 높은 부하를 주지 말고 점진적으로 증가시키세요:

```bash
k6 run --vus 10 --duration 30s k6-load-test.js
k6 run --vus 50 --duration 30s k6-load-test.js
k6 run --vus 100 --duration 30s k6-load-test.js
```

### 3. 시스템 리소스 모니터링
부하 테스트 중 서버의 CPU, 메모리, 디스크 I/O를 모니터링하세요.

### 4. 디스크 공간 확인
10MB 파일을 대량으로 업로드하면 디스크 공간이 빠르게 소진될 수 있습니다.

## 시나리오 확장

### 읽기 작업 추가
현재는 쓰기(PUT)만 테스트합니다. GET Presigned URL과 다운로드도 추가할 수 있습니다.

### 혼합 작업 부하
쓰기와 읽기를 혼합한 시나리오:

```javascript
export default function () {
  const scenario = Math.random();
  
  if (scenario < 0.7) {
    // 70% 쓰기
    performUpload();
  } else {
    // 30% 읽기
    performDownload();
  }
}
```

## 문제 해결

### 타임아웃 에러
파일 크기가 크거나 네트워크가 느린 경우 타임아웃이 발생할 수 있습니다. 스크립트에서 `timeout` 값을 조정하세요.

### 메모리 부족
VU 수를 줄이거나 대용량 파일 테스트를 제한하세요.

### 연결 거부
Control Plane이나 Storage Node가 실행 중인지, 방화벽 설정을 확인하세요.

## 참고 자료

- [k6 공식 문서](https://k6.io/docs/)
- [k6 메트릭 가이드](https://k6.io/docs/using-k6/metrics/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
