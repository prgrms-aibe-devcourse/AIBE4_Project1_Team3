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
        <div class="loading__progress" style="display: none;">
          <span class="progress-text">1/3 완성 중</span>
        </div>
      </div>
    `;
    targetElement.hidden = false;
  }

  /**
   * 진행 상태 메시지를 업데이트
   * @param {HTMLElement} targetElement - 로딩 표시 요소
   * @param {string} message - 표시할 메시지
   */
  export function updateLoadingMessage(targetElement, message) {
    if (!targetElement) return;
    const messageEl = targetElement.querySelector('p');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * 진행 상태 표시를 업데이트 (예: 2/3 완성 중)
   * @param {HTMLElement} targetElement - 로딩 표시 요소
   * @param {number} current - 현재 완성된 일차
   * @param {number} total - 전체 일차
   */
  export function updateProgress(targetElement, current, total) {
    if (!targetElement) return;
    const progressEl = targetElement.querySelector('.loading__progress');
    if (progressEl) {
      progressEl.style.display = 'block';
      const progressText = progressEl.querySelector('.progress-text');
      if (progressText) {
        progressText.textContent = `${current}/${total} 완성 중`;
      }
    }
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
  