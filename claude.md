# 🧩 AI 일정 금액 불일치 수정 가이드

## 문제
AI가 생성한 일정에서 `비용 근거`(costReason)로는 14,250원인데  
UI 우측 상단의 `₩66,700` 또는 `일자 합계`가 맞지 않는 현상이 발생한다.

**원인**
- 동선 최적화(`optimizeAll`) 시 스톱 일부가 제거되었는데, `dayTotal`이 다시 계산되지 않음.
- 프론트가 `dayTotal`을 그대로 렌더링하고 있어 실제 표시된 스톱 합계와 불일치.

---

## ✅ 해결 요약

### 1. `calculateDaySums` 수정
> 프론트에서 “보이는 스톱들의 합계”를 기준으로 다시 계산하도록 변경한다.

```diff
class RecommendationRenderer {
  ...
-  calculateDaySums(days) {
-    return days.map((dp) => {
-      return Number(dp.dayTotal) || 0;
-    });
-  }
+  calculateDaySums(days) {
+    return days.map((dp) =>
+      (dp.stops || []).reduce((sum, s) => sum + (Number(s.estimatedCost) || 0), 0)
+    );
+  }
2. 최적화 이후 합계 재계산
optimizeAll()이 스톱 수를 변경하므로, 그 이후 dayTotal과 overallTotal을 새로 합산한다.

diff
코드 복사
sanitizePlan(itinerary, fx); // ① 응답 직후
const optimized = ItineraryPlanner.optimizeAll(itinerary.dayPlans || []);
const finalItin = { city: itinerary.city || city, dayPlans: optimized };
+sanitizePlan(finalItin, fx); // ② 최적화 후 한 번 더 호출 (합계 최신화)
또는 직접 재계산:

js
코드 복사
finalItin.dayPlans.forEach(dp => {
  dp.dayTotal = (dp.stops || []).reduce((t, s) => t + (Number(s.estimatedCost) || 0), 0);
});
finalItin.overallTotal = finalItin.dayPlans.reduce((t, dp) => t + (Number(dp.dayTotal) || 0), 0);
3. sanitizePlan 정규식 강화 (선택)
비용 근거 텍스트 끝의 원화 값(→ ####원)을 더 정확히 추출하기 위해 수정한다.

js
코드 복사
const m = text.match(/→\s*([\d,]+)\s*원(?:\s*\(1인\))?\s*$/);
4. 체크리스트
항목	확인
UI가 stop.estimatedCost만을 사용하여 금액 표시하는가?	✅
calculateDaySums가 실제 스톱들의 합계로 계산되는가?	✅
optimizeAll 이후 dayTotal과 overallTotal을 재계산했는가?	✅
costReason과 estimatedCost가 sanitizePlan에서 일치되도록 정규화되었는가?	✅

💡결과
이 패치를 적용하면 다음이 보장된다:

“비용 근거 보기”의 금액 = 우측 금액 = 일자 합계

동선 최적화나 중간 스톱 삭제 후에도 항상 일관된 합계 표시

yaml
코드 복사

---  
