# Condominio Jasso 8 — Administración

Registro de ingresos, egresos y adeudos del condominio José J. Jasso 8 (CDMX).
Dashboard estático que se publica en GitHub Pages y se actualiza editando CSVs.

## Cómo verlo

- **Online:** `https://<usuario>.github.io/jasso-8-admin/` (privado vía repo, público en Pages — solo deptos, sin nombres).
- **Local:**
  ```bash
  python3 -m http.server 8000 --directory docs
  # abrir http://localhost:8000/
  ```

## Estructura

```
jasso-8-admin/
├── data/                          # privado (no se publica)
│   └── inquilinos.csv             # depto → nombre, contacto
├── docs/                          # público (GitHub Pages publica esta carpeta)
│   ├── index.html
│   ├── app.js                     # lee CSVs y calcula intereses al vuelo
│   ├── style.css
│   ├── config.json                # parámetros (cuota, tasa, multa)
│   ├── catalogo_conceptos.csv     # tipos de cuota y montos
│   ├── registro_ingresos.csv      # cuotas: una fila por (depto, cuota)
│   └── registro_egresos.csv       # gastos del condominio
├── estados-cuenta/                # privado (PDFs Banamex)
├── excel/                         # legacy (Excel original, archivo histórico)
└── CLAUDE.md                      # instrucciones para Claude Code
```

## Fuente de la verdad

Los **CSVs en `docs/`** son la fuente de la verdad. El Excel en `excel/` queda como referencia histórica pero ya no se usa para cálculos.

## Workflow de actualización

El admin recibe comprobantes en su teléfono y los manda a Claude Code. Claude:

1. Identifica el depto que pagó (usa `data/inquilinos.csv` para matchear nombres del comprobante).
2. Verifica que el pago no esté duplicado.
3. Edita la fila correspondiente en `docs/registro_ingresos.csv`.
4. Pide confirmación antes de comitear.
5. Hace commit y push.

Las reglas detalladas de ingesta están en [`CLAUDE.md`](./CLAUDE.md).

## Política de moratorios

- Tasa: **0.83% mensual** (≈ 10% anual) sobre el saldo pendiente.
- Multa fija de **$150** por cuota vencida si la consulta es después del día 15 del mes.
- Cálculo: `adeudo × 0.0083 × (días_mora / 30) + (día_actual > 15 ? 150 : 0)`.

## Privacidad

- El repo es **privado**. Los nombres y referencias bancarias viven solo aquí.
- GitHub Pages publica únicamente `docs/`. Esa carpeta nunca contiene nombres ni referencias bancarias — solo número de depto y montos.
- `inquilinos.csv` y `estados-cuenta/` están fuera de `docs/` y nunca se exponen.
