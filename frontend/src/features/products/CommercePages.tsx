import { startTransition, useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorMessage, FieldError, Loading, Page, Pagination, Table } from '../../components/ui'
import { commerceApi } from '../../services/commerceApi'
import type { InventoryMovement, PageMeta, Product, Sale } from '../../types/api'
import { formatDate, formatMoney, getErrorMessage, getFieldErrors } from '../../utils/errors'

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [meta, setMeta] = useState<PageMeta>()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    startTransition(() => setLoading(true))
    commerceApi.products({ search: search || undefined, page })
      .then((result) => { setProducts(result.data); setMeta(result.meta) })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudieron cargar los productos.')))
      .finally(() => setLoading(false))
  }, [search, page])

  return (
    <Page title="Productos" actions={<Link className="button-link" to="/products/new">Nuevo producto</Link>}>
      <label>Buscar producto <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></label>
      {loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : products.length === 0 ? <EmptyState>No hay productos.</EmptyState> : (
        <Table><thead><tr><th>SKU</th><th>Producto</th><th>Categoría (id)</th><th>Tipo</th><th>Stock</th><th>Precio</th><th>Estado</th><th /></tr></thead>
          <tbody>{products.map((product) => <tr key={product.id}>
            <td>{product.sku}</td><td>{product.name}</td><td>{product.category_id ?? '—'}</td><td>{product.sale_type}</td>
            <td>{product.stock} {product.inventory_unit}</td><td>{formatMoney(product.sale_price)}</td><td>{product.is_active ? 'Activo' : 'Inactivo'}</td>
            <td><Link to={`/products/${product.id}`}>Ver</Link></td>
          </tr>)}</tbody>
        </Table>
      )}
      <Pagination meta={meta} onChange={setPage} />
    </Page>
  )
}

export function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', sku: '', category_id: '', sale_type: 'piece', inventory_unit: 'unit',
    sale_price: '', cost_price: '', stock: '0', minimum_stock: '0', portion_size: '1', is_active: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(id))
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!id) return
    commerceApi.product(Number(id)).then((product) => setForm({
      name: product.name, sku: product.sku, category_id: product.category_id ? String(product.category_id) : '',
      sale_type: product.sale_type, inventory_unit: product.inventory_unit, sale_price: product.sale_price,
      cost_price: product.cost_price, stock: product.stock, minimum_stock: product.minimum_stock,
      portion_size: product.portion_size, is_active: product.is_active,
    })).catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar el producto.')))
      .finally(() => setLoading(false))
  }, [id])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setErrors({}); setError('')
    const payload = {
      ...form,
      category_id: form.category_id ? Number(form.category_id) : null,
      sale_price: Number(form.sale_price), cost_price: Number(form.cost_price || 0),
      stock: Number(form.stock || 0), minimum_stock: Number(form.minimum_stock || 0),
      portion_size: Number(form.portion_size || 1),
    }
    try {
      if (id) await commerceApi.updateProduct(Number(id), payload)
      else await commerceApi.createProduct(payload)
      navigate('/products')
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'No se pudo guardar el producto.'))
      setErrors(getFieldErrors(saveError))
    } finally { setPending(false) }
  }

  if (loading) return <Page title="Producto"><Loading /></Page>
  return (
    <Page title={id ? 'Editar producto' : 'Nuevo producto'}>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <form className="form-card" onSubmit={submit}>
        <label>Nombre<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><FieldError>{errors.name}</FieldError>
        <label>SKU / código de barras<input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} /></label>
        <small>Escribe el SKU o escanéalo con el lector; el valor se guardará como código del producto.</small><FieldError>{errors.sku}</FieldError>
        <label>ID de categoría (opcional)<input type="number" min="1" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} /></label>
        <label>Tipo de venta<select value={form.sale_type} onChange={(e) => setForm((current) => ({
          ...current,
          sale_type: e.target.value,
          inventory_unit: e.target.value === 'piece' ? 'unit' : 'gram',
        }))}><option value="piece">Pieza</option><option value="weight">Granel/peso</option><option value="scoop">Scoop</option></select></label>
        <label>Unidad de inventario<select value={form.inventory_unit} onChange={(e) => setForm({ ...form, inventory_unit: form.sale_type === 'scoop' ? 'gram' : e.target.value })}>
          {form.sale_type === 'scoop' ? <option value="gram">Gramos</option> : <><option value="unit">Pieza (unit)</option><option value="gram">Gramos</option><option value="ml">Mililitros</option></>}
        </select></label><FieldError>{errors.inventory_unit}</FieldError>
        <label>Precio de venta<input type="number" min="0" step="0.01" required value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></label><FieldError>{errors.sale_price}</FieldError>
        <label>Costo<input type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></label>
        {form.sale_type === 'scoop' ? <label>Gramos por scoop<input type="number" min="0.01" step="0.01" required value={form.portion_size} onChange={(e) => setForm({ ...form, portion_size: e.target.value })} /></label> : null}
        {id ? <p>Existencia actual: {form.stock} {form.inventory_unit}. Modifícala desde Inventario para conservar el historial.</p> :
          <label>Existencia inicial<input type="number" min="0" step="0.01" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>}
        <label>Stock mínimo<input type="number" min="0" step="0.01" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} /></label>
        <label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activo</label>
        <button disabled={pending}>{pending ? 'Guardando...' : 'Guardar producto'}</button>
      </form>
    </Page>
  )
}

export function ProductDetailPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    commerceApi.product(Number(id))
      .then(setProduct)
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar el producto.')))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Page title="Producto"><Loading /></Page>
  if (!product) return <Page title="Producto"><ErrorMessage>{error || 'Producto no encontrado.'}</ErrorMessage></Page>
  return (
    <Page title={product.name} actions={<Link className="button-link" to={`/products/${product.id}/edit`}>Editar producto</Link>}>
      <dl className="details-grid">
        <dt>SKU</dt><dd>{product.sku}</dd><dt>Categoría (id)</dt><dd>{product.category_id ?? '—'}</dd>
        <dt>Tipo de venta</dt><dd>{product.sale_type}</dd><dt>Existencia</dt><dd>{product.stock} {product.inventory_unit}</dd>
        <dt>Precio</dt><dd>{formatMoney(product.sale_price)}</dd><dt>Costo</dt><dd>{formatMoney(product.cost_price)}</dd>
        <dt>Mínimo</dt><dd>{product.minimum_stock} {product.inventory_unit}</dd>
        {product.sale_type === 'scoop' ? <><dt>Porción</dt><dd>{product.portion_size} gramos por scoop</dd></> : null}
        <dt>Estado</dt><dd>{product.is_active ? 'Activo' : 'Inactivo'}</dd>
      </dl>
      <p><Link to="/inventory">Abrir inventario</Link></p>
    </Page>
  )
}

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [meta, setMeta] = useState<PageMeta>()
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [productId, setProductId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [sku, setSku] = useState('')
  const skuInput = useRef<HTMLInputElement>(null)
  const [lookupPending, setLookupPending] = useState(false)
  const [type, setType] = useState('IN')
  const [quantity, setQuantity] = useState('')
  const [stockCount, setStockCount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    const [productResult, movementResult] = await Promise.all([
      commerceApi.products(),
      commerceApi.movements({ from: from || undefined, to: to || undefined, page }),
    ])
    startTransition(() => {
      setProducts(productResult.data)
      setMovements(movementResult.data)
      setMeta(movementResult.meta)
    })
  }, [from, page, to])
  useEffect(() => {
    load().catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar el inventario.')))
      .finally(() => setLoading(false))
  }, [load])

  const lookupProduct = async () => {
    const scannedSku = sku.trim()
    if (!scannedSku) return
    setError('')
    setLookupPending(true)
    try {
      const result = await commerceApi.products({ search: scannedSku })
      const product = result.data.find((item) => item.sku.trim().toLocaleLowerCase() === scannedSku.toLocaleLowerCase())
      if (!product) {
        setProductId('')
        setSelectedProduct(null)
        setError(`No se encontró un producto con el SKU "${scannedSku}".`)
        return
      }
      setProducts((current) => current.some((item) => item.id === product.id) ? current : [product, ...current])
      setSelectedProduct(product)
      setProductId(String(product.id))
    } catch (lookupError) {
      setError(getErrorMessage(lookupError, 'No se pudo buscar el producto por SKU.'))
    } finally {
      setSku('')
      setLookupPending(false)
      skuInput.current?.focus()
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setPending(true)
    try {
      const values = type === 'IN'
        ? { type, quantity: Number(quantity), notes }
        : { type, stock_count: Number(stockCount), notes }
      await commerceApi.createMovement(Number(productId), values)
      setQuantity(''); setStockCount(''); setNotes('')
      await load()
    } catch (saveError) { setError(getErrorMessage(saveError, 'No se pudo actualizar el inventario.')) }
    finally { setPending(false) }
  }

  const inventoryProducts = selectedProduct && !products.some((product) => product.id === selectedProduct.id)
    ? [selectedProduct, ...products]
    : products

  return (
    <Page title="Inventario">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <form className="form-card" onSubmit={submit}>
        <h2>Registrar movimiento</h2>
        <div className="filters">
          <label>Escanear SKU / código de barras<input ref={skuInput} value={sku} onChange={(e) => setSku(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void lookupProduct() }
          }} /></label>
          <button type="button" disabled={lookupPending || !sku.trim()} onClick={() => void lookupProduct()}>{lookupPending ? 'Buscando...' : 'Buscar producto'}</button>
        </div>
        <label>Producto<select required value={productId} onChange={(e) => {
          setProductId(e.target.value)
          setSelectedProduct(inventoryProducts.find((product) => String(product.id) === e.target.value) ?? null)
        }}><option value="">Seleccionar</option>{inventoryProducts.map((p) => <option key={p.id} value={p.id}>{p.name} · SKU {p.sku} · {p.stock} {p.inventory_unit}</option>)}</select></label>
        <label>Tipo<select value={type} onChange={(e) => setType(e.target.value)}><option value="IN">Entrada</option><option value="ADJUSTMENT">Ajuste a existencia contada</option></select></label>
        {type === 'IN' ? <label>Cantidad que ingresa<input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          : <label>Stock físico contado<input required type="number" min="0" step="0.01" value={stockCount} onChange={(e) => setStockCount(e.target.value)} /></label>}
        <label>Notas<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <button disabled={pending || !productId}>{pending ? 'Guardando...' : 'Registrar movimiento'}</button>
      </form>
      <div className="filters">
        <label>Desde<input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value) }} /></label>
        <label>Hasta<input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value) }} /></label>
      </div>
      <h2>Movimientos recientes</h2>
      {loading ? <Loading /> : movements.length === 0 ? <EmptyState>No hay movimientos de inventario.</EmptyState> : (
        <Table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Antes</th><th>Después</th><th>Referencia</th></tr></thead>
          <tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.created_at)}</td><td>{movement.product?.name ?? movement.product_id}</td><td>{movement.type}</td><td>{movement.quantity}</td><td>{movement.previous_stock}</td><td>{movement.new_stock}</td><td>{movement.reference_id ?? '—'}</td></tr>)}</tbody>
        </Table>
      )}
      <Pagination meta={meta} onChange={setPage} />
    </Page>
  )
}

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [meta, setMeta] = useState<PageMeta>()
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    startTransition(() => setLoading(true))
    commerceApi.sales({ from: from || undefined, to: to || undefined, page })
      .then((result) => { setSales(result.data); setMeta(result.meta) })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudieron cargar las ventas.')))
      .finally(() => setLoading(false))
  }, [from, to, page])

  return (
    <Page title="Ventas" actions={<Link className="button-link" to="/pos">Nueva venta</Link>}>
      <div className="filters"><label>Desde<input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value) }} /></label><label>Hasta<input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value) }} /></label></div>
      {loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : sales.length === 0 ? <EmptyState>No hay ventas.</EmptyState> : (
        <Table><thead><tr><th>ID</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Método</th></tr></thead>
          <tbody>{sales.map((sale) => <tr key={sale.id}><td><Link to={`/sales/${sale.id}`}>{sale.id}</Link></td><td>{formatDate(sale.sold_at)}</td><td>{sale.member ? `${sale.member.first_name} ${sale.member.last_name}` : 'Venta general'}</td><td>{formatMoney(sale.total)}</td><td>{sale.status}</td><td>{sale.payment_method}</td></tr>)}</tbody>
        </Table>
      )}
      <Pagination meta={meta} onChange={setPage} />
    </Page>
  )
}

export function SaleDetailPage() {
  const { id } = useParams()
  const [sale, setSale] = useState<Sale | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  const load = useCallback(() => commerceApi.sale(Number(id)).then(setSale)
    .catch((loadError: unknown) => setError(getErrorMessage(loadError, 'No se pudo cargar la venta.')))
    .finally(() => setLoading(false)), [id])
  useEffect(() => { void load() }, [load])

  const cancel = async () => {
    if (!window.confirm('¿Cancelar esta venta y devolver los productos al inventario?')) return
    setPending(true); setError('')
    try { setSale(await commerceApi.cancelSale(Number(id))) }
    catch (cancelError) { setError(getErrorMessage(cancelError, 'No se pudo cancelar la venta.')) }
    finally { setPending(false) }
  }

  if (loading) return <Page title="Venta"><Loading /></Page>
  if (!sale) return <Page title="Venta"><ErrorMessage>{error || 'Venta no encontrada.'}</ErrorMessage></Page>
  return (
    <Page title={`Venta #${sale.id}`}>
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      <p>Fecha: {formatDate(sale.sold_at)} · Estado: {sale.status} · Método: {sale.payment_method}</p>
      <Table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th><th>Descuento stock</th></tr></thead>
        <tbody>{sale.items?.map((item) => <tr key={item.id}><td>{item.product?.name ?? item.product_id}</td><td>{item.quantity}</td><td>{formatMoney(item.unit_price)}</td><td>{formatMoney(item.subtotal)}</td><td>{item.inventory_quantity} {item.product?.inventory_unit}</td></tr>)}</tbody>
      </Table>
      <p><strong>Total: {formatMoney(sale.total)}</strong></p>
      {sale.status === 'completed' ? <button className="button-danger" disabled={pending} onClick={cancel}>{pending ? 'Cancelando...' : 'Cancelar venta'}</button> : <p>La venta está cancelada.</p>}
    </Page>
  )
}
