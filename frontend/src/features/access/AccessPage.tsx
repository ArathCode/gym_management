import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import axios from 'axios'
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
    <main className="access-page">
      <section className="scanner-panel">
        <p>Recepción</p><h1>Control de acceso</h1>
        <form onSubmit={onSubmit} className="scanner-form">
          <label htmlFor="barcode-input">Escanea la credencial</label>
          <input id="barcode-input" ref={inputRef} autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={onKeyDown} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            placeholder="MBR-..." disabled={pending} />
          <button disabled={pending || !barcode.trim()}>{pending ? 'Validando...' : 'Registrar acceso'}</button>
        </form>
        <div className={`result-card ${code === 'granted' ? 'granted' : code === 'idle' ? 'idle' : 'denied'}`}>
          <strong>{accessLabels[code] ?? 'ACCESO DENEGADO'}</strong>
          <p>{memberName || (code === 'idle' ? 'Esperando lectura' : '')}</p>
          <p>{message}</p>
          {result?.member?.public_code ? <small>Socio: {result.member.public_code}</small> : null}
          {result?.membership?.ends_at ? <small>Vence: {result.membership.ends_at}</small> : null}
        </div>
      </section>
    </main>
  )
}
