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

    const data = await response.json();

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
    document.getElementById(`forcasted_exchange_rate-${rank}`).innerText =
      rec.forcasted_exchange_rate;
    document.getElementById(`reason-${rank}`).innerText = rec.reason;
    document.getElementById(`per_cost-${rank}`).innerText = rec.per_cost;
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
