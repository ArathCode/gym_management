import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../app/AuthProvider'
import { AppLayout } from '../layouts/AppLayout'
import { AccessPage } from '../features/access/AccessPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { MemberCredentialPage, MemberFormPage, MembersPage } from '../features/members/MembersPages'
import { PaymentsPage } from '../features/memberships/MembershipPages'
import { PosPage } from '../features/sales/PosPage'
import { InventoryPage, ProductsPage } from '../features/products/CommercePages'
import { api } from '../services/api'
import { membersApi } from '../services/membersApi'
import { createCredentialImage } from '../features/members/services/credentialImage'
import { commerceApi } from '../services/commerceApi'
import type { Product, User } from '../types/api'

vi.mock('../services/membersApi', () => ({
  membersApi: {
    list: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } }),
    get: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../features/members/services/credentialImage', () => ({ createCredentialImage: vi.fn() }))

vi.mock('../services/commerceApi', () => ({
  commerceApi: {
    dashboard: vi.fn().mockResolvedValue({
      timezone: 'UTC', active_members: 0, new_active_members_this_week: 0,
      active_plans: 0, new_active_plans_this_week: 0,
      income_today: { memberships: '0.00', pos: '0.00', total: '0.00' },
      income_yesterday: { memberships: '0.00', pos: '0.00', total: '0.00' },
      income_change_percent: null, visits_today: 0, visits_change: 0,
      recent_visits: [], low_stock_count: 0, low_stock_products: [],
    }),
    products: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } }),
    payments: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } }),
    movements: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } }),
    createMovement: vi.fn(),
    createSale: vi.fn(),
  },
}))

const user: User = { id: 1, name: 'Reception', email: 'staff@example.test' }

beforeEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => cleanup())

describe('Authentication and protected routes', () => {
  it('redirects unauthenticated users to login', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
  })

  it('logs in and opens the protected dashboard', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { data: { user, token: 'test-token', token_type: 'Bearer' } },
    } as never)
    vi.spyOn(api, 'get').mockResolvedValue({ data: { data: user } } as never)
    vi.mocked(membersApi.list).mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } })
    vi.mocked(commerceApi.products).mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } })

    render(<App />)
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: user.email } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(sessionStorage.getItem('gym-api-token')).toBe('test-token')
  })
})

describe('Main operation flows', () => {
  it('shows dashboard visits, actual inventory units and actionable shortcuts', async () => {
    vi.mocked(commerceApi.dashboard).mockResolvedValueOnce({
      timezone: 'UTC', active_members: 5, new_active_members_this_week: 1,
      active_plans: 3, new_active_plans_this_week: 0,
      income_today: { memberships: '100.00', pos: '50.00', total: '150.00' },
      income_yesterday: { memberships: '50.00', pos: '50.00', total: '100.00' },
      income_change_percent: '50.00', visits_today: 8, visits_change: 3,
      recent_visits: [{ id: 1, checked_in_at: '2026-10-04T10:24:00Z', access_status: 'granted',
        member: { id: 8, public_code: 'M-8', barcode_value: '', first_name: 'Ana', last_name: 'Example', phone: null, email: null, birth_date: null, status: 'active', registered_at: null } }],
      low_stock_count: 1,
      low_stock_products: [{ id: 22, name: 'Whey', sku: 'WHEY', stock: '30.00', minimum_stock: '60.00', inventory_unit: 'gram' }],
    })
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: 'Ana Example' })).toHaveAttribute('href', '/members/8')
    expect(screen.getByText('+50% vs. ayer')).toBeInTheDocument()
    expect(screen.getByText('Entrada')).toBeInTheDocument()
    expect(screen.getByText(/Mínimo: 60\.00 g/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver todos →' })).toHaveAttribute('href', '/reports?type=attendance')
    expect(screen.getByRole('link', { name: /Nuevo pago/ })).toHaveAttribute('href', '/members')
  })

  it('shows explicit dashboard empty states', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(await screen.findByText('Todavía no hay accesos registrados.')).toBeInTheDocument()
    expect(screen.getByText('No hay productos con inventario bajo.')).toBeInTheDocument()
    expect(screen.getByText('Sin base de comparación ayer')).toBeInTheDocument()
  })

  it('keeps public access inside the global navigation', () => {
    render(<MemoryRouter initialEntries={['/access']}><AuthProvider><AppLayout><AccessPage /></AppLayout></AuthProvider></MemoryRouter>)

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Accesos' })).toHaveClass('active')
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('textbox', { name: 'Escanear credencial' })).toBeInTheDocument()
  })

  it('renders products as cards with stock measured in grams', async () => {
    vi.mocked(commerceApi.products).mockResolvedValue({
      data: [{
        id: 22, name: 'Proteína whey', sku: 'WHEY-22', category_id: 5, sale_type: 'scoop', inventory_unit: 'gram',
        sale_price: '35.00', cost_price: '20.00', stock: '1940.00', minimum_stock: '100.00', portion_size: '30.00', is_active: true,
      }],
      meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
    })

    render(<MemoryRouter><ProductsPage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Proteína whey' })).toBeInTheDocument()
    expect(screen.getByText('1940.00 gram')).toBeInTheDocument()
    expect(screen.getByText('≈ 64 scoops')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/products/22/edit')
  })

  it('filters payments by status and payment method', async () => {
    vi.mocked(commerceApi.payments).mockResolvedValue({
      data: [{
        id: 31, member_id: 8, membership_id: 13, amount: '125.00', payment_method: 'card', reference: 'R-31',
        status: 'partial', paid_at: '2026-10-03T10:00:00Z',
        member: { id: 8, public_code: 'M-008', barcode_value: 'B-8', first_name: 'Eva', last_name: 'Diaz', phone: null, email: null, birth_date: null, status: 'active', registered_at: null },
      }],
      meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
    })

    render(<MemoryRouter><PaymentsPage /></MemoryRouter>)

    expect(await screen.findByText('Parcial')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'partial' } })
    fireEvent.change(screen.getByLabelText('Método'), { target: { value: 'card' } })
    await waitFor(() => expect(commerceApi.payments).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'partial', payment_method: 'card' })))
  })

  it('renders member cards with actions and retains the status filter', async () => {
    vi.mocked(membersApi.list).mockResolvedValue({
      data: [{
        id: 12, public_code: 'M-001', barcode_value: 'MBR-001', first_name: 'Ana', last_name: 'Lopez',
        phone: '5550101001', email: 'ana@example.test', birth_date: null, status: 'active', registered_at: null,
      }],
      meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 },
    })

    render(<MemoryRouter><MembersPage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Ana Lopez' })).toBeInTheDocument()
    expect(screen.getByText('Código: M-001')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/members/12')
    expect(screen.getByRole('link', { name: 'Credencial' })).toHaveAttribute('href', '/members/12/credential')
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/members/12/edit')

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactive' } })
    await waitFor(() => expect(membersApi.list).toHaveBeenLastCalledWith({ search: undefined, status: 'inactive', page: 1 }))
  })

  it('submits the member form and navigates to the created member', async () => {
    vi.mocked(membersApi.create).mockResolvedValue({
      id: 12, public_code: 'M-12', barcode_value: 'MBR-12', first_name: 'Ana', last_name: 'Lopez',
      phone: null, email: null, birth_date: null, status: 'active', registered_at: null,
    })

    render(
      <MemoryRouter initialEntries={['/members/new']}>
        <Routes><Route path="/members/new" element={<MemberFormPage />} /><Route path="/members/:id" element={<p>Member created</p>} /></Routes>
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Lopez' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar miembro' }))

    expect(await screen.findByText('Member created')).toBeInTheDocument()
    expect(membersApi.create).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Ana', last_name: 'Lopez' }))
  })

  it('renders a member credential using the provided template and barcode value', async () => {
    vi.mocked(membersApi.get).mockResolvedValue({
      id: 12, public_code: 'M-12', barcode_value: 'MBR-A7F9K2XQ', first_name: 'Ana', last_name: 'Lopez',
      phone: null, email: null, birth_date: null, status: 'active', registered_at: null,
    })
    const blob = new Blob(['credential'], { type: 'image/png' })
    vi.mocked(createCredentialImage).mockResolvedValueOnce(blob)
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:credential')
    let downloadedName = ''
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download
    })

    render(
      <MemoryRouter initialEntries={['/members/12/credential']}>
        <Routes><Route path="/members/:id/credential" element={<MemberCredentialPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText('MBR-A7F9K2XQ')).toBeInTheDocument()
    expect(screen.getByAltText('')).toHaveAttribute('src', '/images/member-credential-template.png')
    const barcode = screen.getByRole('img', { name: 'Código de barras MBR-A7F9K2XQ' })
    await waitFor(() => expect(barcode.querySelector('rect')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Descargar credencial PNG' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(createCredentialImage).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Ana', barcode_value: 'MBR-A7F9K2XQ' }))
    expect(createUrl).toHaveBeenCalledWith(blob)
    expect(downloadedName).toBe('credencial-M-12.png')
  })

  it('sends a barcode on Enter and clears the scanner input', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        data: { access: 'granted', member: { first_name: 'Ana', last_name: 'Lopez', public_code: 'M-1' } },
        message: 'Access granted',
      },
    } as never)
    render(<MemoryRouter><AccessPage /></MemoryRouter>)
    const input = screen.getByLabelText('Escanear credencial')
    fireEvent.change(input, { target: { value: ' MBR-1 ' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText('ACCESO PERMITIDO')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/access/check-in', { barcode: 'MBR-1' })
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('confirms a POS sale without sending prices or totals from the browser', async () => {
    const product: Product = {
      id: 5, name: 'Agua', sku: 'WATER', category_id: null, sale_type: 'piece', inventory_unit: 'unit',
      sale_price: '20.00', cost_price: '10.00', stock: '6.00', minimum_stock: '1.00', portion_size: '1.00', is_active: true,
    }
    vi.mocked(commerceApi.products).mockResolvedValue({ data: [product], meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 } })
    const updatedProduct = { ...product, stock: '5.00' }
    vi.mocked(commerceApi.createSale).mockResolvedValue({
      id: 21, member_id: null, subtotal: '20.00', discount: '0.00', total: '20.00',
      payment_method: 'cash', status: 'completed', sold_at: '2026-10-03T12:00:00Z',
      items: [{ id: 1, product_id: product.id, quantity: '1.00', unit_price: '20.00', subtotal: '20.00', inventory_quantity: '1.00', product: updatedProduct }],
    })

    render(<MemoryRouter><PosPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar Agua' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }))

    await waitFor(() => expect(commerceApi.createSale).toHaveBeenCalled())
    expect(commerceApi.createSale).toHaveBeenCalledWith({
      payment_method: 'cash',
      items: [{ product_id: product.id, quantity: 1 }],
    })
    expect(screen.getByText(/Venta #21 confirmada/)).toBeInTheDocument()
    expect(await screen.findByText(/5\.00 unit disponibles/)).toBeInTheDocument()
  })

  it('adds a POS product by scanned SKU while keeping name search available', async () => {
    const product: Product = {
      id: 8, name: 'Proteína', sku: 'PROT-128', category_id: null, sale_type: 'piece', inventory_unit: 'unit',
      sale_price: '35.00', cost_price: '20.00', stock: '4.00', minimum_stock: '1.00', portion_size: '1.00', is_active: true,
    }
    vi.mocked(commerceApi.products).mockResolvedValue({ data: [product], meta: { current_page: 1, per_page: 15, total: 1, last_page: 1 } })

    render(<MemoryRouter><PosPage /></MemoryRouter>)
    const scanner = screen.getByLabelText('Escanear SKU / código de barras')
    fireEvent.change(scanner, { target: { value: ' PROT-128 ' } })
    fireEvent.submit(scanner.closest('form')!)

    expect(await screen.findByLabelText('Cantidad Proteína')).toHaveValue(1)
    expect(commerceApi.products).toHaveBeenCalledWith({ search: 'PROT-128' })
    expect(screen.getByLabelText('Buscar producto')).toBeInTheDocument()
  })

  it('selects an inventory product by scanned SKU', async () => {
    const product: Product = {
      id: 9, name: 'Agua', sku: 'WATER-9', category_id: null, sale_type: 'piece', inventory_unit: 'unit',
      sale_price: '20.00', cost_price: '10.00', stock: '6.00', minimum_stock: '1.00', portion_size: '1.00', is_active: true,
    }
    vi.mocked(commerceApi.products).mockImplementation(async ({ search } = {}) => ({
      data: search ? [product] : [],
      meta: { current_page: 1, per_page: 15, total: search ? 1 : 0, last_page: 1 },
    }))
    vi.mocked(commerceApi.movements).mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } })

    render(<MemoryRouter><InventoryPage /></MemoryRouter>)
    const scanner = screen.getByLabelText('Escanear SKU / código de barras')
    fireEvent.change(scanner, { target: { value: 'WATER-9' } })
    fireEvent.keyDown(scanner, { key: 'Enter', code: 'Enter' })

    await waitFor(() => expect(screen.getByLabelText('Producto')).toHaveValue('9'))
    expect(screen.getByRole('option', { name: /Agua · SKU WATER-9/ })).toBeInTheDocument()
    expect(commerceApi.products).toHaveBeenCalledWith({ search: 'WATER-9' })
  })
})
