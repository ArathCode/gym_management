import { startTransition, useEffect, useState } from 'react'
import { ErrorMessage, Loading, Page, Table } from '../../components/ui'
import { commerceApi } from '../../services/commerceApi'
import type { Report } from '../../types/api'
import { formatMoney, getErrorMessage } from '../../utils/errors'

type ReportType = 'sales' | 'payments' | 'attendance' | 'inventory'
const titles: Record<ReportType, string> = {
  sales: 'Ventas', payments: 'Pagos', attendance: 'Asistencia', inventory: 'Inventario',
}

function ReportTable({ title, rows }: { title: string; rows?: Array<Record<string, number | string>> }) {
  if (!rows?.length) return <p>No hay datos para mostrar.</p>
  const columns = Object.keys(rows[0])
  return <section><h2>{title}</h2><Table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody>
  </Table></section>
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
    <Page title="Reportes">
      <div className="filters">
        <label>Tipo<select value={type} onChange={(e) => setType(e.target.value as ReportType)}>{Object.entries(titles).map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select></label>
        <label>Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : report ? (
        <>
          <h2>Resumen · {titles[type]}</h2>
          <dl className="details-grid">{Object.entries(report.summary).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{key === 'total' ? formatMoney(value) : value}</dd></div>)}</dl>
          <ReportTable title="Por día" rows={report.by_day} />
          <ReportTable title="Por método de pago" rows={report.by_method} />
          <ReportTable title="Productos con stock bajo" rows={report.low_stock_products?.map((product) => ({
            nombre: product.name, sku: product.sku, existencia: product.stock, mínimo: product.minimum_stock, unidad: product.inventory_unit,
          }))} />
          <ReportTable title="Movimientos" rows={report.by_movement_type} />
          <ReportTable title="Visitas recientes" rows={report.recent_visits?.map((visit) => ({
            fecha: visit.checked_in_at, miembro: `${visit.member.first_name} ${visit.member.last_name}`, estado: visit.access_status,
          }))} />
        </>
      ) : null}
    </Page>
  )
}
