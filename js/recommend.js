import { getAiRecommendation } from "./api/ai.js";
import { showLoading, hideLoading } from "./components/loading.js";
import { formatCurrency } from "./utils/format.js";

let leafletMap;
let routeLayerGroup;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("travelForm");
  const resultContainer = document.getElementById("recommendResult");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const startInput = document.getElementById("travelStart");
  const endInput = document.getElementById("travelEnd");
  const budgetInput = document.getElementById("travelBudget");

  initMap([35.6762, 139.6503], 5);

  budgetInput.addEventListener("input", (e) => {
    const posFromEnd = e.target.value.length - e.target.selectionStart;
    const onlyNum = e.target.value.replace(/[^\d]/g, "");
    e.target.value = onlyNum ? Number(onlyNum).toLocaleString("ko-KR") : "";
    const newPos = e.target.value.length - posFromEnd;
    e.target.setSelectionRange(newPos, newPos);
  });

  startInput.addEventListener("change", () => {
    endInput.min = startInput.value || "";
    if (endInput.value && endInput.value < endInput.min)
      endInput.value = endInput.min;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const people = document.getElementById("travelPeople").value.trim();
    const start = startInput.value;
    const end = endInput.value;
    const budgetFormatted = budgetInput.value;

    if (!start || !end || !people || !budgetFormatted) {
      alert("기간 / 인원 / 경비를 모두 입력해주세요.");
      return;
    }

    const period = `${toYmdDot(start)} ~ ${toYmdDot(end)}`;
    const budget = budgetFormatted.replace(/[^\d]/g, "");

    showLoading(loadingIndicator);
    try {
      const data = await getAiRecommendation({
        period,
        startDate: start,
        endDate: end,
        people,
        budget,
      });
      renderRecommendation(data, resultContainer);
      renderMapWithRoutes(data.routes);
    } catch (err) {
      console.error(err);
      resultContainer.innerHTML = "<p>추천 데이터를 불러오지 못했습니다.</p>";
    } finally {
      hideLoading(loadingIndicator);
    }
  });
});

function toYmdDot(value) {
  const d = new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function renderRecommendation(data, container) {
  if (!data || !Array.isArray(data.routes)) {
    container.innerHTML = "<p>추천 결과가 없습니다.</p>";
    return;
  }

  container.innerHTML = data.routes
    .map(
      (r) => `
      <article class="route-card">
        <h4>Day ${r.day} - ${r.title}</h4>
        <p>${r.summary}</p>
        <p class="cost">예상 경비: ${formatCurrency(r.estimatedCost)}</p>
      </article>`
    )
    .join("");
}

function initMap(centerLatLng, zoom = 6) {
  leafletMap = L.map("mapContainer", { scrollWheelZoom: false }).setView(
    centerLatLng,
    zoom
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(leafletMap);
  routeLayerGroup = L.layerGroup().addTo(leafletMap);
}

function renderMapWithRoutes(routes) {
  if (!leafletMap || !routeLayerGroup) return;
  routeLayerGroup.clearLayers();

  const latLngs = routes
    .filter((r) => Array.isArray(r.coordinates) && r.coordinates.length === 2)
    .map((r) => r.coordinates);

  routes.forEach((r) => {
    if (!Array.isArray(r.coordinates) || r.coordinates.length !== 2) return;
    const marker = L.marker(r.coordinates).bindPopup(
      `<b>Day ${r.day} - ${r.title}</b><br/>${r.summary}`
    );
    marker.addTo(routeLayerGroup);
  });

  if (latLngs.length >= 2) {
    L.polyline(latLngs, { color: "#0ea5ff", weight: 4, opacity: 0.9 }).addTo(
      routeLayerGroup
    );
    leafletMap.fitBounds(L.latLngBounds(latLngs), { padding: [30, 30] });
  } else if (latLngs.length === 1) {
    leafletMap.setView(latLngs[0], 11);
  }
}
