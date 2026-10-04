import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorMessage, Loading, Page, Table } from '../../components/ui'
import { commerceApi } from '../../services/commerceApi'
import type { PaymentMethod, Product, Sale } from '../../types/api'
import { formatMoney, getErrorMessage } from '../../utils/errors'

type CartLine = { product: Product; quantity: number }

export function PosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [scannedSku, setScannedSku] = useState('')
  const [scanPending, setScanPending] = useState(false)
  const scanInput = useRef<HTMLInputElement>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sale, setSale] = useState<Sale | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    startTransition(() => setLoading(true))
    commerceApi.products({ search: search || undefined })
      .then((result) => setProducts(result.data.filter((product) => product.is_active)))
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudieron cargar los productos.')))
      .finally(() => setLoading(false))
  }, [search])

  const estimate = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.product.sale_price) * line.quantity, 0),
    [cart],
  )

  const add = (product: Product) => {
    setSale(null)
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      return existing
        ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1 }]
    })
  }

  const scanProduct = async (event: FormEvent) => {
    event.preventDefault()
    const sku = scannedSku.trim()
    if (!sku || scanPending) return
    setScanPending(true)
    setError('')
    try {
      const result = await commerceApi.products({ search: sku })
      const product = result.data.find((item) => item.sku.trim().toLocaleLowerCase() === sku.toLocaleLowerCase())
      if (!product || !product.is_active) {
        setError(`No se encontró un producto activo con el SKU "${sku}".`)
        return
      }
      add(product)
      setSearch('')
    } catch (lookupError) {
      setError(getErrorMessage(lookupError, 'No se pudo buscar el producto por SKU.'))
    } finally {
      setScannedSku('')
      setScanPending(false)
      scanInput.current?.focus()
    }
  }

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) setCart((current) => current.filter((line) => line.product.id !== productId))
    else setCart((current) => current.map((line) => line.product.id === productId ? { ...line, quantity } : line))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!cart.length) return
    setPending(true); setError(''); setSale(null)
    try {
      const created = await commerceApi.createSale({
        payment_method: paymentMethod,
        items: cart.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
      })
      setSale(created)
      setCart([])
    } catch (saleError) { setError(getErrorMessage(saleError, 'No se pudo confirmar la venta.')) }
    finally { setPending(false) }
  }

  return (
    <Page title="Punto de venta">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {sale ? <div className="success-message" role="status">Venta #{sale.id} confirmada por {formatMoney(sale.total)}. <Link to={`/sales/${sale.id}`}>Ver detalle</Link></div> : null}
      <div className="pos-grid">
        <section>
          <h2>Productos</h2>
          <form className="filters" onSubmit={scanProduct}>
            <label>Escanear SKU / código de barras
              <input ref={scanInput} value={scannedSku} onChange={(e) => setScannedSku(e.target.value)} placeholder="Escanea o escribe el SKU" />
            </label>
            <button disabled={scanPending || !scannedSku.trim()}>{scanPending ? 'Buscando...' : 'Agregar por código'}</button>
          </form>
          <label>Buscar producto <input value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          {loading ? <Loading /> : products.length === 0 ? <EmptyState>No se encontraron productos activos.</EmptyState> : (
            <Table><thead><tr><th>Producto</th><th>Precio</th><th>Existencia</th><th /></tr></thead>
              <tbody>{products.map((product) => <tr key={product.id}>
                <td>{product.name} ({product.sale_type === 'scoop' ? `${product.portion_size} ${product.inventory_unit}/scoop` : product.inventory_unit})</td>
                <td>{formatMoney(product.sale_price)}</td><td>{product.stock}</td><td><button onClick={() => add(product)}>Agregar</button></td>
              </tr>)}</tbody>
            </Table>
          )}
        </section>
        <section>
          <h2>Carrito</h2>
          {cart.length === 0 ? <EmptyState>Agrega productos para comenzar.</EmptyState> : (
            <Table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th /></tr></thead>
              <tbody>{cart.map(({ product, quantity }) => <tr key={product.id}>
                <td>{product.name}</td>
                <td><input aria-label={`Cantidad ${product.name}`} type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => updateQuantity(product.id, Number(e.target.value))} /></td>
                <td>{formatMoney(product.sale_price)}</td><td><button className="button-secondary" onClick={() => updateQuantity(product.id, 0)}>Quitar</button></td>
              </tr>)}</tbody>
            </Table>
          )}
          <p>Estimado: {formatMoney(estimate)} <small>(importe definitivo devuelto por Laravel)</small></p>
          <form onSubmit={submit}>
            <label>Método de pago<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              <option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="other">Otro</option>
            </select></label>
            <div className="button-row">
              <button disabled={pending || cart.length === 0}>{pending ? 'Confirmando...' : 'Confirmar venta'}</button>
              <button className="button-secondary" type="button" disabled={!cart.length || pending} onClick={() => setCart([])}>Limpiar carrito</button>
              {sale ? <button className="button-secondary" type="button" onClick={() => navigate(`/sales/${sale.id}`)}>Detalle de venta</button> : null}
            </div>
          </form>
        </section>
      </div>
    </Page>
  )
}
