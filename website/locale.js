(function () {
  var STORAGE_KEY = "pagehand:site-locale";

  function bind() {
    document.querySelectorAll(".lang-switch a[data-locale]").forEach(function (link) {
      link.addEventListener("click", function () {
        try {
          localStorage.setItem(STORAGE_KEY, link.getAttribute("data-locale"));
        } catch (_) {}
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
