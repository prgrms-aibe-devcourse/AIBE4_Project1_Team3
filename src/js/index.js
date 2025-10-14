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
  USD: { name: "미국", unit: "달러" },
  EUR: { name: "유럽", unit: "유로" },
  JPY100: { name: "일본", unit: "100엔" },
  CNH: { name: "중국", unit: "위안" },
  THB: { name: "태국", unit: "바트" },
  GBP: { name: "영국", unit: "파운드" },
};

async function renderGraph() {
  const response = await fetch("http://localhost:3000/api/exchange");
  const apiData = await response.json();
  const { labels, data: currencyData } = apiData;
  // 3. Chart.js 렌더링
  console.log(apiData);
  const containerGraph = document.querySelector("#recommendation-grid");
  Object.keys(currencyMap).forEach((code) => {
    const countryInfo = currencyMap[code];
    const rateData = currencyData[code];
    //환률 변동 계산
    const currentRate = rateData[rateData.length - 1];
    const initialRate = rateData[0];
    const rateChange = ((currentRate - initialRate) / initialRate) * 100;
    const trendText = rateChange.toFixed(2) + "%";

    let trendColorClass;
    if (rateChange < 0) {
      trendColorClass = "bg-blue-100 text-blue-800"; // 하락 (좋음)
    } else if (rateChange > 0) {
      trendColorClass = "bg-red-100 text-red-800"; // 상승 (나쁨)
    } else {
      trendColorClass = "bg-gray-100 text-gray-800"; // 변화 없음
    }

    const item = document.createElement("div");
    const canvasId = `chart-${code}`;
    item.setAttribute(
      "class",
      "bg-white rounded-xl border border-gray-200 p-6 transition hover:shadow-lg"
    );
    item.innerHTML = `
            <div class="flex justify-between items-center">
              <h3 class="font-bold text-lg">
                ${countryInfo.name}
                <span class="text-sm font-medium text-gray-500">${code} ${
      countryInfo.unit
    }</span>
              </h3>
              <span
                class="${trendColorClass} text-xs font-semibold px-2.5 py-1 rounded-full"
                >${rateChange > 0 ? "+" : ""}${trendText}</span
              >
            </div>
            <div class="mt-4 flex justify-between text-sm text-gray-600">
              <p>현재 환율: <span class="font-bold text-black">${currentRate.toLocaleString()}원</span></p>
              <p>6개월전 환율: <span class="font-bold text-black">${initialRate.toLocaleString()}원</span></p>
              
            </div>
            <div class="mt-4">
              <canvas id="${canvasId}"></canvas>
            </div>
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
        labels: labels,
        datasets: [
          {
            label: `${code} 환율`,
            data: rateData,
            borderColor: "#123553",
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },

      options: {
        ...commonOptions,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: fontColor },
            title: { display: true, text: "개월", color: fontColor },
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
