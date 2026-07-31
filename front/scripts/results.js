const typeLabels = { musicas: "Músicas", artistas: "Artistas", albuns: "Álbuns" };

const elements = {
  context: document.getElementById("result-context"),
  list: document.getElementById("cart-items-list"),
  count: document.getElementById("summary-items"),
  plays: document.getElementById("summary-plays"),
  metricLabel: document.getElementById("summary-metric-label"),
  metric: document.getElementById("summary-metric"),
  download: document.getElementById("btn-download"),
  downloadStatus: document.getElementById("download-status"),
};

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDuration(seconds) {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}min` : `${minutes} min`;
}

function showMessage(message, state = "error") {
  elements.list.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.className = "status-message";
  paragraph.dataset.state = state;
  paragraph.textContent = message;
  elements.list.append(paragraph);
}

function createItem(item, type) {
  const row = document.createElement("article");
  row.className = "cart-item";
  const main = document.createElement("div");
  main.className = "item-main";

  if (item.image) {
    const image = document.createElement("img");
    image.className = "cover";
    image.src = item.image;
    image.alt = "";
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.replaceWith(createPlaceholder()));
    main.append(image);
  } else {
    main.append(createPlaceholder());
  }

  const details = document.createElement("div");
  const title = document.createElement("span");
  title.className = "item-title";
  title.textContent = item.name;
  title.title = item.name;
  details.append(title);
  if (item.artist) {
    const artist = document.createElement("span");
    artist.className = "item-artist";
    artist.textContent = item.artist;
    artist.title = item.artist;
    details.append(artist);
  }
  main.append(details);
  row.append(main, createStat("Plays", `×${formatNumber(item.playcount)}`));
  if (type === "musicas") row.append(createStat("Duração", formatDuration(item.duration)));
  return row;
}

function createPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "cover-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.textContent = "♪";
  return placeholder;
}

function createStat(label, value) {
  const stat = document.createElement("div");
  stat.className = "item-stat";
  const labelElement = document.createElement("span");
  labelElement.className = "item-stat-label";
  labelElement.textContent = label;
  const valueElement = document.createElement("span");
  valueElement.className = "item-stat-value";
  valueElement.textContent = value;
  stat.append(labelElement, valueElement);
  return stat;
}

async function loadResults() {
  const params = new URLSearchParams(window.location.search);
  const user = params.get("user")?.trim() || "";
  const period = params.get("periodo") || "";
  const type = params.get("tipo") || "";
  const validUser = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$/.test(user);

  if (!validUser || !typeLabels[type] || !["1_mes", "6_meses", "todo_tempo"].includes(period)) {
    showMessage("Esta consulta é inválida. Volte e informe os dados novamente.");
    return;
  }

  elements.context.textContent = `${typeLabels[type]} mais ouvidos`;
  try {
    const response = await fetch(`/api/gerar?${new URLSearchParams({ user, periodo: period, tipo: type })}`, { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || data.erro) throw new Error(data.erro || "Não foi possível gerar o recibo.");
    if (!Array.isArray(data) || !data.length) {
      showMessage("Nenhum dado foi encontrado para esses filtros. Tente outro período.", "empty");
      return;
    }

    elements.list.replaceChildren(...data.map((item) => createItem(item, type)));
    const totalPlays = data.reduce((sum, item) => sum + Number(item.playcount || 0), 0);
    const totalSeconds = data.reduce((sum, item) => sum + Number(item.duration || 0) * Number(item.playcount || 0), 0);
    elements.count.textContent = `${data.length} ${typeLabels[type].toLowerCase()}`;
    elements.plays.textContent = formatNumber(totalPlays);
    elements.metricLabel.textContent = type === "musicas" ? "Tempo estimado" : "Tipo de lista";
    elements.metric.textContent = type === "musicas" ? formatDuration(totalSeconds) : typeLabels[type];
    elements.download.disabled = false;
  } catch (error) {
    showMessage(error.message || "Não foi possível carregar o recibo.");
  }
}

function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error("Não foi possível preparar o download."));
    document.head.append(script);
  });
}

elements.download.addEventListener("click", async () => {
  elements.download.disabled = true;
  elements.download.textContent = "Preparando imagem…";
  elements.downloadStatus.textContent = "Preparando o download da imagem.";
  try {
    const html2canvas = await loadHtml2Canvas();
    const canvas = await html2canvas(document.getElementById("receipt-export"), { backgroundColor: "#120d0a", scale: Math.min(window.devicePixelRatio || 1, 2), useCORS: true, allowTaint: false, logging: false });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Não foi possível gerar a imagem.");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "recibo-cartify.png";
    link.click();
    URL.revokeObjectURL(link.href);
    elements.downloadStatus.textContent = "Download iniciado.";
  } catch (error) {
    elements.downloadStatus.textContent = error.message || "Falha ao baixar a imagem.";
  } finally {
    elements.download.disabled = false;
    elements.download.textContent = "Baixar PNG";
  }
});

loadResults();
