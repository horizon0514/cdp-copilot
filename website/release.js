(function () {
  var REPO = "horizon0514/pagehand";
  var API = "https://api.github.com/repos/" + REPO + "/releases/latest";
  var LATEST_ZIP =
    "https://github.com/" + REPO + "/releases/latest/download/pagehand.zip";

  function apply(tag) {
    var zip =
      "https://github.com/" + REPO + "/releases/download/" + tag + "/pagehand.zip";
    var page = "https://github.com/" + REPO + "/releases/tag/" + tag;
    var zh = (document.documentElement.lang || "").toLowerCase().indexOf("zh") === 0;

    document.querySelectorAll("[data-release='download']").forEach(function (el) {
      el.setAttribute("href", zip);
    });
    document.querySelectorAll("[data-release='page']").forEach(function (el) {
      el.setAttribute("href", page);
      if (el.hasAttribute("data-release-label")) el.textContent = tag;
    });

    var cta = document.getElementById("install-cta");
    if (cta) cta.textContent = zh ? "下载 " + tag : "Download " + tag;
  }

  fetch(API, {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then(function (res) {
      if (!res.ok) throw new Error("release lookup failed");
      return res.json();
    })
    .then(function (data) {
      if (data && data.tag_name) apply(data.tag_name);
    })
    .catch(function () {
      // Static markup already points at /releases/latest/download/.
      document.querySelectorAll("[data-release='download']").forEach(function (el) {
        if (!el.getAttribute("href")) el.setAttribute("href", LATEST_ZIP);
      });
    });
})();
