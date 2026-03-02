# File-Storage

데이터를 저장하고 다운로드할 수 있는 File Storage를 직접 만드는 프로젝트입니다.

---

## 아키텍처 구조
<img src="docs/imgs/아키텍처 구조.png" width="1000" />

---
# 설계 및 구현 과정 정리

> 이 문서는 스토리지 시스템을 설계하고 구현하는 과정에서의 주요 의사결정과 구현 내용을 정리한 문서입니다. 기능 도입 배경, 설계 과정에서의 고려 사항, 그리고 실제 구현 방식까지의 흐름을 기록하였습니다.


## 1. 데이터 내구성 보장
###  1.1 분산 스토리지 도입
- [내구성 확보를 위한 분산 스토리지 도입](https://velog.io/@standard-chan/%EC%8A%A4%ED%86%A0%EB%A6%AC%EC%A7%80-%EC%84%A4%EA%B3%84-%EB%82%B4%EA%B5%AC%EC%84%B1-99.99..-%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98-%EC%84%A4%EA%B3%84)

### 1.2 데이터 복제 처리
- [데이터 복제 실패 시, 재시도 자동화 도입](https://velog.io/@standard-chan/storage-2-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%B3%B5%EC%A0%9C-%EC%8B%A4%ED%8C%A8-%EC%8B%9C-%EC%9E%AC%EC%8B%9C%EB%8F%84-%EB%A1%9C%EC%A7%81-%EB%8F%84%EC%9E%85)
- [서버 상황에 맞춰 복제 로직 수행](https://velog.io/@standard-chan/storage-3-%EC%84%9C%EB%B2%84-%EC%83%81%ED%99%A9%EC%97%90-%EB%94%B0%EB%A5%B8-%EC%9E%AC%EB%B3%B5%EC%A0%9C-%EC%9A%94%EC%B2%AD-%EC%A0%84%EC%86%A1%ED%95%98%EA%B8%B0)

## 2. 데이터 업로드
- [대용량 파일 업로드 중 실패 시, 업로드 재개 기능 도입](https://www.notion.so/316fc6c667018030aaebe087265d16da?source=copy_link)

---