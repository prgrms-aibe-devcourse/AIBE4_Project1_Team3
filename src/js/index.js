window.handleFormSubmit = async function (event) {
  event.preventDefault();

  const form = event.target;
  const startDate = form.elements.start_date.value;
  const endDate = form.elements.end_date.value;
  const budget = form.elements.budget.value;
  const people = form.elements.people.value;

  const resultsDiv = document.getElementById("results-container");

  document.getElementById("recommendation-grid").classList.add("hidden");

  let loadingP = document.getElementById("loading-message");
  if (!loadingP) {
    loadingP = document.createElement("p");
    loadingP.id = "loading-message";
    loadingP.className = "text-center";
    resultsDiv.prepend(loadingP);
  }
  loadingP.innerHTML = "여행지를 추천하는 중입니다... 잠시만 기다려주세요.";
  loadingP.classList.remove("hidden");

  try {
    const response = await fetch("http://localhost:3000/api/recommend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ startDate, endDate, budget, people }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "서버에서 오류가 발생했습니다.");
    }

    const text = await response.text();
    const jsonText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const data = JSON.parse(jsonText);

    displayResults(data.recommendations);
  } catch (error) {
    console.error("Error:", error);
    resultsDiv.innerHTML = `<p class="text-center text-red-500">오류가 발생했습니다: ${error.message}</p>`;
  }
};

function displayResults(recommendations) {
  const loadingP = document.getElementById("loading-message");
  if (loadingP) loadingP.classList.add("hidden");

  const recommendationGrid = document.getElementById("recommendation-grid");
  recommendationGrid.classList.remove("hidden");

  recommendations.forEach((rec, index) => {
    const rank = index + 1;
    document.getElementById(`country-${rank}`).innerText = rec.country;
    document.getElementById(`current-rate-${rank}`).innerText =
      rec.current_rate;
    document.getElementById(`future_rate-${rank}`).innerText = rec.future_rate;
  });
}

function getFormattedDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function initializeForm() {
  const today = getFormattedDate();
  document.querySelector('input[name="start_date"]').value = today;
  document.querySelector('input[name="end_date"]').value = today;
}
initializeForm();

// chart

document.addEventListener("DOMContentLoaded", renderGraph);
const currencyMap = {
  USD: { name: "미국", unit: "달러", color: "#6366F1" }, // Indigo
  EUR: { name: "유럽", unit: "유로", color: "#EF4444" }, // Red
  JPY: { name: "일본", unit: "100엔", color: "#10B981" }, // Emerald
  CNY: { name: "중국", unit: "위안", color: "#F59E0B" }, // Amber
  AUD: { name: "호주", unit: "달러", color: "#3B82F6" }, // Blue
  GBP: { name: "영국", unit: "파운드", color: "#A855F7" }, // Violet
};

function renderGraph() {

  // const datasets = targetCurrencies
  //   7일치 데이터가 있는 통화만 필터링
  //   .filter(
  //     (code) =>
  //       currencyData[code] && currencyData[code].length === labels.length
  //   )
  //   .map((code) => ({
  //     label: `${code} 환율`,
  //     data: currencyData[code],
  //     borderColor: colors[code],
  //     backgroundColor: colors[code] + "20",
  //     borderWidth: 2,
  //     fill: false,
  //     tension: 0.2,
  //   }));

  // 3. Chart.js 렌더링

  const containerGraph = document.querySelector("#recommendation-grid");
  Object.keys(currencyMap).forEach((code) => {
    const item = document.createElement("div");
    const canvasId = `chart-${code}`;
    item.setAttribute(
      "class",
      "bg-white rounded-xl border border-gray-200 p-6 transition hover:shadow-lg"
    );
    item.innerHTML = `
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-lg">
                ${currencyMap[code].name}
                <span class="text-sm font-medium text-gray-500">${currencyMap[code].unit}</span>
              </h3>
              <span
                class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full"
                >-1.7%</span
              >
            </div>
            <div class="mt-4 flex justify-between text-sm text-gray-600">
              <p>현재 환율: <span class="font-bold text-black">¥ 820</span></p>
              
            </div>
            <div class="mt-4">
              <canvas id="${canvasId}"></canvas>
            </div>
            <button
              class="mt-6 w-full text-center py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              추천 루트 보기
            </button>
            `;
    containerGraph.appendChild(item);

    const isDark = document.documentElement.classList.contains("dark");
    const fontColor = isDark ? "#9CA3AF" : "#6B7280";
    const gridColor = isDark
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.1)";

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? "#1E2028" : "#FFF",
          titleColor: isDark ? "#FFF" : "#000",
          bodyColor: isDark ? "#FFF" : "#000",
          bodyFont: {
            size: 13,
          },
          padding: 12,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          borderWidth: 1,
          displayColors: false,
        },
      },
    };

    const ctx = document.querySelector("#" + canvasId).getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.2)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0)");

    new Chart(ctx, {
      type: "line",
      data: {
        labels: [1, 2, 3, 4, 5],
        datasets: [
          {
            data: [30000, 35000, 32000, 38000, 35000],
            borderColor: "#6366F1",
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      //   data: {
      //     labels: labels, // 서버에서 받은 라벨 사용
      //     datasets: datasets, // 서버에서 가공된 데이터셋 사용
      //   },

      options: {
        ...commonOptions,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: fontColor },
            title: { display: true, text: "영업일", color: fontColor },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: fontColor,
              callback: (value) => value.toLocaleString(),
            },
            title: {
              display: true,
              text: "환율 (KRW)",
              color: fontColor,
            },
          },
        },
      },
    });
  });
}
