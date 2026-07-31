document.querySelectorAll("[data-toggle-group]").forEach((group) => {
  const input = document.getElementById(group.dataset.input);
  const buttons = [...group.querySelectorAll("button[data-value]")];

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.value;
      buttons.forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(candidate === button));
      });
    });
  });
});
