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

/**
 * 도시명을 기반으로 통화 기호를 반환합니다.
 * @param {string} city - 도시명
 * @returns {string} 통화 기호
 */
export function getCurrencySymbol(city) {
  const cityLower = (city || "").toLowerCase().trim();

  // 일본
  if (cityLower.includes("도쿄") || cityLower.includes("오사카") ||
      cityLower.includes("교토") || cityLower.includes("후쿠오카") ||
      cityLower.includes("삿포로") || cityLower.includes("나고야") ||
      cityLower.includes("tokyo") || cityLower.includes("osaka") ||
      cityLower.includes("kyoto") || cityLower.includes("fukuoka") ||
      cityLower.includes("sapporo") || cityLower.includes("nagoya")) {
    return "¥";
  }

  // 미국
  if (cityLower.includes("뉴욕") || cityLower.includes("로스앤젤레스") ||
      cityLower.includes("샌프란시스코") || cityLower.includes("시애틀") ||
      cityLower.includes("라스베가스") || cityLower.includes("워싱턴") ||
      cityLower.includes("new york") || cityLower.includes("los angeles") ||
      cityLower.includes("san francisco") || cityLower.includes("seattle") ||
      cityLower.includes("las vegas") || cityLower.includes("washington")) {
    return "$";
  }

  // 유럽 (유로존)
  if (cityLower.includes("파리") || cityLower.includes("런던") ||
      cityLower.includes("로마") || cityLower.includes("바르셀로나") ||
      cityLower.includes("암스테르담") || cityLower.includes("베를린") ||
      cityLower.includes("paris") || cityLower.includes("london") ||
      cityLower.includes("rome") || cityLower.includes("barcelona") ||
      cityLower.includes("amsterdam") || cityLower.includes("berlin")) {
    return "€";
  }

  // 영국 (파운드)
  if (cityLower.includes("런던") || cityLower.includes("london")) {
    return "£";
  }

  // 중국
  if (cityLower.includes("베이징") || cityLower.includes("상하이") ||
      cityLower.includes("홍콩") || cityLower.includes("광저우") ||
      cityLower.includes("beijing") || cityLower.includes("shanghai") ||
      cityLower.includes("hong kong") || cityLower.includes("guangzhou")) {
    return "¥";
  }

  // 태국
  if (cityLower.includes("방콕") || cityLower.includes("푸켓") ||
      cityLower.includes("bangkok") || cityLower.includes("phuket")) {
    return "฿";
  }

  // 베트남
  if (cityLower.includes("하노이") || cityLower.includes("호치민") ||
      cityLower.includes("다낭") || cityLower.includes("hanoi") ||
      cityLower.includes("ho chi minh") || cityLower.includes("danang")) {
    return "₫";
  }

  // 기본값 (원화)
  return "₩";
}
