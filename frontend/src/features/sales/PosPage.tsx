import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Package, Plus, Search, Trash2 } from 'lucide-react'
import { EmptyState, ErrorMessage, Loading, Page } from '../../components/ui'
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
      setProducts((current) => current.map((product) =>
        created.items?.find((item) => item.product_id === product.id)?.product ?? product,
      ))
      setSale(created)
      setCart([])
    } catch (saleError) { setError(getErrorMessage(saleError, 'No se pudo confirmar la venta.')) }
    finally { setPending(false) }
  }

  return (
    <Page title="Punto de venta" description="Escanea o selecciona productos para iniciar una venta.">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {sale ? <div className="success-message" role="status">Venta #{sale.id} confirmada por {formatMoney(sale.total)}. <Link to={`/sales/${sale.id}`}>Ver detalle</Link></div> : null}
      <div className="pos-grid">
        <section className="pos-products-panel">
          <div className="pos-section-heading"><div><h2>Productos</h2><p>Selecciona un artículo para agregarlo al carrito.</p></div><span>{products.length} productos</span></div>
          <form className="filters pos-scan-form" onSubmit={scanProduct}>
            <label>Escanear SKU / código de barras
              <input ref={scanInput} value={scannedSku} onChange={(e) => setScannedSku(e.target.value)} placeholder="Escanea o escribe el SKU" />
            </label>
            <button disabled={scanPending || !scannedSku.trim()}>{scanPending ? 'Buscando...' : 'Agregar por código'}</button>
          </form>
          <label className="pos-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar producto" placeholder="Buscar producto" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          {loading ? <Loading /> : products.length === 0 ? <EmptyState>No se encontraron productos activos.</EmptyState> : (
            <div className="pos-product-grid">
              {products.map((product) => (
                <button className="pos-product-card" type="button" key={product.id} aria-label={`Agregar ${product.name}`} onClick={() => add(product)}>
                  <span className="pos-product-icon"><Package size={20} aria-hidden="true" /></span>
                  <span className="pos-product-name">{product.name}</span>
                  <span className="pos-product-category">{product.category_id ? `Categoría #${product.category_id}` : 'Producto'}</span>
                  <span className="pos-product-price">{formatMoney(product.sale_price)}{product.sale_type === 'scoop' ? ' / scoop' : product.sale_type === 'piece' ? ' / unidad' : ` / ${product.inventory_unit}`}</span>
                  <span className="pos-product-stock">{product.sale_type === 'scoop' ? 'Por scoop · ' : product.sale_type === 'weight' ? 'A granel · ' : ''}{product.stock} {product.inventory_unit} disponibles</span>
                  <span className="pos-product-add"><Plus size={16} aria-hidden="true" />Agregar</span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="pos-cart-panel">
          <div className="pos-section-heading"><div><h2>Carrito</h2><p>{cart.length} artículos</p></div></div>
          {cart.length === 0 ? <EmptyState>Agrega productos para comenzar.</EmptyState> : (
            <div className="pos-cart-list">
              {cart.map(({ product, quantity }) => (
                <article className="pos-cart-item" key={product.id}>
                  <div className="pos-cart-item-info"><strong>{product.name}</strong><span>{formatMoney(product.sale_price)} c/u</span></div>
                  <label>Cantidad<input aria-label={`Cantidad ${product.name}`} type="number" min="0.01" step={product.sale_type === 'piece' || product.sale_type === 'scoop' ? '1' : '0.01'} value={quantity} onChange={(e) => updateQuantity(product.id, Number(e.target.value))} /></label>
                  <strong className="pos-line-total">{formatMoney(Number(product.sale_price) * quantity)}</strong>
                  <button className="button-icon button-secondary" type="button" aria-label={`Quitar ${product.name}`} onClick={() => updateQuantity(product.id, 0)}><Trash2 size={17} aria-hidden="true" /></button>
                </article>
              ))}
            </div>
          )}
          <div className="pos-total"><span>Total estimado</span><strong>{formatMoney(estimate)}</strong><small>El importe definitivo lo confirma Laravel.</small></div>
          <form className="pos-checkout" onSubmit={submit}>
            <label>Método de pago<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              <option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="other">Otro</option>
            </select></label>
            <div className="button-row">
              <button className="pos-charge-button" disabled={pending || cart.length === 0}>{pending ? 'Procesando...' : 'Cobrar'}</button>
              <button className="button-secondary" type="button" disabled={!cart.length || pending} onClick={() => setCart([])}><Minus size={16} aria-hidden="true" />Limpiar</button>
              {sale ? <button className="button-secondary" type="button" onClick={() => navigate(`/sales/${sale.id}`)}>Detalle de venta</button> : null}
            </div>
          </form>
        </section>
      </div>
    </Page>
  )
}
