// Dashboard del condominio Jasso 8
// Lee CSVs públicos en /docs y calcula intereses al vuelo con la fecha del navegador.

const fmtMoney = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

const fmtDate = (d) =>
  d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

async function fetchCsv(path) {
  const res = await fetch(path);
  const text = await res.text();
  return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
}

async function fetchJson(path) {
  const res = await fetch(path);
  return res.json();
}

// Calcula interés moratorio + multa según fórmula del Excel original.
function calcularInteres(adeudo, fechaCuota, hoy, cfg) {
  if (!adeudo || adeudo <= 0) return 0;
  const diasMora = Math.max(0, (hoy - fechaCuota) / (1000 * 60 * 60 * 24));
  const interes = adeudo * cfg.tasa_mensual * (diasMora / cfg.base_dias);
  const multa = hoy.getDate() > cfg.corte_dia ? cfg.multa_quincenal : 0;
  return interes + multa;
}

function parseFecha(s) {
  // formatos esperados: "2024-03-01" o similar
  if (s instanceof Date) return s;
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function agruparPorDepto(ingresos, hoy, cfg) {
  const porDepto = {};
  for (const r of ingresos) {
    if (!r.depto) continue;
    const d = String(r.depto);
    if (!porDepto[d]) porDepto[d] = [];
    const fecha = parseFecha(r.fecha);
    const adeudo = Number(r.adeudo) || 0;
    const pagado = Number(r.pago) || 0;
    const monto = Number(r.monto_total) || 0;
    const interes = calcularInteres(adeudo, fecha, hoy, cfg);
    porDepto[d].push({
      fecha,
      concepto: r.concepto,
      monto,
      pagado,
      adeudo,
      interes,
      saldoPendiente: adeudo + interes,
    });
  }
  // ordenar cronológicamente
  for (const d of Object.keys(porDepto)) {
    porDepto[d].sort((a, b) => a.fecha - b.fecha);
  }
  return porDepto;
}

function renderTotales(ingresos, egresos, porDepto, cfg) {
  const totalIngresos = ingresos.reduce((s, r) => s + (Number(r.pago) || 0), 0);
  const totalEgresos = egresos.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  const totalAdeudo = Object.values(porDepto)
    .flat()
    .reduce((s, c) => s + c.saldoPendiente, 0);
  const balance = totalIngresos - totalEgresos;

  const cards = [
    { label: "Ingresos", value: fmtMoney(totalIngresos) },
    { label: "Egresos", value: fmtMoney(totalEgresos) },
    { label: "Balance", value: fmtMoney(balance) },
    { label: "Adeudo total", value: fmtMoney(totalAdeudo) },
  ];
  document.getElementById("totales").innerHTML = cards
    .map((c) => `<div class="card"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`)
    .join("");
}

function renderDeptos(porDepto, cfg) {
  const cont = document.getElementById("deptos");
  const deptos = cfg.deptos.slice().sort();
  cont.innerHTML = deptos
    .map((d) => {
      const cuotas = porDepto[d] || [];
      const pendientes = cuotas.filter((c) => c.adeudo > 0);
      const saldo = pendientes.reduce((s, c) => s + c.saldoPendiente, 0);
      const cls = saldo > 0 ? "deuda" : "cero";
      const estado = saldo > 0 ? `${pendientes.length} cuota${pendientes.length === 1 ? "" : "s"} pendiente${pendientes.length === 1 ? "" : "s"}` : "Al corriente";
      return `
        <div class="depto" data-depto="${d}">
          <div class="depto-header" onclick="this.parentElement.classList.toggle('open')">
            <div>
              <div class="depto-num">Depto ${d}</div>
              <div class="muted">${estado}</div>
            </div>
            <div>
              <span class="depto-saldo ${cls}">${fmtMoney(saldo)}</span>
              <span class="chevron">›</span>
            </div>
          </div>
          <div class="depto-body">${renderCuotas(cuotas)}</div>
        </div>`;
    })
    .join("");
}

function renderCuotas(cuotas) {
  if (!cuotas.length) return '<p class="muted">Sin movimientos.</p>';
  const rows = cuotas
    .slice()
    .reverse()
    .map((c) => {
      const pagada = c.adeudo === 0;
      const cls = pagada ? "row-pagada" : "";
      const estado = pagada
        ? `<span class="badge-pagada">Pagada</span>`
        : `<span class="badge-pendiente">Pendiente</span>`;
      const interes = pagada || c.interes === 0 ? "" : fmtMoney(c.interes);
      const saldoTotal = pagada ? "" : fmtMoney(c.saldoPendiente);
      return `<tr class="${cls}">
        <td>${fmtDate(c.fecha)}</td>
        <td>${c.concepto}</td>
        <td class="num">${fmtMoney(c.monto)}</td>
        <td class="num">${interes}</td>
        <td class="num">${saldoTotal}</td>
        <td>${estado}</td>
      </tr>`;
    })
    .join("");
  return `<table>
    <thead>
      <tr><th>Fecha</th><th>Concepto</th><th class="num">Cuota</th><th class="num">Interés</th><th class="num">Saldo</th><th></th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderProyectos(proyectos) {
  const tbody = document.querySelector("#proyectos-tabla tbody");
  const sorted = proyectos
    .slice()
    .sort((a, b) => (Number(a.prioridad) || 0) - (Number(b.prioridad) || 0));
  tbody.innerHTML = sorted
    .map(
      (p) =>
        `<tr><td>${p.prioridad ?? ""}</td><td>${p.proyecto || ""}</td><td class="num">${fmtMoney(Number(p.presupuesto_estimado) || 0)}</td></tr>`
    )
    .join("");
  const total = sorted.reduce((s, p) => s + (Number(p.presupuesto_estimado) || 0), 0);
  document.getElementById("proyectos-total").textContent = fmtMoney(total);
}

function renderEgresos(egresos, hoy) {
  const limite = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
  const sorted = egresos
    .slice()
    .filter((r) => parseFecha(r.fecha) >= limite)
    .sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));
  const tbody = document.querySelector("#egresos-tabla tbody");
  let mostrados = 10;
  const dibuja = () => {
    tbody.innerHTML = sorted
      .slice(0, mostrados)
      .map(
        (r) =>
          `<tr><td>${fmtDate(parseFecha(r.fecha))}</td><td>${r.concepto || ""}</td><td>${r.notas || ""}</td><td class="num">${fmtMoney(r.monto)}</td></tr>`
      )
      .join("");
    document.getElementById("ver-mas-egresos").style.display = mostrados >= sorted.length ? "none" : "";
  };
  document.getElementById("ver-mas-egresos").addEventListener("click", () => {
    mostrados += 20;
    dibuja();
  });
  dibuja();
}

async function main() {
  try {
    const [cfg, ingresos, egresos, proyectos] = await Promise.all([
      fetchJson("config.json"),
      fetchCsv("registro_ingresos.csv"),
      fetchCsv("registro_egresos.csv"),
      fetchCsv("proyectos.csv"),
    ]);

    const hoy = new Date();
    document.getElementById("actualizado").textContent = "Actualizado al " + fmtDate(hoy);
    document.getElementById("fecha-calculo").textContent = fmtDate(hoy);

    const porDepto = agruparPorDepto(ingresos, hoy, cfg.moratorios);
    renderTotales(ingresos, egresos, porDepto, cfg);
    renderDeptos(porDepto, cfg);
    renderEgresos(egresos, hoy);
    renderProyectos(proyectos);
  } catch (e) {
    document.querySelector("main").innerHTML =
      `<p style="color:var(--bad)">Error al cargar datos: ${e.message}</p>`;
    console.error(e);
  }
}

main();
