const typeLabels = { musicas: "Músicas", artistas: "Artistas", albuns: "Álbuns" };
const periodLabels = { "1_mes": "último mês", "6_meses": "últimos 6 meses", todo_tempo: "todo o período" };
const VIEWS = new Set(["carrinho", "recibo"]);
// Mesma regra de USERNAME_PATTERN em back/createApp.js.
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$/;
const HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const HTML2CANVAS_SRI = "sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA==";

const elements = {
  context: document.getElementById("result-context"),
  title: document.getElementById("cart-title"),
  cartExport: document.getElementById("cart-export"),
  cartView: document.getElementById("cart-view"),
  receiptView: document.getElementById("receipt-view"),
  viewButtons: [...document.querySelectorAll("[data-view]")],
  list: document.getElementById("cart-items-list"),
  count: document.getElementById("summary-items"),
  plays: document.getElementById("summary-plays"),
  metricLabel: document.getElementById("summary-metric-label"),
  metric: document.getElementById("summary-metric"),
  download: document.getElementById("btn-download"),
  downloadStatus: document.getElementById("download-status"),
};

let query = null;
let currentView = "carrinho";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDuration(seconds) {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}min` : `${minutes} min`;
}

function formatTrackLength(seconds) {
  if (!seconds) return "—";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showMessage(message, state = "error") {
  const paragraph = createElement("p", "status-message", message);
  paragraph.dataset.state = state;
  elements.list.replaceChildren(paragraph);
}

function createItem(item, type) {
  const row = createElement("article", "cart-item");
  const main = createElement("div", "item-main");

  if (item.image) {
    const image = createElement("img", "cover");
    image.src = item.image;
    image.alt = "";
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.replaceWith(createPlaceholder()));
    main.append(image);
  } else {
    main.append(createPlaceholder());
  }

  const details = createElement("div");
  const title = createElement("span", "item-title", item.name);
  title.title = item.name;
  details.append(title);
  if (item.artist) {
    const artist = createElement("span", "item-artist", item.artist);
    artist.title = item.artist;
    details.append(artist);
  }
  main.append(details);
  row.append(main, createStat("Plays", `×${formatNumber(item.playcount)}`));
  if (type === "musicas") row.append(createStat("Duração", formatTrackLength(item.duration)));
  return row;
}

function createPlaceholder() {
  const placeholder = createElement("div", "cover-placeholder", "♪");
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

function createStat(label, value) {
  const stat = createElement("div", "item-stat");
  stat.append(createElement("span", "item-stat-label", label), createElement("span", "item-stat-value", value));
  return stat;
}

// FNV-1a: gera sempre o mesmo número de cupom e código de barras para a mesma consulta.
function hashString(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function receiptLine(label, value, className) {
  const line = createElement("div", className ? `receipt-line ${className}` : "receipt-line");
  line.append(createElement("span", "", label), createElement("span", "", value));
  return line;
}

function createBarcode(seed) {
  const barcode = createElement("div", "receipt-barcode");
  barcode.setAttribute("aria-hidden", "true");
  let value = seed;
  for (let index = 0; index < 46; index += 1) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const bar = createElement("span");
    bar.style.width = `${1 + ((value >>> 16) % 3)}px`;
    barcode.append(bar);
  }
  return barcode;
}

function buildReceipt(items, totals) {
  const seed = hashString(`${query.user.toLowerCase()}|${query.period}|${query.type}`);
  const paper = createElement("div", "receipt-paper");

  const head = createElement("div", "receipt-head");
  head.append(
    createElement("strong", "receipt-brand", "● Cartify"),
    createElement("span", "", "Cupom não fiscal de audição"),
    createElement("span", "", `Nº ${String(seed % 1_000_000).padStart(6, "0")}`),
  );

  const list = createElement("div", "receipt-items");
  list.append(receiptLine("Item", "Qtd", "receipt-columns"));
  items.forEach((item, index) => {
    const row = createElement("div", "receipt-item");
    row.append(receiptLine(`${String(index + 1).padStart(2, "0")} ${item.name}`, `×${formatNumber(item.playcount)}`));
    const details = [item.artist, query.type === "musicas" ? formatTrackLength(item.duration) : ""].filter((part) => part && part !== "—");
    if (details.length) row.append(createElement("span", "receipt-sub", details.join(" · ")));
    list.append(row);
  });

  paper.append(
    head,
    createElement("div", "receipt-rule"),
    receiptLine("Cliente", query.user),
    receiptLine("Período", periodLabels[query.period]),
    receiptLine("Categoria", typeLabels[query.type]),
    receiptLine("Emissão", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())),
    createElement("div", "receipt-rule"),
    list,
    createElement("div", "receipt-rule"),
    receiptLine("Itens", String(items.length)),
    ...(query.type === "musicas" ? [receiptLine("Tempo estimado", formatDuration(totals.seconds))] : []),
    receiptLine("Total de plays", formatNumber(totals.plays), "receipt-total"),
    createElement("div", "receipt-rule"),
    createElement("p", "receipt-thanks", "Obrigado pela preferência! Volte sempre."),
    createBarcode(seed),
    createElement("p", "receipt-foot", "cartify · dados da last.fm"),
  );
  elements.receiptView.replaceChildren(paper);
}

function setView(view, { updateUrl = true } = {}) {
  currentView = VIEWS.has(view) ? view : "carrinho";
  const receipt = currentView === "recibo";
  elements.cartView.hidden = receipt;
  elements.receiptView.hidden = !receipt;
  elements.viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === currentView)));
  if (!updateUrl) return;
  const url = new URL(window.location.href);
  url.searchParams.set("visual", currentView);
  history.replaceState(null, "", url);
}

elements.viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

async function loadResults() {
  const params = new URLSearchParams(window.location.search);
  const user = params.get("user")?.trim() || "";
  const period = params.get("periodo") || "";
  const type = params.get("tipo") || "";

  if (!USERNAME_PATTERN.test(user) || !typeLabels[type] || !periodLabels[period]) {
    elements.context.textContent = "Consulta inválida";
    showMessage("Esta consulta é inválida. Volte e informe os dados novamente.");
    return;
  }

  query = { user, period, type };
  elements.context.textContent = `${typeLabels[type]} · ${periodLabels[period]}`;
  elements.title.textContent = `Carrinho de ${user}`;
  document.title = `Carrinho de ${user} — Cartify`;

  try {
    const response = await fetch(`/api/gerar?${new URLSearchParams({ user, periodo: period, tipo: type })}`, { headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.erro) throw new Error(data?.erro || "Não foi possível montar o carrinho.");
    if (!Array.isArray(data) || !data.length) {
      showMessage("Seu carrinho está vazio para esses filtros. Tente outro período.", "empty");
      return;
    }

    elements.list.replaceChildren(...data.map((item) => createItem(item, type)));
    const totals = {
      plays: data.reduce((sum, item) => sum + Number(item.playcount || 0), 0),
      seconds: data.reduce((sum, item) => sum + Number(item.duration || 0) * Number(item.playcount || 0), 0),
    };
    elements.count.textContent = `${data.length} ${typeLabels[type].toLowerCase()}`;
    elements.plays.textContent = formatNumber(totals.plays);
    elements.metricLabel.textContent = type === "musicas" ? "Tempo estimado" : "Tipo de lista";
    elements.metric.textContent = type === "musicas" ? formatDuration(totals.seconds) : typeLabels[type];
    buildReceipt(data, totals);
    elements.viewButtons.forEach((button) => { button.disabled = false; });
    elements.download.disabled = false;
    setView(params.get("visual"), { updateUrl: false });
  } catch (error) {
    showMessage(error.message || "Não foi possível carregar o carrinho.");
  }
}

function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HTML2CANVAS_URL;
    script.integrity = HTML2CANVAS_SRI;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error("Não foi possível preparar o download."));
    document.head.append(script);
  });
}

async function renderPng() {
  const html2canvas = await loadHtml2Canvas();
  const target = currentView === "recibo" ? elements.receiptView : elements.cartExport;
  const canvas = await html2canvas(target, {
    backgroundColor: "#120d0a",
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    allowTaint: false,
    logging: false,
    onclone: (clonedDocument) => clonedDocument.body.classList.add("is-exporting"),
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Não foi possível gerar a imagem.");
  return blob;
}

elements.download.addEventListener("click", async () => {
  elements.download.disabled = true;
  elements.download.textContent = "Preparando imagem…";
  elements.downloadStatus.textContent = "Preparando o download da imagem.";
  try {
    const blob = await renderPng();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentView}-${query.user}-${query.type}.png`;
    link.click();
    // Revogar na hora pode cancelar o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    elements.downloadStatus.textContent = "Download iniciado.";
  } catch (error) {
    elements.downloadStatus.textContent = error.message || "Falha ao baixar a imagem.";
  } finally {
    elements.download.disabled = false;
    elements.download.textContent = "Baixar PNG";
  }
});

loadResults();
