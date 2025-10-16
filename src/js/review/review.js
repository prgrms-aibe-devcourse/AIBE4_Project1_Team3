// API 서버 주소
const apiServerUrl = "https://aibe4-project1-team3.onrender.com";

let page = 1;
let totalPages = 1;
let sortType = "latest";

// 게시글 로드
async function loadPosts() {
  const res = await fetch(
    `${apiServerUrl}/api/review/receive?page=${page}&sortType=${sortType}`
  );
  const result = await res.json();

  const container = document.getElementById("postsBody");
  container.innerHTML = result.data
    .map(
      (post) => `
      <tr data-id="${post.id}" style="cursor:pointer;">
        <td>${post.title}</td>
        <td>${makeStars(post.rating)}</td>
        <td>${formatDate(post.created_at)}</td>
      </tr>`
    )
    .join("");

  container.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => goDetail(tr.dataset.id));
  });

  totalPages = result.totalPages;
  document.getElementById("pageInfo").textContent = `${page} / ${totalPages}`;

  document.getElementById("prev").disabled = page === 1;
  document.getElementById("next").disabled = page >= result.totalPages;
}

// 게시글 클릭 시 상세페이지로 이동
function goDetail(id) {
  window.location.href = `/review-detail.html?id=${id}`;
}

// 게시글 정렬
document.getElementById("sortSelect").onchange = () => {
  sortType = document.getElementById("sortSelect").value;
  page = 1;
  loadPosts();
};

// 이전
document.getElementById("prev").onclick = () => {
  if (page > 1) {
    page--;
    loadPosts();
  }
};

// 다음
document.getElementById("next").onclick = () => {
  if (page < totalPages) {
    page++;
    loadPosts();
  }
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
