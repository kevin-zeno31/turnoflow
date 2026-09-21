const $ = id => document.getElementById(id);
let snapshot = null;
let busy = false;
let online = false;
let pendingRequestKey = null;
let refreshPromise = null;
const labels = {
  operador: ['OPERACIÓN', 'Panel del operador', 'Una fila ordenada. Una atención a la vez.'],
  solicitar: ['RECEPCIÓN', 'Solicitar turno', 'Recibe tu número para atención general.'],
  pantalla: ['LLAMADOS', 'Pantalla pública', 'Consulta el número que está siendo atendido.']
};
function route() {
  const view = location.hash.slice(1) in labels ? location.hash.slice(1) : 'operador';
  document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== view; });
  document.querySelectorAll('nav a').forEach(el => { if(el.dataset.view === view) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  ['breadcrumb','page-title','page-description'].forEach((id,i) => { $(id).textContent = labels[view][i]; });
}
function notice(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; $('notice').hidden = false; }
function controls() {
  $('request').disabled = busy || !online;
  $('call').disabled = busy || !online || !snapshot || Boolean(snapshot.active) || snapshot.waitingCount === 0;
  $('finish').disabled = busy || !online || !snapshot?.active;
}
function time(iso) { return new Date(iso).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' }); }
function row(className, entries) {
  const el = document.createElement('div'); el.className = className;
  for (const [tag, content] of entries) { const child = document.createElement(tag); child.textContent = content; el.append(child); }
  return el;
}
function render(data) {
  snapshot = data;
  $('waiting-count').textContent = data.waitingCount;
  $('active-count').textContent = data.active ? '1' : '0';
  $('done-count').textContent = data.doneCount;
  $('active-code').textContent = data.active?.code || '—';
  $('active-label').textContent = data.active ? 'Turno en atención' : 'Sin atención activa';
  $('active-hint').textContent = data.active ? `Llamado a las ${time(data.active.called_at)}` : 'Llama al primer turno de la fila.';
  $('queue-badge').textContent = `${data.waitingCount} ${data.waitingCount === 1 ? 'TURNO' : 'TURNOS'}`;
  const queue = $('queue-list'); queue.replaceChildren();
  if (!data.waiting.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Todo al día. No hay turnos en espera.'; queue.append(p); }
  data.waiting.forEach((ticket, i) => queue.append(row('queue-row', [['strong',ticket.code],['span', i === 0 ? 'Siguiente' : 'En espera'],['small', time(ticket.created_at)]])));
  if (data.waitingCount > data.waiting.length) queue.append(row('muted', [['span',`Mostrando los primeros ${data.waiting.length} turnos.`]]));
  const history = $('history-list'); history.replaceChildren();
  if (!data.recent.length) history.append(row('muted', [['span','Todavía no hay atenciones finalizadas.']]));
  data.recent.forEach(ticket => history.append(row('history-row', [['strong',ticket.code],['span',`Finalizado a las ${time(ticket.finished_at)}`],['small','Completado']])));
  $('display-code').textContent = data.active?.code || '—';
  $('display-hint').textContent = data.active ? 'Acércate al módulo 01.' : 'Espera el llamado de tu número.';
  $('display-queue').replaceChildren();
  if (!data.waiting.length) $('display-queue').textContent = 'Sin turnos en espera';
  data.waiting.slice(0,5).forEach(ticket => { const el = document.createElement('strong'); el.textContent = ticket.code; $('display-queue').append(el); });
  controls();
}
async function api(url, body) {
  const response = await fetch(url, { ...(body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(8000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'La solicitud no pudo completarse.');
  return result;
}
function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const data = await api('/api/queue'); online = true; render(data);
      $('connection').textContent = 'Conectado · actualización cada 3 s'; $('connection').className = 'connection';
    } catch {
      online = false; $('connection').textContent = 'Sin conexión · datos sin actualizar'; $('connection').className = 'connection offline'; controls();
    } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}
async function action(task) {
  if (busy || !online) return;
  busy = true; controls(); $('notice').hidden = true;
  try { await task(); }
  catch (error) { notice(error.name === 'TimeoutError' || error.name === 'TypeError' ? 'No se pudo confirmar la operación. Revisa la conexión y vuelve a intentar.' : error.message, true); }
  finally { await refresh(); busy = false; controls(); }
}
$('request').addEventListener('click', () => action(async () => {
  pendingRequestKey ||= crypto.randomUUID();
  const ticket = await api('/api/tickets', { requestKey:pendingRequestKey });
  pendingRequestKey = null;
  $('receipt').hidden = false; $('receipt-code').textContent = ticket.code;
  notice(`Turno ${ticket.code} registrado. Espera el llamado en la pantalla pública.`);
}));
$('call').addEventListener('click', () => action(async () => { const ticket = await api('/api/call', {}); notice(`Llamando al turno ${ticket.code}.`); }));
$('finish').addEventListener('click', () => action(async () => { const ticket = await api('/api/finish', {id:snapshot.active.id}); notice(`Atención ${ticket.code} finalizada.`); }));
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if(!document.hidden) refresh(); });
route(); refresh();
setInterval(() => { if(!document.hidden && !busy) refresh(); }, 3000);
