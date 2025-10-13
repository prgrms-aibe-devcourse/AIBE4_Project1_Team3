// API 서버 주소
const apiServerUrl = "http://localhost:3000";

let page = 1;
let totalPages = 1;

// 게시글 로드
async function loadPosts() {
  const res = await fetch(`${apiServerUrl}/api/review?page=${page}`);
  const result = await res.json();

  const container = document.getElementById("postsBody");
  container.innerHTML = result.data
    .map(
      (post) =>
        `<tr onclick="goDetail(${post.id})" style="cursor:pointer;">
                <td>${post.title}</td>
                <td>${makeStars(post.rate)}</td>
                <td>${formatDate(post.created_at)}</td>
              </tr>`
    )
    .join("");

  totalPages = result.totalPages;
  document.getElementById("pageInfo").textContent = `${page} / ${totalPages}`;

  document.getElementById("prev").disabled = page === 1;
  document.getElementById("next").disabled = page >= result.totalPages;
}

// 게시글 클릭 시 상세페이지로 이동
function goDetail(id) {
  //window.location.href = `http://localhost:3000/review/detail?id=${id}`;
}

// 이전
document.getElementById("prev").onclick = () => {
  if (page > 1) {
    page--;
    loadPosts();
  }
};

// 다음
document.getElementById("next").onclick = () => {
  page++;
  loadPosts();
};

function makeStars(rating) {
  const full = "★".repeat(rating);
  const empty = "☆".repeat(5 - rating);
  return `<span style="color:#000;">${full}${empty}</span>`;
}

// 날짜 포맷
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    // hh:mm
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } else {
    // yyyy-MM-dd
    return date
      .toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\.$/g, ""); // 일부 브라우저에서 뒤에 . 붙는 것 제거
  }
}

document.addEventListener("DOMContentLoaded", loadPosts);
