# CLAUDE.md — Instrucciones para Claude Code

## Contexto del proyecto

Administración del condominio **José J. Jasso 8** (CDMX, 8 departamentos).
El usuario es el administrador. Recibe estados de cuenta Banamex y comprobantes de pago en su teléfono y los manda a Claude Code para mantener al día los registros.

**Fuente de la verdad:** los CSVs en `docs/`. Todo cálculo se deriva de ahí.
El Excel en `excel/` es archivo histórico — no usar para cálculos.

## Estructura

```
jasso-8-admin/
├── data/                          # privado (en .gitignore)
│   └── inquilinos.csv             # depto → nombre, contacto
├── docs/                          # público (GitHub Pages)
│   ├── index.html, app.js, style.css
│   ├── config.json                # cuota, tasa, multa
│   ├── catalogo_conceptos.csv     # conceptos y montos
│   ├── registro_ingresos.csv      # cuotas: una fila por (depto, cuota)
│   └── registro_egresos.csv       # gastos
├── estados-cuenta/                # privado (PDFs Banamex)
└── excel/                         # legacy
```

## Mapa de inquilinos

| Depto | Nombre |
|-------|--------|
| 101 | Dolores Villafán Fonseca |
| 102 | Estela del Carmen Martínez Var. |
| 201 | Gabriela Martinez Salazar / Jorge |
| 202 | Mohamed Sánchez Prudente |
| 301 | Jesús Hernando Plascencia / Itzel |
| 302 | Erika Romero Moctezuma Piñón |
| 401 | Stephany Carolina Castillo |
| 402 | Arturo Alfonso Baños Vargas |

(Detalle completo y referencias de PDF en `data/inquilinos.csv`.)

## Política de moratorios

- Tasa: **0.83% mensual** (≈ 10% anual) sobre saldo pendiente.
- Multa fija de **$150** por cuota vencida si la consulta es después del día 15.
- Fórmula: `adeudo × 0.0083 × (días_mora / 30) + (día_actual > 15 ? 150 : 0)`.
- El cálculo vive en `docs/app.js` (función `calcularInteres`); no se persiste en CSV.

## Workflow al recibir un comprobante

1. Identificar el depto que pagó (usar `data/inquilinos.csv` para matchear).
2. Aplicar las reglas de abajo.
3. Mostrar al admin la fila propuesta + diff esperado.
4. Esperar confirmación explícita.
5. Editar el CSV correspondiente.
6. Esperar nueva confirmación antes de `git add` + `git commit`.
7. **Nunca** hacer `git push` por iniciativa propia.

## Reglas

### Ingesta de pagos

1. **No duplicar pagos.** Antes de agregar una fila a `registro_ingresos.csv`, verificar que no exista ya un pago con la misma fecha + depto + monto + referencia. Si existe: alertar y no duplicar.

2. **Confirmar match antes de aplicar.** Mostrar al admin: *"Detecté pago de $X de [nombre] el [fecha]. Propongo aplicarlo a depto N, cuota MMM. ¿Confirmas?"* — esperar OK explícito antes de modificar el CSV.

3. **FIFO para cuota más antigua pendiente.** Si un depto debe Jun, Jul, Ago y paga $1,500 → aplicar a Jun primero. Si paga $4,500 → cubre Jun + Jul + Ago.

4. **Excluir transacciones del admin.** Cualquier transacción con "JORGE ALBERTO RIVERA IBARRA" es el admin moviendo su propio dinero. Nunca registrar como pago de inquilino.

5. **Distinguir cuotas de reembolsos.** Algunos inquilinos usan la cuenta para reembolsar gastos compartidos (Telmex, Izzi, persianas, etc. — visto sobre todo en 201). Solo registrar en `registro_ingresos.csv` si es claramente cuota (monto $1,500 + fecha cerca del 15 + concepto que lo confirme). Lo demás no entra a ese CSV.

6. **Match de nombre estricto.** Comparar el nombre del comprobante contra `data/inquilinos.csv` (campos `nombre_pdf` y `nombres_alternos`). Si no hay match razonable, **no asumir** — preguntar al admin. Aplica también a depósitos sin nombre (efectivo, traspaso anónimo).

7. **Pago mayor a $1,500 → consultar antes de aplicar.** Si el monto excede la cuota normal, investigar qué cuotas/extraordinarias cubre. No asumir distribución; mostrar propuesta y esperar OK.

8. **Extraordinarias requieren catálogo primero.** Antes de aplicar un pago de extraordinaria (filtros, bomba, etc.), confirmar que el concepto exista en `catalogo_conceptos.csv` y que las filas de cargo existan en `registro_ingresos.csv` para cada depto. Si no, crearlas primero, luego aplicar el pago.

9. **Fecha futura es sospechosa.** Rechazar o pedir confirmación si la fecha del depósito es posterior a hoy.

### Mantenimiento de archivos

10. **Mantener orden cronológico.** Las filas de `registro_ingresos.csv` y `registro_egresos.csv` se mantienen ordenadas por fecha al insertar.

11. **Verificar consistencia de saldos.** Después de aplicar un pago, recalcular el adeudo total del depto y verificar que la diferencia coincida con el monto aplicado. Si no coincide, alertar.

12. **No tocar `excel/` ni regenerarlo.** El Excel quedó como archivo histórico. La fuente de verdad son los CSVs en `docs/`.

### Operaciones git

13. **No comitear sin permiso explícito.** Después de cualquier cambio en CSVs, mostrar diff y esperar OK antes de `git add` + `git commit`. Nunca push automático.

14. **No tocar el remote ni GitHub Pages.** No correr `git remote`, `git push --set-upstream`, ni cambiar settings de Pages. El admin se encarga.

15. **PDFs y datos privados jamás en `docs/`.** Si por error se agrega algo con nombre/RFC/cuenta a `docs/`, detectarlo y no comitear hasta limpiar.

## Tips operativos

- **Para extraer transacciones de un PDF Banamex** usar `pdfplumber` (ya instalado) con detección por columnas de `RETIROS`/`DEPOSITOS`/`SALDO` y manejo de saltos de página (transacciones que cruzan páginas tienden a perder atribución de monto/nombre — verificar siempre).

- **Para probar el dashboard local:**
  ```bash
  python3 -m http.server 8000 --directory docs
  # http://localhost:8000/
  ```

- **Saldos iniciales validados** (al cierre Feb 2026): caja $11,400, banco $33,626.71, ingresos acumulados $451,336.71, egresos $406,310. Si los totales recalculados se desvían sin razón aparente, alertar.
