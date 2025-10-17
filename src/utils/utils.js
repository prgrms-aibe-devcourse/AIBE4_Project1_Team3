const apiBaseUrl = (() => {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:10000";
  }
  return "https://aibe4-project1-team3.onrender.com";
})();

export default apiBaseUrl;
