/**
 * 숫자를 통화 형식으로 변환합니다.
 * @param {number|string} value - 숫자 또는 문자열
 * @param {string} currencySymbol - 통화 기호 (기본: ₩)
 * @returns {string} 포맷된 문자열 (예: ₩1,000,000)
 */
export function formatCurrency(value, currencySymbol = "₩") {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(String(value).replace(/[^\d.-]/g, "")); // 숫자만 추출
  if (isNaN(number)) return value;
  return `${currencySymbol}${number.toLocaleString("ko-KR")}`;
}

/**
 * 날짜 문자열을 표준 포맷(YYYY.MM.DD)으로 변환합니다.
 * @param {string} dateStr - 원본 날짜 문자열
 * @returns {string} 포맷된 날짜
 */
export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * 여행 기간 문자열을 'YYYY.MM.DD ~ YYYY.MM.DD' 형태로 정리합니다.
 * @param {string} period - 입력된 기간 문자열
 * @returns {string} 정제된 기간
 */
export function formatPeriod(period) {
  if (!period) return "-";
  return period.replace(/\s+/g, "").replace(/-/g, ".").replace(/~/g, " ~ ");
}
