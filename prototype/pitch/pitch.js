(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const bar = document.getElementById("bar");
  const cur = document.getElementById("cur");
  const total = document.getElementById("total");
  let i = 0;

  total.textContent = String(slides.length).padStart(2, "0");

  function show(n) {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle("is-active", idx === i));
    cur.textContent = String(i + 1).padStart(2, "0");
    bar.style.width = `${((i + 1) / slides.length) * 100}%`;
    document.title = `PULSAR — ${slides[i].dataset.title || "Pitch"}`;
  }

  document.getElementById("prev").addEventListener("click", () => show(i - 1));
  document.getElementById("next").addEventListener("click", () => show(i + 1));

  window.addEventListener("keydown", (e) => {
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
      e.preventDefault();
      show(i + 1);
    }
    if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
      e.preventDefault();
      show(i - 1);
    }
    if (e.key === "Home") show(0);
    if (e.key === "End") show(slides.length - 1);
  });

  let touchX = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      touchX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchend",
    (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].screenX - touchX;
      if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
      touchX = null;
    },
    { passive: true }
  );

  show(0);
})();
