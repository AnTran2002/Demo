// core/router.js
// Router SPA đơn giản dựa trên hash (#/login, #/admin, #/teacher, #/student...)
// Không dùng framework, chỉ render nội dung vào #app theo route.

const routes = {};

function registerRoute(path, renderFn) {
  routes[path] = renderFn;
}

function navigate(path) {
  window.location.hash = path;
}

function resolveRoute() {
  const path = window.location.hash.replace("#", "") || "/login";
  const render = routes[path] || routes["/not-found"];
  const app = document.getElementById("app");
  app.innerHTML = "";
  if (render) render(app);
}

function initRouter() {
  window.addEventListener("hashchange", resolveRoute);
  window.addEventListener("DOMContentLoaded", resolveRoute);
}

export const Router = { registerRoute, navigate, initRouter };
