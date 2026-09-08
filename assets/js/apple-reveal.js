(function () {
  var root = document.querySelector(".landing-body");
  if (!root) return;
  var els = root.querySelectorAll(".r");
  if (!els.length) return;
  var supported =
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!supported) {
    els.forEach(function (el) {
      el.classList.add("in");
    });
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  els.forEach(function (el, i) {
    el.style.transitionDelay = Math.min(i % 4, 3) * 90 + "ms";
    io.observe(el);
  });
})();
