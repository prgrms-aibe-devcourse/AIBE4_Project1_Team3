/**
 * 숫자를 통화 형식으로 변환합니다.
 * @param {number|string} value - 숫자 또는 문자열
 * @param {string} currencySymbol - 통화 기호 (기본: ₩)
 * @returns {string} 포맷된 문자열 (예: ₩1,000,000)
 */
export function formatCurrency(value, currencySymbol = "₩") {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  if (isNaN(number)) return value;
  return `${currencySymbol}${number.toLocaleString("ko-KR")}`;
}

/**
 * 문자열에서 숫자만 추출합니다.
 * @param {string|number} value - 입력 값
 * @returns {string} 숫자만 포함된 문자열
 */
export function stripDigits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

/**
 * 날짜 문자열을 YYYY.MM.DD 포맷으로 변환합니다.
 * @param {string|Date} dateValue - 날짜 값
 * @returns {string} 포맷된 날짜
 */
export function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (isNaN(date)) return "-";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * 두 날짜 사이의 일수를 계산합니다.
 * @param {string|Date} startDate - 시작 날짜
 * @param {string|Date} endDate - 종료 날짜
 * @returns {number} 일수 (최소 1)
 */
export function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}
