window.handleFormSubmit = async function (event) {
  event.preventDefault();

  const form = event.target;
  const startDate = form.elements.start_date.value;
  const endDate = form.elements.end_date.value;
  const budget = form.elements.budget.value;
  const people = form.elements.people.value;

  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML =
    '<p class="text-center">Gemini가 여행지를 추천하는 중입니다... 잠시만 기다려주세요. 🤖</p>';

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
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = ""; // 이전 결과 초기화

  if (recommendations && recommendations.length > 0) {
    const ol = document.createElement("ol");
    ol.className = "list-decimal list-inside space-y-2 text-left";
    recommendations.forEach((rec) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong class="font-semibold text-gray-900">${rec.country}</strong>: ${rec.reason}`;
      ol.appendChild(li);
    });
    resultsDiv.appendChild(ol);
  } else {
    resultsDiv.innerHTML = "<p>추천 결과를 받지 못했습니다.</p>";
  }
}
