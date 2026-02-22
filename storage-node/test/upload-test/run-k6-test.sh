#!/bin/bash

# k6 부하 테스트 실행 스크립트
#
# 사용법:
#   ./run-k6-test.sh <scenario> [bucket] [control-plane-url]
#
# 시나리오:
#   light   - 가벼운 부하 (10 VUs, 1분)
#   medium  - 중간 부하 (50 VUs, 2분)
#   heavy   - 높은 부하 (100 VUs, 3분)
#   stress  - 스트레스 테스트 (200 VUs, 5분)
#   custom  - 사용자 정의 (VUs와 Duration을 환경변수로 지정)
#
# 예시:
#   ./run-k6-test.sh light
#   ./run-k6-test.sh heavy
#   VUS=100 DURATION=5m ./run-k6-test.sh custom

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 스크립트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 파라미터
SCENARIO=${1:-medium}
BUCKET=${2:-bucket1}
CONTROL_PLANE_URL=${3:-http://localhost:8080}

# k6 설치 확인
echo -e "${CYAN}🔍 k6 설치 확인 중...${NC}"
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6가 설치되어 있지 않습니다.${NC}"
    echo ""
    echo -e "${YELLOW}설치 방법:${NC}"
    echo -e "${WHITE}  macOS: brew install k6${NC}"
    echo -e "${WHITE}  Linux: https://k6.io/docs/get-started/installation/${NC}"
    exit 1
fi

K6_VERSION=$(k6 version)
echo -e "${GREEN}✅ k6 버전: $K6_VERSION${NC}"

# 서버 상태 확인
echo ""
echo -e "${CYAN}🔍 서버 상태 확인 중...${NC}"

if curl -s -f -o /dev/null "$CONTROL_PLANE_URL/health" 2>/dev/null; then
    echo -e "${GREEN}✅ Control Plane: 정상${NC}"
else
    echo -e "${YELLOW}⚠️  Control Plane: 응답 없음 ($CONTROL_PLANE_URL)${NC}"
    echo -e "${WHITE}   계속하려면 Enter를 누르세요...${NC}"
    read
fi

# 시나리오별 설정
echo ""
echo -e "${CYAN}📋 테스트 시나리오: $SCENARIO${NC}"

case $SCENARIO in
    light)
        VUS=10
        DURATION="1m"
        DESCRIPTION="가벼운 부하 (10명, 1분)"
        ;;
    medium)
        VUS=50
        DURATION="2m"
        DESCRIPTION="중간 부하 (50명, 2분)"
        ;;
    heavy)
        VUS=100
        DURATION="3m"
        DESCRIPTION="높은 부하 (100명, 3분)"
        ;;
    stress)
        VUS=200
        DURATION="5m"
        DESCRIPTION="스트레스 테스트 (200명, 5분)"
        ;;
    custom)
        VUS=${VUS:-10}
        DURATION=${DURATION:-30s}
        DESCRIPTION="사용자 정의 ($VUS명, $DURATION)"
        ;;
    *)
        echo -e "${RED}❌ 알 수 없는 시나리오: $SCENARIO${NC}"
        echo ""
        echo -e "${YELLOW}사용 가능한 시나리오:${NC}"
        echo -e "${WHITE}  light, medium, heavy, stress, custom${NC}"
        exit 1
        ;;
esac

# 테스트 정보 출력
echo ""
echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  🚀 k6 부하 테스트${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo -e "${WHITE}시나리오:        $DESCRIPTION${NC}"
echo -e "${WHITE}가상 사용자 수:  $VUS${NC}"
echo -e "${WHITE}지속 시간:       $DURATION${NC}"
echo -e "${WHITE}버킷:            $BUCKET${NC}"
echo -e "${WHITE}Control Plane:   $CONTROL_PLANE_URL${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo ""

# 결과 디렉토리 생성
RESULTS_DIR="$SCRIPT_DIR/test-results"
mkdir -p "$RESULTS_DIR"

# 결과 파일명
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULT_FILE="$RESULTS_DIR/k6-result-$SCENARIO-$TIMESTAMP.json"

# k6 실행
echo -e "${GREEN}▶️  테스트 시작...${NC}"
echo ""

k6 run \
    --vus "$VUS" \
    --duration "$DURATION" \
    --env "BUCKET=$BUCKET" \
    --env "CONTROL_PLANE_URL=$CONTROL_PLANE_URL" \
    --out "json=$RESULT_FILE" \
    k6-load-test.js

# 결과 확인
EXIT_CODE=$?
echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✅ 테스트 완료!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${CYAN}결과 파일: $RESULT_FILE${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ❌ 테스트 실패 (Exit Code: $EXIT_CODE)${NC}"
    echo -e "${RED}========================================${NC}"
fi

echo ""
echo -e "${YELLOW}다른 시나리오를 실행하려면:${NC}"
echo -e "${WHITE}  ./run-k6-test.sh light${NC}"
echo -e "${WHITE}  ./run-k6-test.sh medium${NC}"
echo -e "${WHITE}  ./run-k6-test.sh heavy${NC}"
echo -e "${WHITE}  ./run-k6-test.sh stress${NC}"
echo -e "${WHITE}  VUS=150 DURATION=10m ./run-k6-test.sh custom${NC}"
echo ""

exit $EXIT_CODE
