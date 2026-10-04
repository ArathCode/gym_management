import { startTransition, useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowUpRight, Pencil, Plus, Search, Tag } from 'lucide-react'
import { EmptyState, ErrorMessage, FieldError, Loading, Page, Pagination, StatusBadge, Table } from '../../components/ui'
import { membersApi } from '../../services/membersApi'
import { commerceApi } from '../../services/commerceApi'
import type { Member, Membership, MembershipPlan, PageMeta, Payment } from '../../types/api'
import { formatDate, formatMoney, getErrorMessage, getFieldErrors } from '../../utils/errors'

const paymentMethodLabels: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' }
const paymentStatusLabels: Record<string, string> = { paid: 'Pagado', partial: 'Parcial', pending: 'Pendiente', cancelled: 'Cancelado' }

export function MembershipPlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => commerceApi.plans()
    .then(setPlans)
    .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudieron cargar los planes.')))
    .finally(() => setLoading(false)), [])
  useEffect(() => { void load() }, [load])

  return (
    <Page title="Planes de membresía" description="Administra las opciones y vigencias disponibles." actions={<Link className="button-link icon-button-link" to="/membership-plans/new"><Plus size={17} aria-hidden="true" />Nuevo plan</Link>}>
      {loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : plans.length === 0 ? <EmptyState>No hay planes.</EmptyState> : (
        <div className="plan-grid">
          {plans.map((plan) => (
            <article className="plan-card" key={plan.id}>
              <div className="plan-card-top"><span className="plan-icon"><Tag size={19} aria-hidden="true" /></span><StatusBadge status={plan.is_active ? 'active' : 'inactive'} label={plan.is_active ? 'Activo' : 'Inactivo'} /></div>
              <h2>{plan.name}</h2>
              {plan.description ? <p className="plan-description">{plan.description}</p> : null}
              <p className="plan-price">{formatMoney(plan.price)}</p>
              <p className="plan-duration">{plan.duration_days} días</p>
              <Link className="plan-edit-link" to={`/membership-plans/${plan.id}/edit`}><Pencil size={16} aria-hidden="true" />Editar plan</Link>
            </article>
          ))}
        </div>
      )}
    </Page>
  )
}

export function MembershipPlanFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', description: '', duration_days: '30', price: '', is_active: true })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(id))
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!id) return
    commerceApi.plan(Number(id)).then((plan) => setForm({
      name: plan.name, description: plan.description ?? '', duration_days: String(plan.duration_days),
      price: plan.price, is_active: plan.is_active,
    })).catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar el plan.')))
      .finally(() => setLoading(false))
  }, [id])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError(''); setErrors({})
    const payload = { ...form, duration_days: Number(form.duration_days), price: Number(form.price) }
    try {
      if (id) await commerceApi.updatePlan(Number(id), payload)
      else await commerceApi.createPlan(payload)
      navigate('/membership-plans')
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar el plan.'))
      setErrors(getFieldErrors(saveError))
    } finally { setPending(false) }
  }

  if (loading) return <Page title="Plan"><Loading /></Page>
  return (
    <Page title={id ? 'Editar plan' : 'Nuevo plan'}>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <form className="form-card" onSubmit={submit}>
        <label>Nombre<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><FieldError>{errors.name}</FieldError>
        <label>Descripción<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>Duración en días<input type="number" min="1" required value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} /></label><FieldError>{errors.duration_days}</FieldError>
        <label>Precio<input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><FieldError>{errors.price}</FieldError>
        <label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activo</label>
        <button disabled={pending}>{pending ? 'Guardando...' : 'Guardar plan'}</button>
      </form>
    </Page>
  )
}

function MembershipPayment({ membership, onUpdated }: { membership: Membership; onUpdated: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [pending, setPending] = useState(false)

  const load = useCallback(() => commerceApi.membershipPayments(membership.id)
    .then((result) => setPayments(result.data))
    .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar el historial de pagos.'))), [membership.id])
  useEffect(() => { void load() }, [load])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setFieldError(''); setPending(true)
    try {
      await commerceApi.createPayment(membership.id, { amount: Number(amount), payment_method: method, reference: reference || null })
      setAmount(''); setReference('')
      await load(); onUpdated()
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo registrar el pago.'))
      setFieldError(getFieldErrors(saveError).amount ?? '')
    }
    finally { setPending(false) }
  }

  return (
    <details className="membership-payment-panel">
      <summary>Pagos ({payments.length})</summary>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <form className="inline-form" onSubmit={submit}>
        <label>Monto pendiente: {formatMoney(membership.pending_amount)}
          <input aria-label={`Monto de pago membresía ${membership.id}`} type="number" step="0.01" min="0.01" max={membership.pending_amount} required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <FieldError>{fieldError}</FieldError>
        <label>Método<select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="other">Otro</option></select></label>
        <label>Referencia<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
        <button disabled={pending || Number(membership.pending_amount) <= 0}>{pending ? 'Registrando...' : 'Registrar pago'}</button>
      </form>
      {payments.length === 0 ? <EmptyState>No hay pagos registrados.</EmptyState> : (
        <Table><thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Estado</th></tr></thead>
          <tbody>{payments.map((payment) => <tr key={payment.id}><td>{formatDate(payment.paid_at)}</td><td className="table-amount">{formatMoney(payment.amount)}</td><td>{paymentMethodLabels[payment.payment_method]}</td><td>{payment.reference || '—'}</td><td><StatusBadge status={payment.status} label={paymentStatusLabels[payment.status] ?? payment.status} /></td></tr>)}</tbody>
        </Table>
      )}
    </details>
  )
}

export function MemberMembershipsPage() {
  const { id } = useParams()
  const [member, setMember] = useState<Member | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().slice(0, 10)
  })
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const memberId = Number(id)

  const loadMemberships = useCallback(() => membersApi.memberships(memberId).then(setMemberships), [memberId])
  useEffect(() => {
    Promise.all([membersApi.get(memberId), membersApi.memberships(memberId), commerceApi.plans()])
      .then(([memberData, membershipData, planData]) => {
        setMember(memberData); setMemberships(membershipData); setPlans(planData.filter((plan) => plan.is_active))
        if (planData[0]) setPlanId(String(planData[0].id))
      })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudieron cargar las membresías.')))
      .finally(() => setLoading(false))
  }, [memberId])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setFieldErrors({}); setPending(true)
    try {
      await membersApi.createMembership(memberId, { membership_plan_id: Number(planId), start_date: startDate })
      await loadMemberships()
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo crear la membresía.'))
      setFieldErrors(getFieldErrors(saveError))
    } finally { setPending(false) }
  }

  if (loading) return <Page title="Membresías"><Loading /></Page>
  return (
    <Page title={member ? `Membresías de ${member.first_name} ${member.last_name}` : 'Membresías'} description="Consulta vigencias, saldos y registra renovaciones o pagos.">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <form className="form-card membership-renewal" onSubmit={submit}>
        <h2>Nueva membresía / renovación</h2>
        <label>Plan<select required value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="">Selecciona un plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.price)} · {plan.duration_days} días</option>)}</select></label>
        <FieldError>{fieldErrors.membership_plan_id}</FieldError>
        <label>Fecha de inicio<input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <button disabled={pending || !planId}>{pending ? 'Guardando...' : 'Crear membresía'}</button>
      </form>
      {memberships.length === 0 ? <EmptyState>No hay membresías registradas.</EmptyState> : (
        <Table><thead><tr><th>Plan</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Pagos</th></tr></thead>
          <tbody>{memberships.map((membership) => <tr key={membership.id}>
            <td>{membership.plan?.name ?? plans.find((plan) => plan.id === membership.membership_plan_id)?.name ?? membership.membership_plan_id}</td>
            <td>{formatDate(membership.start_date)}</td><td>{formatDate(membership.end_date)}</td><td><StatusBadge status={membership.status} label={membership.status === 'active' ? 'Activa' : membership.status === 'expired' ? 'Vencida' : membership.status === 'suspended' ? 'Suspendida' : 'Cancelada'} /></td>
            <td>{formatMoney(membership.total_amount)}</td><td>{formatMoney(membership.paid_amount)}</td><td>{formatMoney(membership.pending_amount)}</td>
            <td><MembershipPayment membership={membership} onUpdated={() => void loadMemberships()} /></td>
          </tr>)}</tbody>
        </Table>
      )}
      {member ? <p><Link to={`/members/${member.id}`}>Volver al miembro</Link></p> : null}
    </Page>
  )
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [meta, setMeta] = useState<PageMeta>()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    startTransition(() => setLoading(true))
    commerceApi.payments({ search: search || undefined, from: from || undefined, to: to || undefined, status: status || undefined, payment_method: method || undefined, page })
      .then((result) => { setPayments(result.data); setMeta(result.meta); setError('') })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudieron cargar los pagos.')))
      .finally(() => setLoading(false))
  }, [from, method, page, search, status, to])

  return (
    <Page title="Pagos" description="Consulta movimientos y saldos registrados por membresía." actions={<Link className="button-link icon-button-link" to="/members"><Plus size={17} aria-hidden="true" />Nuevo pago</Link>}>
      <div className="filters payment-filters">
        <label className="filter-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar socio" placeholder="Buscar socio o código" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} /></label>
        <label>Desde<input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value) }} /></label>
        <label>Hasta<input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value) }} /></label>
        <label>Estado<select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}><option value="">Todos</option><option value="paid">Pagado</option><option value="partial">Parcial</option><option value="pending">Pendiente</option><option value="cancelled">Cancelado</option></select></label>
        <label>Método<select value={method} onChange={(e) => { setPage(1); setMethod(e.target.value) }}><option value="">Todos</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="other">Otro</option></select></label>
      </div>
      {loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : payments.length === 0 ? <EmptyState>No hay pagos en este periodo.</EmptyState> : (
        <Table><thead><tr><th>Fecha</th><th>Miembro</th><th>Membresía</th><th>Monto</th><th>Método</th><th>Estado</th><th>Referencia</th><th>Acciones</th></tr></thead>
          <tbody>{payments.map((payment) => <tr key={payment.id}>
            <td>{formatDate(payment.paid_at)}</td><td>{payment.member ? <Link to={`/members/${payment.member.id}`}>{payment.member.first_name} {payment.member.last_name}</Link> : payment.member_id}</td>
            <td>{payment.membership_id ? `#${payment.membership_id}` : '—'}</td>
            <td className="table-amount">{formatMoney(payment.amount)}</td>
            <td>{paymentMethodLabels[payment.payment_method]}</td>
            <td><StatusBadge status={payment.status} label={paymentStatusLabels[payment.status] ?? payment.status} /></td>
            <td>{payment.reference || '—'}</td>
            <td>{payment.member ? <Link className="table-action" to={`/members/${payment.member.id}/memberships`} aria-label={`Ver membresías de ${payment.member.first_name} ${payment.member.last_name}`}><ArrowUpRight size={16} aria-hidden="true" />Ver</Link> : '—'}</td>
          </tr>)}</tbody>
        </Table>
      )}
      <Pagination meta={meta} onChange={setPage} />
    </Page>
  )
}
