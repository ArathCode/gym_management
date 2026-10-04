import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import App from '../App'
import { AccessPage } from '../features/access/AccessPage'
import { MemberCredentialPage, MemberFormPage } from '../features/members/MembersPages'
import { PosPage } from '../features/sales/PosPage'
import { InventoryPage } from '../features/products/CommercePages'
import { api } from '../services/api'
import { membersApi } from '../services/membersApi'
import { commerceApi } from '../services/commerceApi'
import type { Product, User } from '../types/api'

vi.mock('../services/membersApi', () => ({
  membersApi: {
    list: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } }),
    get: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('../services/commerceApi', () => ({
  commerceApi: {
    products: vi.fn().mockResolvedValue({ data: [], meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 } }),
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
    expect(await screen.findByRole('heading', { name: 'Gym Management' })).toBeInTheDocument()
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
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})

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
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir credencial' }))
    expect(print).toHaveBeenCalled()
  })

  it('sends a barcode on Enter and clears the scanner input', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        data: { access: 'granted', member: { first_name: 'Ana', last_name: 'Lopez', public_code: 'M-1' } },
        message: 'Access granted',
      },
    } as never)
    render(<MemoryRouter><AccessPage /></MemoryRouter>)
    const input = screen.getByLabelText('Escanea la credencial')
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
    vi.mocked(commerceApi.createSale).mockResolvedValue({
      id: 21, member_id: null, subtotal: '20.00', discount: '0.00', total: '20.00',
      payment_method: 'cash', status: 'completed', sold_at: '2026-10-03T12:00:00Z',
    })

    render(<MemoryRouter><PosPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))

    await waitFor(() => expect(commerceApi.createSale).toHaveBeenCalled())
    expect(commerceApi.createSale).toHaveBeenCalledWith({
      payment_method: 'cash',
      items: [{ product_id: product.id, quantity: 1 }],
    })
    expect(screen.getByText(/Venta #21 confirmada/)).toBeInTheDocument()
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
