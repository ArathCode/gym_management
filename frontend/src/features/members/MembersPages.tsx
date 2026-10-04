import { startTransition, useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import JsBarcode from 'jsbarcode'
import { ErrorMessage, FieldError, Loading, EmptyState, Page, Pagination, Table } from '../../components/ui'
import { membersApi } from '../../services/membersApi'
import type { Member, PageMeta } from '../../types/api'
import { formatDate, getErrorMessage, getFieldErrors } from '../../utils/errors'

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [meta, setMeta] = useState<PageMeta>()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    startTransition(() => setLoading(true))
    membersApi.list({ search: search || undefined, status: status || undefined, page })
      .then((result) => { setMembers(result.data); setMeta(result.meta); setError('') })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'Error al cargar miembros.')))
      .finally(() => setLoading(false))
  }, [search, status, page])

  return (
    <Page title="Miembros" actions={<Link className="button-link" to="/members/new">Nuevo miembro</Link>}>
      <div className="filters">
        <label>Buscar <input aria-label="Buscar miembros" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} /></label>
        <label>Estado <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}>
          <option value="">Todos</option><option value="active">Activo</option><option value="inactive">Inactivo</option>
        </select></label>
      </div>
      {loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : members.length === 0 ? <EmptyState>No hay miembros.</EmptyState> : (
        <Table><thead><tr><th>Código</th><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{members.map((member) => <tr key={member.id}>
            <td>{member.public_code}</td><td>{member.first_name} {member.last_name}</td><td>{member.phone || '—'}</td><td>{member.email || '—'}</td><td>{member.status}</td>
            <td>
              <div className="button-row">
                <Link to={`/members/${member.id}`}>Ver</Link>
                <Link to={`/members/${member.id}/credential`}>Ver credencial</Link>
              </div>
            </td>
          </tr>)}</tbody>
        </Table>
      )}
      <Pagination meta={meta} onChange={setPage} />
    </Page>
  )
}

export function MemberFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [member, setMember] = useState<Member | null>(null)
  const [fields, setFields] = useState({ first_name: '', last_name: '', phone: '', email: '', birth_date: '', status: 'active' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(Boolean(id))
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!id) return
    membersApi.get(Number(id)).then((data) => {
      setMember(data)
      setFields({
        first_name: data.first_name, last_name: data.last_name, phone: data.phone ?? '',
        email: data.email ?? '', birth_date: data.birth_date ?? '', status: data.status,
      })
    }).catch((loadError: unknown) => setMessage(getErrorMessage(loadError, 'No se pudo cargar el miembro.')))
      .finally(() => setLoading(false))
  }, [id])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true); setErrors({}); setMessage('')
    try {
      const saved = id ? await membersApi.update(Number(id), fields) : await membersApi.create(fields)
      navigate(`/members/${saved.id}`)
    } catch (saveError) {
      setMessage(getErrorMessage(saveError, 'No se pudo guardar el miembro.'))
      setErrors(getFieldErrors(saveError))
    } finally { setPending(false) }
  }

  if (loading) return <Page title="Miembro"><Loading /></Page>
  return (
    <Page title={id ? 'Editar miembro' : 'Nuevo miembro'}>
      {message ? <ErrorMessage>{message}</ErrorMessage> : null}
      <form className="form-card" onSubmit={submit}>
        <label>Nombre<input required value={fields.first_name} onChange={(e) => setFields({ ...fields, first_name: e.target.value })} /></label><FieldError>{errors.first_name}</FieldError>
        <label>Apellidos<input required value={fields.last_name} onChange={(e) => setFields({ ...fields, last_name: e.target.value })} /></label><FieldError>{errors.last_name}</FieldError>
        <label>Teléfono<input value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} /></label><FieldError>{errors.phone}</FieldError>
        <label>Email<input type="email" value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} /></label><FieldError>{errors.email}</FieldError>
        <label>Fecha de nacimiento<input type="date" value={fields.birth_date} onChange={(e) => setFields({ ...fields, birth_date: e.target.value })} /></label><FieldError>{errors.birth_date}</FieldError>
        <label>Estado<select value={fields.status} onChange={(e) => setFields({ ...fields, status: e.target.value })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
        {member ? <p>Código: {member.public_code} · Barcode: {member.barcode_value}</p> : null}
        <button disabled={pending}>{pending ? 'Guardando...' : 'Guardar miembro'}</button>
      </form>
    </Page>
  )
}

export function MemberDetailPage() {
  const { id } = useParams()
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => membersApi.get(Number(id))
    .then(setMember)
    .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar el miembro.')))
    .finally(() => setLoading(false)), [id])

  useEffect(() => { void load() }, [load])

  const regenerate = async () => {
    try { await membersApi.regenerateBarcode(Number(id)); await load() }
    catch (regenerateError) { setError(getErrorMessage(regenerateError, 'No se pudo regenerar el código.')) }
  }

  if (loading) return <Page title="Detalle de miembro"><Loading /></Page>
  if (!member) return <Page title="Detalle de miembro"><ErrorMessage>{error || 'Miembro no encontrado.'}</ErrorMessage></Page>
  return (
    <Page title={`${member.first_name} ${member.last_name}`} actions={<Link className="button-link" to={`/members/${member.id}/edit`}>Editar</Link>}>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <dl className="details-grid">
        <dt>Código</dt><dd>{member.public_code}</dd><dt>Barcode</dt><dd>{member.barcode_value}</dd>
        <dt>Teléfono</dt><dd>{member.phone || '—'}</dd><dt>Email</dt><dd>{member.email || '—'}</dd>
        <dt>Estado</dt><dd>{member.status}</dd><dt>Registrado</dt><dd>{formatDate(member.registered_at)}</dd>
      </dl>
      <div className="button-row">
        <button onClick={regenerate}>Regenerar barcode</button>
        <Link className="button-link" to={`/members/${member.id}/credential`}>Ver credencial</Link>
        <Link className="button-link" to={`/members/${member.id}/memberships`}>Ver membresías y pagos</Link>
      </div>
    </Page>
  )
}

export function MemberCredentialPage() {
  const { id } = useParams()
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    membersApi.get(Number(id))
      .then(setMember)
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar la credencial.')))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (member && barcodeRef.current) {
      JsBarcode(barcodeRef.current, member.barcode_value, {
        format: 'CODE128',
        displayValue: false,
        height: 100,
        margin: 8,
        background: '#ffffff',
        lineColor: '#000000',
      })
    }
  }, [member])

  if (loading) return <Page title="Credencial de miembro"><Loading /></Page>
  if (!member) return <Page title="Credencial de miembro"><ErrorMessage>{error || 'Miembro no encontrado.'}</ErrorMessage></Page>

  return (
    <Page
      title="Credencial de miembro"
      actions={<div className="button-row credential-actions"><Link className="button-link" to={`/members/${member.id}`}>Volver al miembro</Link><button onClick={() => window.print()}>Imprimir credencial</button></div>}
    >
      <article className="member-credential" aria-label={`Credencial de ${member.first_name} ${member.last_name}`}>
        <img className="member-credential-template" src="/images/member-credential-template.png" alt="" />
        <span className="credential-name">{member.first_name} {member.last_name}</span>
        <span className="credential-code">{member.barcode_value}</span>
        <div className="credential-barcode"><svg ref={barcodeRef} aria-label={`Código de barras ${member.barcode_value}`} role="img" /></div>
      </article>
    </Page>
  )
}
