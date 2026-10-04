import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import axios from 'axios'
import { BadgeCheck, CircleAlert, ScanLine, ShieldCheck } from 'lucide-react'
import { api } from '../../services/api'

type AccessResult = {
  access?: string
  member?: { first_name?: string; last_name?: string; public_code?: string }
  membership?: { status?: string; ends_at?: string }
  visit_id?: number
}

const accessLabels: Record<string, string> = {
  idle: 'LISTO PARA ESCANEAR',
  granted: 'ACCESO PERMITIDO',
  member_not_found: 'MIEMBRO NO ENCONTRADO',
  membership_expired: 'MEMBRESÍA VENCIDA',
  membership_suspended: 'MEMBRESÍA SUSPENDIDA',
  payment_required: 'PAGO REQUERIDO',
  duplicate_scan: 'LECTURA DUPLICADA',
  member_inactive: 'MIEMBRO INACTIVO',
  invalid_barcode: 'CÓDIGO INVÁLIDO',
}

export function AccessPage() {
  const [barcode, setBarcode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<AccessResult | null>(null)
  const [message, setMessage] = useState('Listo para escanear.')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pendingRef = useRef(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = async (value: string) => {
    const normalized = value.trim()
    if (!normalized || pendingRef.current) return
    pendingRef.current = true
    setPending(true); setMessage('Validando acceso...')
    try {
      const response = await api.post<{ data: AccessResult; message?: string }>('/access/check-in', { barcode: normalized })
      setResult(response.data.data)
      setMessage(response.data.message ?? 'Acceso validado.')
    } catch (error) {
      if (axios.isAxiosError<{ data?: AccessResult; message?: string }>(error) && error.response) {
        setResult(error.response.data.data ?? null)
        setMessage(error.response.data.message ?? 'Acceso denegado.')
      } else {
        setResult(null)
        setMessage('No se pudo conectar con el servidor.')
      }
    } finally {
      pendingRef.current = false
      setPending(false)
      setBarcode('')
      window.setTimeout(() => inputRef.current?.focus(), 30)
    }
  }

  const onSubmit = (event: FormEvent) => { event.preventDefault(); void submit(barcode) }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); void submit(barcode) }
  }
  const code = result?.access ?? 'idle'
  const memberName = [result?.member?.first_name, result?.member?.last_name].filter(Boolean).join(' ')

  return (
    <section className="access-page">
      <section className="scanner-panel">
        <header className="access-heading"><span className="access-heading-icon"><ShieldCheck size={22} aria-hidden="true" /></span><div><p>Recepción</p><h1>Control de acceso</h1><span>Verifica una membresía con el lector de credenciales.</span></div></header>
        <form onSubmit={onSubmit} className="scanner-form">
          <label htmlFor="barcode-input">Escanear credencial</label>
          <input id="barcode-input" ref={inputRef} autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={onKeyDown} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            placeholder="Coloca el cursor y escanea el código" disabled={pending} />
          <button className="access-submit" disabled={pending || !barcode.trim()}><ScanLine size={17} aria-hidden="true" />{pending ? 'Validando...' : 'Registrar acceso'}</button>
        </form>
        <div className={`access-result ${code === 'granted' ? 'is-granted' : code === 'idle' ? 'is-idle' : 'is-denied'}`} role="status" aria-live="polite">
          <span className="access-result-icon" aria-hidden="true">{code === 'granted' ? <BadgeCheck size={25} /> : code === 'idle' ? <ScanLine size={25} /> : <CircleAlert size={25} />}</span>
          <div className="access-result-content">
            <span className="access-result-eyebrow">{pending ? 'Validación en curso' : 'Resultado de validación'}</span>
            <strong>{accessLabels[code] ?? 'ACCESO DENEGADO'}</strong>
            {memberName ? <h2>{memberName}</h2> : <p>{code === 'idle' ? 'Esperando lectura de credencial' : message}</p>}
            {memberName && result?.member?.public_code ? <p>Código de socio <b>{result.member.public_code}</b></p> : null}
            {result?.membership?.status ? <p>Membresía <b>{result.membership.status === 'active' ? 'Activa' : result.membership.status}</b></p> : null}
            {result?.membership?.ends_at ? <p>Vigencia hasta <b>{result.membership.ends_at}</b></p> : null}
            {memberName ? <small>{message}</small> : null}
          </div>
        </div>
      </section>
    </section>
  )
}
