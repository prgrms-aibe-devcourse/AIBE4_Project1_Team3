let exchangeRatesData;

document.addEventListener("DOMContentLoaded", async () => {
  exchangeRatesData = await renderGraph();
  console.log(exchangeRatesData);

  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const today = new Date().toISOString().split("T")[0];

  startDateInput.setAttribute("min", today);

  startDateInput.value = today;

  startDateInput.addEventListener("change", function () {
    const selectedStartDate = startDateInput.value;

    endDateInput.setAttribute("min", selectedStartDate);

    if (endDateInput.value < selectedStartDate) {
      endDateInput.value = selectedStartDate;
    }
  });

  endDateInput.setAttribute("min", startDateInput.value);
});

window.handleFormSubmit = async function (event) {
  event.preventDefault();

  const apiBaseUrl = "https://aibe4-project1-team3.onrender.com";
  const form = event.target;
  const startDate = form.elements.start_date.value;
  const endDate = form.elements.end_date.value;
  const budget = form.elements.budget.value.replace(/,/g, "");
  const people = form.elements.people.value;

  const resultsDiv = document.getElementById("resultsContainer");

  let loadingP = document.getElementById("loadingMessage");
  if (!loadingP) {
    loadingP = document.createElement("p");
    loadingP.id = "loadingMessage";
    loadingP.className = "text-center";
    resultsDiv.prepend(loadingP);
  }
  loadingP.innerHTML = "여행지를 추천하는 중입니다... 잠시만 기다려주세요.";
  loadingP.classList.remove("hidden");

  try {
    const response = await fetch(`${apiBaseUrl}/api/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        budget,
        people,
        exchangeRatesData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "서버에서 오류가 발생했습니다.");
    }

    const data = await response.json();

    displayResults(data.recommendations);
  } catch (error) {
    console.error("Error:", error);
    resultsDiv.innerHTML = `<p class="text-center text-red-500">오류가 발생했습니다: ${error.message}</p>`;
  }
};

function trendColor(rateChange) {
  let trendColorClass;

  if (rateChange < 0) {
    trendColorClass = "bg-blue-100 text-blue-800"; // 하락 (좋음)
  } else if (rateChange > 0) {
    trendColorClass = "bg-red-100 text-red-800"; // 상승 (나쁨)
  } else {
    trendColorClass = "bg-gray-100 text-gray-800"; // 변화 없음
  }
  return trendColorClass;
}

function displayResults(recommendations) {
  const loadingP = document.getElementById("loadingMessage");
  if (loadingP) loadingP.classList.add("hidden");

  const recommendationGrid = document.getElementById("recommendationGrid");
  recommendationGrid.classList.remove("hidden");

  const form = document.querySelector("form");
  const startDate = form.elements.start_date.value;
  const endDate = form.elements.end_date.value;
  const budget = form.elements.budget.value.replace(/,/g, "");
  const people = form.elements.people.value;

  recommendations.forEach((rec, index) => {
    const rank = index + 1;
    document.getElementById(`country${rank}`).innerText = rec.country;
    document.getElementById(`currentRate${rank}`).innerText =
      rec.current_rate.toLocaleString("ko-KR");
    document.getElementById(`forecastedExchangeRate${rank}`).innerText =
      rec.forecasted_exchange_rate.toLocaleString("ko-KR");
    document.getElementById(`reason${rank}`).innerText = rec.reason;
    document.getElementById(`perCostRange${rank}`).innerText =
      rec.per_cost_range.toLocaleString("ko-KR") + "원";

    const trendEl = document.getElementById(`trend${rank}`);
    const rateChange = rec.trend.replace("%", "");
    trendEl.innerText = `${rateChange > 0 ? "+" : ""}${rec.trend}`;
    let trendColorClass;

    trendColorClass = trendColor(rateChange);
    trendEl.classList.add(...trendColorClass.split(" "));
  });

  // 추천 루트 보기 버튼에 클릭 이벤트 추가
  const cards = document.querySelectorAll("#recommendationGrid > div");
  cards.forEach((card, index) => {
    const button = card.querySelector("button");
    if (button && recommendations[index]) {
      button.onclick = () => {
        // localStorage에 검색 조건 저장
        const searchData = {
          city: recommendations[index].country,
          startDate: startDate,
          endDate: endDate,
          people: people,
          budget: budget,
        };
        localStorage.setItem("travelSearchData", JSON.stringify(searchData));

        // URL 파라미터 없이 recommend.html로 이동
        window.location.href = "recommend.html";
      };
    }
  });
}

window.formatBudget = function (input) {
  let value = input.value.replace(/[^\d]/g, "");
  if (value) {
    input.value = parseInt(value, 10).toLocaleString("ko-KR");
  }
};

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

function getNextUpdateTime() {
  const now = new Date();
  const nextUpdate = new Date(now);

  // 오늘 오전 11시로 설정
  nextUpdate.setHours(11, 0, 0, 0);

  // 만약 현재 시간이 11시를 지났다면, 다음 날 11시로 설정
  if (now.getTime() >= nextUpdate.getTime()) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }

  return nextUpdate.getTime();
}

const currencyMap = {
  USD: { name: "미국", unit: "달러" },
  EUR: { name: "유럽", unit: "유로" },
  JPY100: { name: "일본", unit: "100엔" },
  CNH: { name: "중국", unit: "위안" },
  THB: { name: "태국", unit: "바트" },
  GBP: { name: "영국", unit: "파운드" },
};

async function renderGraph() {
  const exchangeRatesData = {};
  const API_URL = "https://aibe4-project1-team3.onrender.com/api/exchange";
  let apiData;

  const cachedData = sessionStorage.getItem("exchangeData");
  const cacheExpires = sessionStorage.getItem("exchangeExpires");
  const now = Date.now();

  // 만료 시간을 숫자로 변환 (변환 실패 시 0으로 처리하여 무효화)
  const expiresTime = cacheExpires ? Number(cacheExpires) : 0;

  if (expiresTime > now && cachedData && expiresTime) {
    console.log("Session Storage에서 캐시된 데이터 로드");
    apiData = JSON.parse(cachedData);
  } else {
    // 2. 캐시 만료 또는 없음: 실제 API 호출
    try {
      console.log("환율 API 호출 시작");
      const response = await fetch(API_URL);
      apiData = await response.json();

      // 3. 캐시 업데이트 및 저장
      if (apiData && apiData.labels && apiData.labels.length > 0) {
        const nextUpdateTimestamp = getNextUpdateTime();
        sessionStorage.setItem("exchangeData", JSON.stringify(apiData));
        sessionStorage.setItem(
          "exchangeExpires",
          nextUpdateTimestamp.toString()
        );
        console.log(
          `새 데이터 저장. 다음 갱신 시간: ${new Date(
            nextUpdateTimestamp
          ).toLocaleString()}`
        );
      } else {
        console.error("API에서 유효하지 않은 데이터 수신. 캐시하지 않음.");
        return {}; // 빈 객체 반환
      }
    } catch (error) {
      console.error("API 호출 실패:", error);
      return {};
    }
  }

  const { labels, data: currencyData } = apiData;
  // 3. Chart.js 렌더링
  console.log(apiData);
  const containerGraph = document.querySelector("#chartGrid");
  Object.keys(currencyMap).forEach((code) => {
    const countryInfo = currencyMap[code];
    const rateData = currencyData[code];
    //환률 변동 계산
    const currentRate = rateData[rateData.length - 1];
    const initialRate = rateData[0];
    const rateChange = ((currentRate - initialRate) / initialRate) * 100;
    const trendText = rateChange.toFixed(2) + "%";

    exchangeRatesData[code] = {
      current: currentRate,
      historical: rateData
        .slice(0, rateData.length - 1)
        .map((value) => (value === null || value === undefined ? 0 : value)),
      trend: trendText,
    };

    const trendColorClass = trendColor(rateChange);

    const item = document.createElement("div");
    const canvasId = `chart${code}`;
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
  return exchangeRatesData;
}
