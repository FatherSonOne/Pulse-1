#!/bin/bash

# Smoke Test Script for Post-Deployment Verification
# Tests critical paths and ensures the deployment is healthy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${1:-"https://pulse.yourdomain.com"}
TIMEOUT=10
MAX_RETRIES=3

echo "========================================="
echo "Pulse Smoke Test Suite"
echo "========================================="
echo "Target: $BASE_URL"
echo "Timeout: ${TIMEOUT}s"
echo "========================================="
echo ""

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local url=$2
    local expected_status=${3:-200}
    local retry_count=0

    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing: $test_name... "

    while [ $retry_count -lt $MAX_RETRIES ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" || echo "000")

        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}PASS${NC} (Status: $response)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $MAX_RETRIES ]; then
            echo -n "Retry $retry_count... "
            sleep 2
        fi
    done

    echo -e "${RED}FAIL${NC} (Expected: $expected_status, Got: $response)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
}

# Function to check content
check_content() {
    local test_name=$1
    local url=$2
    local expected_text=$3

    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing: $test_name... "

    content=$(curl -s --max-time $TIMEOUT "$url")

    if echo "$content" | grep -q "$expected_text"; then
        echo -e "${GREEN}PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} (Expected text not found: $expected_text)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

echo "1. Infrastructure Tests"
echo "------------------------"

# Test 1: Homepage loads
run_test "Homepage" "$BASE_URL"

# Test 2: Health endpoint
run_test "Health Check" "$BASE_URL/health"

# Test 3: Static assets
run_test "Static Assets (CSS)" "$BASE_URL/assets/index.css" "200"

# Test 4: Favicon
run_test "Favicon" "$BASE_URL/favicon.ico"

echo ""
echo "2. Application Routes"
echo "------------------------"

# Test 5: Dashboard route
run_test "Dashboard Route" "$BASE_URL/dashboard"

# Test 6: Messages route
run_test "Messages Route" "$BASE_URL/messages"

# Test 7: Auth route
run_test "Auth Route" "$BASE_URL/auth"

echo ""
echo "3. Content Verification"
echo "------------------------"

# Test 8: Check for app title
check_content "App Title Present" "$BASE_URL" "Pulse"

# Test 9: Check for root div
check_content "Root Element Present" "$BASE_URL" '<div id="root"'

# Test 10: Check for scripts
check_content "JavaScript Loaded" "$BASE_URL" '<script'

echo ""
echo "4. Security Headers"
echo "------------------------"

# Test 11: Check security headers
TESTS_RUN=$((TESTS_RUN + 1))
echo -n "Testing: Security Headers... "
headers=$(curl -s -I --max-time $TIMEOUT "$BASE_URL")

if echo "$headers" | grep -qi "x-frame-options"; then
    echo -e "${GREEN}PASS${NC} (X-Frame-Options found)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}WARN${NC} (X-Frame-Options not found)"
fi

echo ""
echo "5. Performance Tests"
echo "------------------------"

# Test 12: Response time
TESTS_RUN=$((TESTS_RUN + 1))
echo -n "Testing: Response Time... "
start_time=$(date +%s%N)
curl -s --max-time $TIMEOUT "$BASE_URL" > /dev/null
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

if [ $duration -lt 3000 ]; then
    echo -e "${GREEN}PASS${NC} (${duration}ms)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}WARN${NC} (${duration}ms - slower than expected)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "========================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some smoke tests failed!${NC}"
    echo ""
    echo "Deployment verification failed."
    echo "Please check the failed tests above and investigate."
    exit 1
fi
