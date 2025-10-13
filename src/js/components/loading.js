/**
 * 로딩 애니메이션을 표시
 * @param {HTMLElement} targetElement - 로딩 표시를 넣을 대상
 */
export function showLoading(targetElement) {
    if (!targetElement) return;
  
    targetElement.innerHTML = `
      <div class="loading__spinner" aria-label="로딩 중">
        <div class="spinner"></div>
        <p>AI가 여행 경로를 생성 중입니다...</p>
      </div>
    `;
    targetElement.hidden = false;
  }
  
  /**
   * 로딩 애니메이션을 숨깁니다.
   * @param {HTMLElement} targetElement - 로딩 표시를 제거할 대상
   */
  export function hideLoading(targetElement) {
    if (!targetElement) return;
    targetElement.innerHTML = "";
    targetElement.hidden = true;
  }
  