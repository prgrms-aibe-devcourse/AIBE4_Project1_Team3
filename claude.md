# ✅ 일정 순서 정렬 문제 - 완전 해결됨

## 문제 요약 (해결됨)
AI가 생성하는 일정에서 스톱(Stops)의 순서가 실제 시간 흐름과 맞지 않았던 문제.
예: "아침 → 저녁 → 점심"처럼 식사와 관광 순서가 뒤섞여 출력되던 현상.

## 해결 방법 (3단계 방어선 적용)

### 1단계: AI 프롬프트 강화
- **위치**: `server/controllers/recommendController.js` (78-106줄)
- **내용**:
  - 명확한 시간대별 순서 규칙 추가 (morning → late_morning → afternoon → tea → evening → night)
  - 잘못된 예시와 올바른 예시를 명시적으로 제시
  - "이 규칙을 어기면 응답 전체가 무효 처리됨" 경고 추가

### 2단계: 백엔드 정렬 강화
- **위치**: `server/services/recommendService.js`
- **개선 사항**:
  - `TIME_SLOT_ORDER` 상수에 시간대 주석 추가 (106-114줄)
  - `inferTimeSlot` 함수에 모든 category 매핑 명확화 (117-139줄)
  - `sortStopsByTime` 함수에 로깅 추가 (정렬 전후 비교) (141-175줄)
  - `ensureReasons` 함수가 항상 정렬된 stops를 반환 (186줄)

### 3단계: 프론트엔드 안전장치
- **위치**: `src/js/recommend.js`
- **개선 사항**:
  - `ItineraryPlanner.inferTimeSlot` 함수 강화 (49-71줄)
  - `ItineraryPlanner.sortByTimeSlot` 함수 개선 (74-88줄)
  - `optimizeDay` 함수 수정: 시간순 정렬을 최우선으로 유지 (90-121줄)
    - 기존: 동선 최적화가 시간 순서를 깨뜨릴 수 있었음
    - 수정: 시간순 정렬 유지하면서 개수/거리만 제한
    - 식사(breakfast/lunch/dinner)는 거리 제한 초과해도 반드시 포함

## 정렬 규칙 (최종 확정)

**시간대 순서 (절대적 규칙):**
1. morning (07:00~09:00) - breakfast, airport
2. late_morning (09:00~12:00) - transfer, sightseeing, shopping
3. afternoon (12:00~14:00) - lunch
4. tea (14:00~17:00) - activity, shopping, cafe, snack
5. evening (17:00~20:00) - dinner, sightseeing
6. night (20:00~23:00) - nightlife, shopping, activity

**category → timeSlot 매핑:**
- breakfast → morning
- lunch → afternoon
- dinner → evening
- snack, cafe → tea
- airport → morning
- transfer → late_morning
- sightseeing → late_morning
- shopping, activity → tea
- nightlife → night

## 테스트 방법
1. 서버 재시작
2. 여행 일정 생성 요청
3. 서버 콘솔에서 "⏰ [시간순 정렬 적용됨]" 로그 확인
4. 응답 데이터의 각 day.stops 배열이 시간순으로 정렬되어 있는지 확인

## 결과
- AI가 잘못된 순서로 생성하더라도, 백엔드와 프론트엔드에서 자동 정렬
- 모든 일정이 항상 시간 흐름대로 표시됨
- 식사 시간이 뒤바뀌는 현상 완전 제거
