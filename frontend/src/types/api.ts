export type ApiResponse<T> = {
  data: T
  message?: string
}

export type PageMeta = {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export type PageResponse<T> = {
  data: T[]
  meta: PageMeta
}

export type ApiError = {
  message: string
  errors?: Record<string, string[]>
}

export type User = {
  id: number
  name: string
  email: string
}

export type Member = {
  id: number
  public_code: string
  barcode_value: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  status: 'active' | 'inactive'
  registered_at: string | null
}

export type MembershipPlan = {
  id: number
  name: string
  description: string | null
  duration_days: number
  price: string
  is_active: boolean
}

export type Payment = {
  id: number
  member_id: number
  membership_id: number | null
  amount: string
  payment_method: PaymentMethod
  reference: string | null
  status: string
  paid_at: string | null
  member?: Member
}

export type Membership = {
  id: number
  member_id: number
  membership_plan_id: number
  start_date: string
  end_date: string
  status: 'active' | 'expired' | 'suspended' | 'cancelled'
  total_amount: string
  paid_amount: string
  pending_amount: string
  plan?: MembershipPlan
}

export type InventoryUnit = 'unit' | 'gram' | 'ml'
export type SaleType = 'piece' | 'weight' | 'scoop'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export type Product = {
  id: number
  name: string
  sku: string
  category_id: number | null
  sale_type: SaleType
  inventory_unit: InventoryUnit
  sale_price: string
  cost_price: string
  stock: string
  minimum_stock: string
  portion_size: string
  is_active: boolean
}

export type SaleItem = {
  id: number
  product_id: number
  quantity: string
  unit_price: string
  subtotal: string
  inventory_quantity: string
  product?: Product
}

export type Sale = {
  id: number
  member_id: number | null
  member?: Member | null
  subtotal: string
  discount: string
  total: string
  payment_method: PaymentMethod
  status: 'completed' | 'cancelled'
  sold_at: string | null
  items?: SaleItem[]
}

export type InventoryMovement = {
  id: number
  product_id: number
  product?: Product
  type: string
  quantity: string
  previous_stock: string
  new_stock: string
  reference_type: string | null
  reference_id: number | null
  notes: string | null
  created_at: string
}

export type Visit = {
  id: number
  member: Member
  checked_in_at: string
  access_status: 'granted' | 'denied'
}

export type Report = {
  summary: Record<string, number | string>
  by_day?: Array<Record<string, number | string>>
  by_method?: Array<Record<string, number | string>>
  low_stock_products?: Product[]
  by_movement_type?: Array<Record<string, number | string>>
  recent_visits?: Visit[]
}

export type DashboardSummary = {
  timezone: string
  active_members: number
  new_active_members_this_week: number
  active_plans: number
  new_active_plans_this_week: number
  income_today: { memberships: string; pos: string; total: string }
  income_yesterday: { memberships: string; pos: string; total: string }
  income_change_percent: string | null
  visits_today: number
  visits_change: number
  recent_visits: Visit[]
  low_stock_count: number
  low_stock_products: Pick<Product, 'id' | 'name' | 'sku' | 'stock' | 'minimum_stock' | 'inventory_unit'>[]
}
