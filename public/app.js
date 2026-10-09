/* TurnoFlow — vista y acciones del navegador. Sin dependencias externas. */
const $ = (id) => document.getElementById(id);

let snapshot = null;
let busy = false;
let online = false;
let pendingRequestKey = null;
let refreshPromise = null;

const labels = {
  operador: ["OPERACIÓN", "Panel de atención", "Gestiona tu fila, consulta indicadores y llama al siguiente turno."],
  solicitar: ["RECEPCIÓN", "Solicitar un turno", "Un proceso simple y rápido para recibir atención."],
  pantalla: ["LLAMADOS", "Pantalla pública", "Sigue los turnos que están siendo atendidos en tiempo real."],
};

function route() {
  const requestedView = location.hash.slice(1);
  const view = Object.hasOwn(labels, requestedView) ? requestedView : "operador";

  document.querySelectorAll(".view").forEach((element) => {
    element.hidden = element.id !== view;
  });
  document.querySelectorAll("nav a").forEach((element) => {
    if (element.dataset.view === view) {
      element.setAttribute("aria-current", "page");
    } else {
      element.removeAttribute("aria-current");
    }
  });

  ["breadcrumb", "page-title", "page-description"].forEach((id, index) => {
    $(id).textContent = labels[view][index];
  });

  document.title = `${labels[view][1]} — TurnoFlow`;
}

function showNotice(message, isError = false) {
  $("notice").textContent = message;
  $("notice").className = isError ? "error" : "";
  $("notice").hidden = false;
}

function controls() {
  $("request").disabled = busy || !online;
  $("call").disabled = busy || !online || !snapshot || Boolean(snapshot.active) || snapshot.waitingCount === 0;
  $("finish").disabled = busy || !online || !snapshot?.active;
}

function formatTime(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function createRow(className, entries) {
  const element = document.createElement("div");
  element.className = className;
  for (const [tag, content] of entries) {
    const child = document.createElement(tag);
    child.textContent = content;
    element.append(child);
  }
  return element;
}

function renderChart(weekly) {
  const chart = $("weekly-chart");
  chart.replaceChildren();
  const maximum = Math.max(1, ...weekly.map((day) => day.total));

  for (const day of weekly) {
    const wrapper = document.createElement("div");
    wrapper.className = "weekly-day";
    const value = document.createElement("span");
    value.className = "weekly-value";
    value.textContent = String(day.total);

    const track = document.createElement("div");
    track.className = "weekly-track";
    const bar = document.createElement("div");
    bar.className = "weekly-bar";
    bar.style.height = `${Math.max(4, (day.total / maximum) * 100)}%`;
    track.append(bar);

    const label = document.createElement("span");
    label.className = "weekly-label";
    label.textContent = new Date(`${day.day}T12:00:00Z`).toLocaleDateString("es-CL", {
      weekday: "short", timeZone: "UTC",
    }).replace(".", "");
    wrapper.title = `${day.day} (UTC): ${day.total} turnos completados`;
    wrapper.append(value, track, label);
    chart.append(wrapper);
  }
}

function render(data) {
  snapshot = data;
  $("waiting-count").textContent = data.waitingCount;
  $("active-count").textContent = data.active ? "1" : "0";
  $("done-count").textContent = data.doneCount;
  $("avg-wait").textContent = data.averageWaitMinutes == null
    ? "—" : `${data.averageWaitMinutes.toLocaleString("es-CL")} min`;
  $("today-badge").textContent = `HOY (UTC): ${data.completedToday}`;
  $("last-updated").textContent = `Última actualización ${formatTime(new Date().toISOString())}`;

  $("active-code").textContent = data.active?.code || "—";
  $("active-label").textContent = data.active ? "Turno en atención" : "Sin atención activa";
  $("active-hint").textContent = data.active
    ? `Llamado a las ${formatTime(data.active.called_at)}`
    : "Llama al primer turno de la fila.";
  $("queue-badge").textContent = `${data.waitingCount} ${data.waitingCount === 1 ? "TURNO" : "TURNOS"}`;

  const queue = $("queue-list");
  queue.replaceChildren();
  if (data.waiting.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Todo al día. No hay turnos en espera.";
    queue.append(empty);
  }
  data.waiting.forEach((ticket, index) => {
    queue.append(createRow("queue-row", [
      ["strong", ticket.code],
      ["span", index === 0 ? "Siguiente" : "En espera"],
      ["small", formatTime(ticket.created_at)],
    ]));
  });
  if (data.waitingCount > data.waiting.length) {
    queue.append(createRow("muted", [["span", `Mostrando los primeros ${data.waiting.length} turnos.`]]));
  }

  const history = $("history-list");
  history.replaceChildren();
  if (data.recent.length === 0) {
    history.append(createRow("muted", [["span", "Todavía no hay atenciones finalizadas."]]));
  }
  for (const ticket of data.recent) {
    history.append(createRow("history-row", [
      ["strong", ticket.code],
      ["span", `Finalizado a las ${formatTime(ticket.finished_at)}`],
      ["small", "Completado"],
    ]));
  }

  $("display-code").textContent = data.active?.code || "—";
  $("display-hint").textContent = data.active
    ? "Acércate al módulo 01."
    : "Espera el llamado de tu número.";
  const displayQueue = $("display-queue");
  displayQueue.replaceChildren();
  if (data.waiting.length === 0) {
    displayQueue.textContent = "Sin turnos en espera";
  }
  for (const ticket of data.waiting.slice(0, 5)) {
    const number = document.createElement("strong");
    number.textContent = ticket.code;
    displayQueue.append(number);
  }

  renderChart(data.weekly);
  controls();
}

async function api(url, body) {
  const options = {
    signal: AbortSignal.timeout(8000),
    ...(body ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    } : {}),
  };
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "La operación no pudo completarse.");
  return result;
}

function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const data = await api("/api/queue");
      online = true;
      render(data);
      $("connection-text").textContent = "Conectado · actualiza cada 3 s";
      $("connection").className = "connection";
    } catch {
      online = false;
      $("connection-text").textContent = "Sin conexión · datos desactualizados";
      $("connection").className = "connection offline";
      controls();
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function action(task) {
  if (busy || !online) return;
  busy = true;
  controls();
  $("notice").hidden = true;
  try {
    await task();
  } catch (error) {
    const connectionProblem = error.name === "TimeoutError" || error.name === "TypeError";
    showNotice(connectionProblem
      ? "No se pudo confirmar la operación. Comprueba la conexión y vuelve a intentar."
      : error.message, true);
  } finally {
    await refresh();
    busy = false;
    controls();
  }
}

function showReceipt(code) {
  $("receipt").hidden = false;
  $("receipt-code").textContent = code;
  $("print-code").textContent = code;
}

$("request").addEventListener("click", () => action(async () => {
  pendingRequestKey ||= crypto.randomUUID();
  const ticket = await api("/api/tickets", { requestKey: pendingRequestKey });
  pendingRequestKey = null;
  showReceipt(ticket.code);
  try { sessionStorage.setItem("turnoflow-last-receipt", ticket.code); } catch { /* Almacenamiento opcional. */ }
  showNotice(`Turno ${ticket.code} registrado. Espera el llamado en la pantalla pública.`);
}));

$("call").addEventListener("click", () => action(async () => {
  const ticket = await api("/api/call", {});
  showNotice(`Llamando al turno ${ticket.code}.`);
}));

$("finish").addEventListener("click", () => action(async () => {
  const ticket = await api("/api/finish", { id: snapshot.active.id });
  showNotice(`Atención ${ticket.code} finalizada.`);
}));

$("print-ticket").addEventListener("click", () => window.print());
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

function updateClock() {
  $("local-time").textContent = new Date().toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

try {
  const previousReceipt = sessionStorage.getItem("turnoflow-last-receipt");
  if (previousReceipt && /^A-\d+$/.test(previousReceipt)) showReceipt(previousReceipt);
} catch { /* Almacenamiento opcional. */ }

route();
updateClock();
refresh();
setInterval(updateClock, 30_000);
setInterval(() => { if (!document.hidden && !busy) refresh(); }, 3000);
