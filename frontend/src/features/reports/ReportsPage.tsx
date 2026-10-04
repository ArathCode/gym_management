import { startTransition, useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { ErrorMessage, Loading, Page, Table } from '../../components/ui'
import { commerceApi } from '../../services/commerceApi'
import type { Report } from '../../types/api'
import { formatMoney, getErrorMessage } from '../../utils/errors'

type ReportType = 'sales' | 'payments' | 'attendance' | 'inventory'
const titles: Record<ReportType, string> = {
  sales: 'Ventas', payments: 'Pagos', attendance: 'Asistencia', inventory: 'Inventario',
}
const fieldLabels: Record<string, string> = {
  date: 'Fecha', count: 'Operaciones', total: 'Importe', payment_method: 'Método de pago',
  type: 'Movimiento', quantity: 'Cantidad', nombre: 'Producto', sku: 'SKU',
  existencia: 'Existencia', mínimo: 'Stock mínimo', unidad: 'Unidad', fecha: 'Fecha', miembro: 'Miembro', estado: 'Estado',
}

function ReportTable({ title, rows }: { title: string; rows?: Array<Record<string, number | string>> }) {
  if (!rows?.length) return <p>No hay datos para mostrar.</p>
  const columns = Object.keys(rows[0])
  return <section className="report-table-section"><h2>{title}</h2><Table><thead><tr>{columns.map((column) => <th key={column}>{fieldLabels[column] ?? column.replaceAll('_', ' ')}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody>
  </Table></section>
}

function ReportBarChart({ title, rows, amountKey }: { title: string; rows?: Array<Record<string, number | string>>; amountKey: 'total' | 'count' }) {
  if (!rows?.length) return <section className="report-chart"><h2>{title}</h2><p>No hay datos para mostrar.</p></section>
  const maxValue = Math.max(...rows.map((row) => Number(row[amountKey] ?? 0)), 1)
  return (
    <section className="report-chart">
      <h2><BarChart3 size={18} aria-hidden="true" />{title}</h2>
      <div className="report-bars">
        {rows.map((row, index) => {
          const value = Number(row[amountKey] ?? 0)
          const label = String(row.date ?? row.payment_method ?? row.type ?? index + 1)
          return <div className="report-bar-row" key={`${label}-${index}`}>
            <span className="report-bar-label">{label}</span>
            <span className="report-bar-track"><span style={{ width: `${Math.max(value > 0 ? 3 : 0, value / maxValue * 100)}%` }} /></span>
            <strong>{amountKey === 'total' ? formatMoney(value) : value.toLocaleString()}</strong>
          </div>
        })}
      </div>
    </section>
  )
}

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    startTransition(() => setLoading(true))
    commerceApi.report(type, { ...(from ? { from } : {}), ...(to ? { to } : {}) })
      .then((data) => { setReport(data); setError('') })
      .catch((loadError: unknown) => { setReport(null); setError(getErrorMessage(loadError, 'No se pudo cargar el reporte.')) })
      .finally(() => setLoading(false))
  }, [type, from, to])

  return (
    <Page title="Reportes" description="Analiza la actividad registrada en un periodo.">
      <div className="filters report-filters">
        <label>Tipo<select value={type} onChange={(e) => setType(e.target.value as ReportType)}>{Object.entries(titles).map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select></label>
        <label>Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : report ? (
        <div className="report-content">
          <section className="report-kpis" aria-label={`Resumen de ${titles[type]}`}>
            {Object.entries(report.summary).map(([key, value]) => <article className="report-kpi" key={key}>
              <span>{fieldLabels[key] ?? key.replaceAll('_', ' ')}</span>
              <strong>{key === 'total' ? formatMoney(value) : Number(value).toLocaleString()}</strong>
            </article>)}
          </section>
          <div className="report-chart-grid">
            <ReportBarChart title="Actividad por día" rows={report.by_day} amountKey={report.by_day?.some((row) => row.total !== undefined) ? 'total' : 'count'} />
            {report.by_method?.length ? <ReportBarChart title="Por método" rows={report.by_method} amountKey={report.by_method.some((row) => row.total !== undefined) ? 'total' : 'count'} /> : null}
          </div>
          <div className="report-detail-grid">
            <ReportTable title="Detalle por día" rows={report.by_day} />
            <ReportTable title="Detalle por método" rows={report.by_method} />
          </div>
          <ReportTable title="Productos con stock bajo" rows={report.low_stock_products?.map((product) => ({
            nombre: product.name, sku: product.sku, existencia: product.stock, mínimo: product.minimum_stock, unidad: product.inventory_unit,
          }))} />
          <ReportTable title="Movimientos" rows={report.by_movement_type} />
          <ReportTable title="Visitas recientes" rows={report.recent_visits?.map((visit) => ({
            fecha: visit.checked_in_at, miembro: `${visit.member.first_name} ${visit.member.last_name}`, estado: visit.access_status,
          }))} />
        </div>
      ) : null}
    </Page>
  )
}
