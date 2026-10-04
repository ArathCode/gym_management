import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../app/useAuth'
import { ErrorMessage, FieldError } from '../../components/ui'
import { getErrorMessage, getFieldErrors } from '../../utils/errors'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { message?: string } | null)?.message

  if (!loading && user) return <Navigate to="/" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    setFieldErrors({})
    try {
      await login(email, password)
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (loginError) {
      setError(getErrorMessage(loginError, 'No se pudo iniciar sesión.'))
      setFieldErrors(getFieldErrors(loginError))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="login-page">
      <form className="form-card login-card" onSubmit={submit}>
        <div className="login-brand"><span className="brand-mark" aria-hidden="true" /><span className="brand-wordmark"><strong>MOICANO</strong><small>BOXING CLUB</small></span></div>
        <h1>Inicia sesión</h1>
        <p>Accede al panel de operación del gimnasio.</p>
        {notice ? <ErrorMessage>{notice}</ErrorMessage> : null}
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        <label htmlFor="login-email">Correo electrónico</label>
        <input id="login-email" type="email" autoComplete="username" required value={email}
          onChange={(event) => setEmail(event.target.value)} />
        <FieldError>{fieldErrors.email}</FieldError>
        <label htmlFor="login-password">Contraseña</label>
        <input id="login-password" type="password" autoComplete="current-password" required value={password}
          onChange={(event) => setPassword(event.target.value)} />
        <FieldError>{fieldErrors.password}</FieldError>
        <button disabled={pending || loading}>{pending ? 'Ingresando...' : <>Iniciar sesión<ArrowRight size={17} aria-hidden="true" /></>}</button>
      </form>
    </main>
  )
}
