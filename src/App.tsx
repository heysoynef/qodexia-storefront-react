import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowRight,
  Heart,
  House,
  LogIn,
  LogOut,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  UserRound,
  Zap,
} from 'lucide-react'
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://ecommerce.qodexia.site/api/v1'
const TOKEN_KEY = 'qodexia_storefront_token'
const USER_KEY = 'qodexia_storefront_user'

type User = {
  id: number
  name: string
  email: string
  is_customer: boolean
}

type Category = {
  id: number
  name: string
  slug: string
  description: string
  products_count: number
  image_url: string
}

type Variant = {
  id: number
  sku: string
  title: string
  price: number
  sale_price: number | null
  effective_price: number
  stock: number
  attributes: Array<{ attribute: string; value: string }>
}

type Product = {
  id: number
  sku: string
  name: string
  slug: string
  status: string
  featured: boolean
  price: number
  sale_price: number | null
  compare_at_price: number | null
  effective_price: number
  has_discount: boolean
  stock: number
  track_inventory: boolean
  short_description: string
  description: string
  image_url: string
  url: string
  categories: Category[]
  variants: Variant[]
}

type CartItem = {
  key: string
  quantity: number
  price: number
  line_total: number
  product: {
    id: number
    name: string
    slug: string
    image_url: string
  }
  variant: {
    id: number
    title: string
    sku: string
  } | null
}

type Cart = {
  count: number
  total: number
  items: CartItem[]
}

type Address = {
  id: number
  label: string
  recipient_name: string
  phone: string
  line1: string
  line2: string | null
  city: string
  state: string
  postal_code: string
  country: string
  references: string | null
  is_default: boolean
  full_address: string
}

type Order = {
  id: number
  code: string
  payment_method: string
  payment_method_label: string
  payment_status: string
  payment_status_label: string
  total: number
  subtotal_amount: number
  shipping_cost: number
  coupon_discount: number
  items_count: number | null
  shipping: {
    recipient_name: string
    phone: string
    line1: string
    line2: string | null
    city: string
    state: string
    postal_code: string
    references: string | null
    method_name: string
  }
  items?: Array<{
    id: number
    product_id: number
    product_name: string
    product_slug: string
    quantity: number
    unit_price: number
    line_total: number
  }>
  created_at: string
  paid_at: string | null
}

type WishlistItem = {
  id: number
  product: Product
  created_at: string
}

type ShippingMethod = {
  id: string
  name: string
  description: string | null
  computed_cost: number
}

type CheckoutSummary = {
  shipping_state: string
  sales_allowed: boolean
  items_count: number
  subtotal: number
  coupon: { id: number; code: string } | null
  coupon_discount: number
  shipping_methods: ShippingMethod[]
  selected_shipping_method_id: string | null
  shipping_cost: number
  tax_amount: number
  total: number
}

type FlashState = {
  tone: 'info' | 'success' | 'error'
  text: string
}

type AppState = {
  token: string | null
  user: User | null
  categories: Category[]
  products: Product[]
  cart: Cart
  flash: FlashState | null
  authBusy: boolean
  setFlash: (flash: FlashState | null) => void
  refreshCart: () => Promise<void>
  addToCart: (productId: number, quantity?: number, variantId?: number) => Promise<void>
  updateCartItem: (key: string, quantity: number) => Promise<void>
  removeCartItem: (key: string) => Promise<void>
  clearCart: () => Promise<void>
  login: (email: string, password: string, mode?: 'login' | 'register', name?: string) => Promise<void>
  logout: () => Promise<void>
  setAuth: (token: string, user: User) => void
}

type ApiOptions = RequestInit & {
  token?: string | null
}

function money(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(value)
}

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {})
  headers.set('Accept', 'application/json')

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message =
      payload.message ??
      payload.errors?.[Object.keys(payload.errors)[0]]?.[0] ??
      'No se pudo completar la solicitud.'
    throw new Error(message)
  }

  return payload as T
}

function icon(name: string) {
  const map = {
    home: House,
    product: Package,
    cart: ShoppingCart,
    user: UserRound,
    admin: ShieldCheck,
    login: LogIn,
    logout: LogOut,
    bag: ShoppingBag,
    search: Search,
    star: Star,
    order: Package,
    pin: Sparkles,
    heart: Heart,
    delivery: Truck,
    speed: Zap,
    secure: ShieldCheck,
    arrow: ArrowRight,
  }
  const Icon = map[name as keyof typeof map] ?? Sparkles
  return <Icon className="icon" strokeWidth={2.1} />
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY)
    return saved ? (JSON.parse(saved) as User) : null
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart>({ count: 0, total: 0, items: [] })
  const [flash, setFlash] = useState<FlashState | null>(null)
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    void Promise.all([
      api<{ data: Category[] }>('/categories').then((result) => setCategories(result.data)),
      api<{ data: Product[] }>('/products').then((result) => setProducts(result.data)),
    ]).catch((error: Error) => {
      setFlash({ tone: 'error', text: error.message })
    })
  }, [])

  const refreshCart = async () => {
    if (!token) {
      setCart({ count: 0, total: 0, items: [] })
      return
    }

    try {
      const result = await api<{ data: Cart }>('/cart', { token })
      setCart(result.data)
    } catch (error) {
      setCart({ count: 0, total: 0, items: [] })
    }
  }

  useEffect(() => {
    void refreshCart()
  }, [token])

  const setAuth = (nextToken: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }

  const login = async (
    email: string,
    password: string,
    mode: 'login' | 'register' = 'login',
    name?: string,
  ) => {
    setAuthBusy(true)

    try {
      const payload =
        mode === 'register'
          ? { name, email, password, device_name: 'qodexia-storefront-react' }
          : { email, password, device_name: 'qodexia-storefront-react' }

      const result = await api<{
        data: { token: string; user: User }
        message: string
      }>(mode === 'register' ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setAuth(result.data.token, result.data.user)
      setFlash({ tone: 'success', text: result.message })
      await refreshCart()
    } finally {
      setAuthBusy(false)
    }
  }

  const logout = async () => {
    if (token) {
      try {
        await api('/auth/logout', { method: 'POST', token })
      } catch {
        //
      }
    }

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setCart({ count: 0, total: 0, items: [] })
    setFlash({ tone: 'info', text: 'Sesión cerrada.' })
  }

  const addToCart = async (productId: number, quantity = 1, variantId?: number) => {
    if (!token) {
      throw new Error('Inicia sesión para usar el carrito.')
    }

    const result = await api<{ message: string; data: Cart }>('/cart/items', {
      method: 'POST',
      token,
      body: JSON.stringify({ product_id: productId, quantity, variant_id: variantId }),
    })

    setCart(result.data)
    setFlash({ tone: 'success', text: result.message })
  }

  const updateCartItem = async (key: string, quantity: number) => {
    if (!token) {
      return
    }

    const result = await api<{ data: Cart; message: string }>(`/cart/items/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ quantity }),
    })

    setCart(result.data)
    setFlash({ tone: 'success', text: result.message })
  }

  const removeCartItem = async (key: string) => {
    if (!token) {
      return
    }

    const result = await api<{ data: Cart; message: string }>(`/cart/items/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      token,
    })

    setCart(result.data)
    setFlash({ tone: 'info', text: result.message })
  }

  const clearCart = async () => {
    if (!token) {
      return
    }

    const result = await api<{ data: Cart; message: string }>('/cart', {
      method: 'DELETE',
      token,
    })

    setCart(result.data)
    setFlash({ tone: 'info', text: result.message })
  }

  const state = useMemo<AppState>(
    () => ({
      token,
      user,
      categories,
      products,
      cart,
      flash,
      authBusy,
      setFlash,
      refreshCart,
      addToCart,
      updateCartItem,
      removeCartItem,
      clearCart,
      login,
      logout,
      setAuth,
    }),
    [token, user, categories, products, cart, flash, authBusy],
  )

  return (
    <div className="app-shell">
      <SiteHeader state={state} />
      <main className="main-shell">
        {flash ? (
          <div className={`flash flash--${flash.tone}`}>
            <span>{flash.text}</span>
            <button type="button" onClick={() => setFlash(null)}>
              Cerrar
            </button>
          </div>
        ) : null}

        <Routes>
          <Route path="/" element={<HomePage state={state} />} />
          <Route path="/productos" element={<CatalogPage state={state} />} />
          <Route path="/productos/:slug" element={<ProductPage state={state} />} />
          <Route path="/login" element={<AuthPage state={state} mode="login" />} />
          <Route path="/register" element={<AuthPage state={state} mode="register" />} />
          <Route path="/carrito" element={<CartPage state={state} />} />
          <Route path="/checkout" element={<CheckoutPage state={state} />} />
          <Route path="/perfil" element={<RequireAuth state={state}><AccountPage state={state} /></RequireAuth>} />
          <Route path="/perfil/wishlist" element={<RequireAuth state={state}><WishlistPage state={state} /></RequireAuth>} />
          <Route path="/perfil/ordenes" element={<RequireAuth state={state}><OrdersPage state={state} /></RequireAuth>} />
          <Route path="/perfil/direcciones" element={<RequireAuth state={state}><AddressesPage state={state} /></RequireAuth>} />
          <Route path="/perfil/resenas" element={<RequireAuth state={state}><ReviewsPage state={state} /></RequireAuth>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter state={state} />
    </div>
  )
}

function RequireAuth({ children, state }: { children: ReactNode; state: AppState }) {
  const location = useLocation()

  if (!state.token || !state.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

function SiteHeader({ state }: { state: AppState }) {
  const [open, setOpen] = useState(false)
  const accountHref = state.user ? '/perfil' : '/login'

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="brand" to="/">
          <span className="brand__mark">{icon('bag')}</span>
          <span>Qodexia</span>
        </Link>

        <button className="mobile-toggle" type="button" onClick={() => setOpen((value) => !value)}>
          Menú
        </button>

        <nav className={`site-nav ${open ? 'site-nav--open' : ''}`}>
          <HeaderLink to="/">{icon('home')} Inicio</HeaderLink>
          <HeaderLink to="/productos">{icon('product')} Productos</HeaderLink>
          <HeaderLink to="/carrito">{icon('cart')} Carrito ({state.cart.count})</HeaderLink>
          {state.user ? (
            <>
              <HeaderLink to="/perfil">{icon('user')} Cuenta</HeaderLink>
              <button className="button button--solid button--small" type="button" onClick={() => void state.logout()}>
                {icon('logout')} Salir
              </button>
            </>
          ) : (
            <HeaderLink to="/login">{icon('login')} Acceso</HeaderLink>
          )}
        </nav>
      </div>
      <div className="shell mobile-quick-actions">
        <Link to="/productos">{icon('search')} Buscar</Link>
        <Link to="/carrito">{icon('cart')} Carrito</Link>
        <Link to={accountHref}>{state.user ? `${icon('user')} Perfil` : `${icon('login')} Acceso`}</Link>
      </div>
    </header>
  )
}

function HeaderLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink className={({ isActive }) => `nav-chip ${isActive ? 'nav-chip--active' : ''}`} to={to}>
      {children}
    </NavLink>
  )
}

function SiteFooter({ state }: { state: AppState }) {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-brand">{icon('bag')} Qodexia</p>
          <p className="footer-copy">
            Storefront React conectado a la API productiva de Qodexia para catálogo, carrito,
            checkout y cuenta del cliente.
          </p>
        </div>
        <div>
          <p className="footer-title">Explorar</p>
          <div className="footer-links">
            <Link to="/">Inicio</Link>
            <Link to="/productos">Productos</Link>
            <Link to="/carrito">Carrito ({state.cart.count})</Link>
            {state.user ? <Link to="/perfil">Cuenta</Link> : <Link to="/login">Acceso</Link>}
          </div>
        </div>
        <div>
          <p className="footer-title">Operación</p>
          <div className="footer-links">
            <a href="https://ecommerce.qodexia.site/admin" target="_blank" rel="noreferrer">
              Panel admin
            </a>
            <a href="https://ecommerce.qodexia.site/politicas-y-legales" target="_blank" rel="noreferrer">
              Políticas y legales
            </a>
            <span>API: ecommerce.qodexia.site/api/v1</span>
          </div>
        </div>
      </div>
      <div className="footer-legal">© 2026 Qodexia. Frontend público desplegable como sitio estático.</div>
    </footer>
  )
}

function HomePage({ state }: { state: AppState }) {
  const featured = state.products.filter((product) => product.featured).slice(0, 4)
  const heroProducts = featured.slice(0, 2)
  const leadCategories = state.categories.slice(0, 3)
  const operationalHighlights = [
    {
      title: 'Checkout claro',
      description: 'Resumen limpio, cálculo de envío, cupón y compra por transferencia.',
      iconName: 'secure',
    },
    {
      title: 'Entrega utilitaria',
      description: 'Carrito, direcciones y órdenes conectados al backend en producción.',
      iconName: 'delivery',
    },
    {
      title: 'Catálogo vivo',
      description: 'Productos, categorías y detalle sincronizados con la API pública.',
      iconName: 'speed',
    },
  ] as const

  return (
    <div className="shell page-stack">
      <section className="hero-panel">
        <div className="hero-layout">
          <div className="hero-copy">
            <span className="eyebrow">Qodexia storefront</span>
            <h1>Tecnología curada con una experiencia sobria, rápida y comercial.</h1>
            <p>
              Un frente de tienda minimal tech premium para explorar catálogo, comparar productos
              y cerrar compra sin ruido visual ni bloques inflados.
            </p>
            <div className="hero-actions">
              <Link className="button button--solid" to="/productos#productos">
                Explorar catálogo {icon('arrow')}
              </Link>
              {state.user ? (
                <Link className="button button--success" to="/productos">
                  Continuar comprando
                </Link>
              ) : (
                <Link className="button button--ghost" to="/login">
                  Entrar a mi cuenta
                </Link>
              )}
            </div>
            <div className="hero-stats">
              <article>
                <strong>{state.products.length}</strong>
                <span>productos activos</span>
              </article>
              <article>
                <strong>{state.categories.length}</strong>
                <span>categorías</span>
              </article>
              <article>
                <strong>24/7</strong>
                <span>operación online</span>
              </article>
            </div>
          </div>

          <div className="hero-showcase">
            {heroProducts.map((product) => (
              <article className="hero-product" key={product.id}>
                <div className="hero-product__media">
                  <img alt={product.name} src={absoluteImageUrl(product.image_url)} />
                </div>
                <div className="hero-product__body">
                  <span className="pill">{product.categories[0]?.name ?? 'General'}</span>
                  <h3>{product.name}</h3>
                  <p>{truncate(product.short_description || product.description, 76)}</p>
                  <div className="hero-product__meta">
                    <strong>{money(product.effective_price)}</strong>
                    <Link to={`/productos/${product.slug}`}>Ver detalle</Link>
                  </div>
                </div>
              </article>
            ))}

            <div className="hero-note">
              <span>{icon('star')}</span>
              <div>
                <strong>Stack estable</strong>
                <p>React + Vite + Router + API Laravel, desplegado como estático detrás de Nginx.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="service-grid">
        {operationalHighlights.map((item) => (
          <article className="service-card" key={item.title}>
            <span className="service-card__icon">{icon(item.iconName)}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section id="productos" className="page-stack">
        <SectionTitle
          title="Productos destacados"
          subtitle="Una primera selección con mejor densidad, jerarquía y lectura comercial."
        />
        <div className="product-grid product-grid--featured">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <div>
          <Link className="button button--outline" to="/productos">
            Ver todos los productos
          </Link>
        </div>
      </section>

      <section className="page-stack">
        <SectionTitle
          title="Categorías"
          subtitle="Entrada rápida al catálogo por familia de producto."
        />
        <div className="category-grid">
          {leadCategories.map((category) => (
            <article className="category-card" key={category.id}>
              <span className="category-card__icon">{icon('bag')}</span>
              <h3>{category.name}</h3>
              <p>{truncate(category.description || 'Colección curada para compra rápida.', 92)}</p>
              <p className="category-card__meta">{category.products_count} producto(s)</p>
              <Link to={`/productos?categoria=${category.slug}`}>Ver categoría</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-panel">
        <div className="editorial-panel__copy">
          <span className="eyebrow">Compra con criterio</span>
          <h2>Menos ornamento, mejor lectura de producto.</h2>
          <p>
            La dirección visual prioriza contraste, escala tipográfica y bloques compactos para que
            catálogo, detalle, carrito y cuenta se sientan parte del mismo sistema.
          </p>
        </div>
        <div className="editorial-panel__list">
          <article>
            <strong>Hero calibrado</strong>
            <p>Menos aire vacío, mejor proporción entre titular, acciones y producto destacado.</p>
          </article>
          <article>
            <strong>Cards compactas</strong>
            <p>Componentes más densos, consistentes y útiles para navegación y conversión.</p>
          </article>
          <article>
            <strong>Footer con peso</strong>
            <p>Cierre más creíble, con contexto operativo real y mejor presencia visual.</p>
          </article>
        </div>
      </section>
    </div>
  )
}

function CatalogPage({ state }: { state: AppState }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const categoryFilter = params.get('categoria') ?? ''
  const [search, setSearch] = useState(params.get('q') ?? '')

  const filtered = useMemo(() => {
    return state.products.filter((product) => {
      const matchesCategory =
        categoryFilter === '' ||
        product.categories.some((category) => category.slug === categoryFilter)
      const matchesSearch =
        search.trim() === '' ||
        `${product.name} ${product.description} ${product.short_description}`
          .toLowerCase()
          .includes(search.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }, [state.products, categoryFilter, search])

  const activeCategory = state.categories.find((category) => category.slug === categoryFilter)

  return (
    <div className="shell page-stack">
      <section className="hero-panel hero-panel--compact">
        <h1>{activeCategory ? activeCategory.name : 'Catálogo de productos'}</h1>
        <p>
          {activeCategory
            ? activeCategory.description
            : 'Encuentra el producto ideal con una lectura más precisa, filtros claros y cards mejor proporcionadas.'}
        </p>

        <div className="catalog-toolbar catalog-toolbar--search">
          <input
            className="input"
            placeholder="Buscar por producto, descripción o categoría..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Link className="button button--ghost" to="/productos">
            Limpiar
          </Link>
        </div>
        <p className="muted-copy muted-copy--top">
          {search.trim() !== ''
            ? `Resultados para "${search}": ${filtered.length} producto(s).`
            : `Mostrando ${filtered.length} de ${state.products.length} producto(s).`}
        </p>
      </section>

      <div className="catalog-layout">
        <aside className="sidebar-card">
          <p className="sidebar-card__title">Categorías</p>
          <Link className={categoryFilter === '' ? 'side-link side-link--active' : 'side-link'} to="/productos">
            Todas
          </Link>
          {state.categories.map((category) => (
            <Link
              className={category.slug === categoryFilter ? 'side-link side-link--active' : 'side-link'}
              key={category.id}
              to={`/productos?categoria=${category.slug}`}
            >
              <span>{category.name}</span>
              <span>{category.products_count}</span>
            </Link>
          ))}
        </aside>

        <div className="page-stack">
          <div className="product-grid product-grid--catalog">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductPage({ state }: { state: AppState }) {
  const params = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const product = state.products.find((entry) => entry.slug === params.slug)
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined)

  useEffect(() => {
    setSelectedVariantId(undefined)
  }, [product?.id])

  if (!product) {
    return <NotFoundPage />
  }

  const variant = product.variants.find((entry) => entry.id === selectedVariantId)
  const effectivePrice = variant?.effective_price ?? product.effective_price
  const activeStock = variant?.stock ?? product.stock

  const handleAdd = async () => {
    setLoading(true)

    try {
      await state.addToCart(product.id, 1, selectedVariantId)
      navigate('/carrito')
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
      if ((error as Error).message.includes('Inicia sesión')) {
        navigate('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shell page-stack">
      <nav className="breadcrumb">
        <Link to="/">Inicio</Link>
        <span>/</span>
        <Link to="/productos">Productos</Link>
        {product.categories[0] ? (
          <>
            <span>/</span>
            <Link to={`/productos?categoria=${product.categories[0].slug}`}>{product.categories[0].name}</Link>
          </>
        ) : null}
        <span>/</span>
        <span>{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-visual">
          <img alt={product.name} src={absoluteImageUrl(product.image_url)} />
        </div>
        <div className="product-summary">
          <div className="pill-row">
            {product.categories.map((category) => (
              <span className="pill" key={category.id}>
                Categoría: {category.name}
              </span>
            ))}
            <span className={product.stock > 0 ? 'availability availability--ok' : 'availability availability--off'}>
              {product.stock > 0 ? 'Disponible' : 'Próximamente'}
            </span>
          </div>
          <h1>{product.name}</h1>
          <p className="lead-copy">{product.short_description || product.description}</p>

          <div className="rating-card">
            <div>
              <p className="rating-value">Nuevo</p>
              <p className="rating-copy">Aún sin reseñas publicadas</p>
            </div>
            <a className="button button--outline button--small" href="#detalle-producto">
              Ver detalle
            </a>
          </div>

          <div className="price-block">
            <p className="price-label">Precio base</p>
            {product.compare_at_price && product.compare_at_price > effectivePrice ? (
              <p className="price-strikethrough">Antes {money(product.compare_at_price)}</p>
            ) : null}
            <p className="price-current">{money(effectivePrice)}</p>
            <p className={activeStock > 0 ? 'stock stock--ok' : 'stock stock--off'}>
              {activeStock > 0 ? `${activeStock} pieza(s) disponibles` : 'Sin stock'}
            </p>
          </div>

          {product.variants.length > 0 ? (
            <div className="variant-box">
              <p className="sidebar-card__title">Variantes</p>
              <div className="variant-grid">
                {product.variants.map((entry) => (
                  <button
                    className={entry.id === selectedVariantId ? 'variant-chip variant-chip--active' : 'variant-chip'}
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedVariantId(entry.id)}
                  >
                    <strong>{entry.title}</strong>
                    <span>{money(entry.effective_price)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="action-row">
            <button
              className="button button--solid"
              disabled={activeStock <= 0 || loading}
              type="button"
              onClick={() => void handleAdd()}
            >
              {loading ? 'Agregando...' : 'Agregar al carrito'}
            </button>
            <ProductWishlistButton productId={product.id} state={state} />
          </div>
        </div>
      </div>

      <section className="section-shell product-description" id="detalle-producto">
        <SectionTitle title="Detalle del producto" subtitle="Información conectada a la API ya desplegada." />
        <p>{product.description || product.short_description}</p>
      </section>
    </div>
  )
}

function ProductWishlistButton({ productId, state }: { productId: number; state: AppState }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const handleToggle = async () => {
    if (!state.token) {
      navigate('/login')
      return
    }

    setBusy(true)

    try {
      const result = await api<{ message: string }>(`/wishlist/items/${productId}/toggle`, {
        method: 'POST',
        token: state.token,
      })
      state.setFlash({ tone: 'success', text: result.message })
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className="button button--danger-soft" disabled={busy} type="button" onClick={() => void handleToggle()}>
      {icon('heart')} Lista de deseos
    </button>
  )
}

function AuthPage({ state, mode }: { state: AppState; mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [name, setName] = useState('')
  const [email, setEmail] = useState(mode === 'login' ? 'cliente@nexostore.local' : '')
  const [password, setPassword] = useState(mode === 'login' ? 'Cliente123!' : '')

  if (state.user) {
    return <Navigate to="/perfil" replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    try {
      await state.login(email, password, mode, name)
      navigate(location.state?.from ?? '/perfil', { replace: true })
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
    }
  }

  return (
    <div className="shell auth-shell">
      <section className="auth-card">
        <h1>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
        <p>
          {mode === 'login'
            ? 'Usa tu cuenta para carrito, órdenes, wishlist y checkout.'
            : 'Registro directo contra la API v1 con token Sanctum.'}
        </p>

        <form className="form-grid" onSubmit={submit}>
          {mode === 'register' ? (
            <label>
              Nombre
              <input className="input" required value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          ) : null}

          <label>
            Email
            <input
              className="input"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Password
            <input
              className="input"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button className="button button--solid" disabled={state.authBusy} type="submit">
            {state.authBusy ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="muted-copy">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <Link to={mode === 'login' ? '/register' : '/login'}>
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </Link>
        </p>
      </section>
    </div>
  )
}

function CartPage({ state }: { state: AppState }) {
  const navigate = useNavigate()

  if (!state.user) {
    return (
      <div className="shell page-stack">
        <EmptyState
          actionLabel="Ir a login"
          actionTo="/login"
          description="La API del carrito trabaja con usuarios autenticados."
          title="Inicia sesión para usar el carrito."
        />
      </div>
    )
  }

  return (
    <div className="shell page-stack">
      <SectionTitle
        title={`Tu carrito (${state.cart.count})`}
        subtitle="Administra cantidades y prepara tu compra por transferencia."
      />

      {state.cart.items.length === 0 ? (
        <EmptyState
          actionLabel="Explorar productos"
          actionTo="/productos"
          description="Cuando agregues productos, aquí verás el resumen listo para checkout."
          title="Tu carrito está vacío."
        />
      ) : (
        <div className="cart-layout">
          <div className="page-stack">
            {state.cart.items.map((item) => (
              <article className="cart-card" key={item.key}>
                <img alt={item.product.name} className="cart-card__image" src={absoluteImageUrl(item.product.image_url)} />
                <div className="cart-card__body">
                  <div className="cart-card__header">
                    <div>
                      <h3>{item.product.name}</h3>
                      {item.variant ? <p className="muted-copy">{item.variant.title}</p> : null}
                    </div>
                    <strong>{money(item.price)}</strong>
                  </div>
                  <div className="cart-card__actions">
                    <label>
                      Cantidad
                      <input
                        className="input input--small"
                        min={1}
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          void state.updateCartItem(item.key, Math.max(1, Number(event.target.value) || 1))
                        }
                      />
                    </label>
                    <button className="button button--ghost" type="button" onClick={() => void state.removeCartItem(item.key)}>
                      Eliminar
                    </button>
                    <Link className="button button--ghost" to={`/productos/${item.product.slug}`}>
                      Ver detalle
                    </Link>
                  </div>
                  <p className="cart-card__subtotal">Subtotal: {money(item.line_total)}</p>
                </div>
              </article>
            ))}
          </div>

          <aside className="summary-card">
            <h3>Resumen</h3>
            <dl className="summary-lines">
              <div><dt>Productos</dt><dd>{state.cart.count}</dd></div>
              <div><dt>Total</dt><dd>{money(state.cart.total)}</dd></div>
            </dl>
            <strong>{money(state.cart.total)}</strong>
            <button className="button button--solid" type="button" onClick={() => navigate('/checkout')}>
              Ir a checkout
            </button>
            <button className="button button--ghost" type="button" onClick={() => void state.clearCart()}>
              Vaciar carrito
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}

function CheckoutPage({ state }: { state: AppState }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<CheckoutSummary | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [form, setForm] = useState({
    shipping_state: 'CDMX',
    shipping_method_id: '',
    shipping_address_id: '',
    billing_full_name: state.user?.name ?? '',
    billing_email: state.user?.email ?? '',
    billing_phone: '',
    billing_address: '',
    billing_district: '',
    billing_city: '',
    billing_postal_code: '',
    billing_notes: '',
    save_shipping_address: true,
    shipping_address_label: 'Nueva dirección',
  })

  useEffect(() => {
    if (!state.token || !state.user) {
      return
    }

    const load = async () => {
      setLoading(true)

      try {
        const [addressResult, summaryResult] = await Promise.all([
          api<{ data: Address[] }>('/addresses', { token: state.token }),
          api<{ data: CheckoutSummary }>(`/checkout/summary?shipping_state=${form.shipping_state}`, {
            token: state.token,
          }),
        ])

        setAddresses(addressResult.data)
        setSummary(summaryResult.data)
        setForm((current) => ({
          ...current,
          shipping_method_id:
            current.shipping_method_id || summaryResult.data.selected_shipping_method_id || '',
        }))

        const defaultAddress = addressResult.data.find((entry) => entry.is_default)
        if (defaultAddress) {
          hydrateAddress(defaultAddress)
        }
      } catch (error) {
        state.setFlash({ tone: 'error', text: (error as Error).message })
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [state.token, state.user])

  if (!state.user || !state.token) {
    return <Navigate to="/login" replace />
  }

  const hydrateAddress = (address: Address) => {
    setForm((current) => ({
      ...current,
      shipping_address_id: String(address.id),
      billing_full_name: address.recipient_name,
      billing_phone: address.phone,
      billing_address: address.line1,
      billing_district: address.line2 ?? '',
      billing_city: address.city,
      billing_postal_code: address.postal_code,
      shipping_state: address.state,
      billing_notes: address.references ?? '',
      shipping_address_label: address.label,
    }))
  }

  const refreshSummary = async (shippingState = form.shipping_state, shippingMethodId = form.shipping_method_id, nextCoupon = couponCode) => {
    const query = new URLSearchParams()
    query.set('shipping_state', shippingState)
    if (shippingMethodId) {
      query.set('shipping_method_id', shippingMethodId)
    }
    if (nextCoupon.trim() !== '') {
      query.set('coupon_code', nextCoupon.trim())
    }

    const result = await api<{ data: CheckoutSummary }>(`/checkout/summary?${query.toString()}`, {
      token: state.token,
    })
    setSummary(result.data)
  }

  const quoteShipping = async () => {
    try {
      const result = await api<{ data: { methods: ShippingMethod[]; selected_shipping_method_id: string | null; shipping_cost: number } }>(
        '/checkout/shipping-quote',
        {
          method: 'POST',
          token: state.token,
          body: JSON.stringify({
            shipping_state: form.shipping_state,
            shipping_method_id: form.shipping_method_id,
          }),
        },
      )

      setSummary((current) =>
        current
          ? {
              ...current,
              shipping_methods: result.data.methods,
              selected_shipping_method_id: result.data.selected_shipping_method_id,
              shipping_cost: result.data.shipping_cost,
            }
          : current,
      )

      if (result.data.selected_shipping_method_id) {
        setForm((current) => ({
          ...current,
          shipping_method_id: result.data.selected_shipping_method_id ?? '',
        }))
      }

      await refreshSummary(form.shipping_state, result.data.selected_shipping_method_id ?? form.shipping_method_id)
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
    }
  }

  const applyCoupon = async () => {
    try {
      await api('/checkout/coupon-quote', {
        method: 'POST',
        token: state.token,
        body: JSON.stringify({ coupon_code: couponCode }),
      })
      await refreshSummary(form.shipping_state, form.shipping_method_id, couponCode)
      state.setFlash({ tone: 'success', text: 'Cupón actualizado.' })
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      const result = await api<{ message: string; data: Order }>('/checkout/purchase-transfer', {
        method: 'POST',
        token: state.token,
        body: JSON.stringify({
          ...form,
          coupon_code: couponCode,
          save_shipping_address: form.save_shipping_address,
          shipping_address_id: form.shipping_address_id ? Number(form.shipping_address_id) : 0,
        }),
      })

      state.setFlash({ tone: 'success', text: `${result.message} Pedido ${result.data.code}.` })
      await state.refreshCart()
      navigate('/perfil/ordenes')
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="shell page-stack">
      <SectionTitle
        title="Checkout"
        subtitle="Compra por transferencia conectada al backend productivo."
      />

      {loading || !summary ? (
        <p className="muted-copy">Cargando resumen de compra...</p>
      ) : (
        <div className="cart-layout">
          <form className="checkout-card" onSubmit={submit}>
            <div className="form-columns">
              <label>
                Dirección guardada
                <select
                  className="input"
                  value={form.shipping_address_id}
                  onChange={(event) => {
                    const value = event.target.value
                    const selected = addresses.find((address) => String(address.id) === value)
                    if (selected) {
                      hydrateAddress(selected)
                    } else {
                      setForm((current) => ({ ...current, shipping_address_id: '' }))
                    }
                  }}
                >
                  <option value="">Usar nueva dirección</option>
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} · {address.city}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Estado de envío
                <input
                  className="input"
                  value={form.shipping_state}
                  onChange={(event) => setForm((current) => ({ ...current, shipping_state: event.target.value.toUpperCase() }))}
                />
              </label>

              <label>
                Método de envío
                <select
                  className="input"
                  value={form.shipping_method_id}
                  onChange={(event) => setForm((current) => ({ ...current, shipping_method_id: event.target.value }))}
                >
                  <option value="">Selecciona</option>
                  {summary.shipping_methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} · {money(method.computed_cost)}
                    </option>
                  ))}
                </select>
              </label>

              <button className="button button--ghost" type="button" onClick={() => void quoteShipping()}>
                Recalcular envío
              </button>
            </div>

            <div className="form-columns">
              <label>
                Nombre completo
                <input className="input" required value={form.billing_full_name} onChange={(event) => setForm((current) => ({ ...current, billing_full_name: event.target.value }))} />
              </label>
              <label>
                Email
                <input className="input" required type="email" value={form.billing_email} onChange={(event) => setForm((current) => ({ ...current, billing_email: event.target.value }))} />
              </label>
              <label>
                Teléfono
                <input className="input" required value={form.billing_phone} onChange={(event) => setForm((current) => ({ ...current, billing_phone: event.target.value }))} />
              </label>
              <label>
                Dirección
                <input className="input" required value={form.billing_address} onChange={(event) => setForm((current) => ({ ...current, billing_address: event.target.value }))} />
              </label>
              <label>
                Colonia
                <input className="input" required value={form.billing_district} onChange={(event) => setForm((current) => ({ ...current, billing_district: event.target.value }))} />
              </label>
              <label>
                Ciudad
                <input className="input" required value={form.billing_city} onChange={(event) => setForm((current) => ({ ...current, billing_city: event.target.value }))} />
              </label>
              <label>
                Código postal
                <input className="input" required value={form.billing_postal_code} onChange={(event) => setForm((current) => ({ ...current, billing_postal_code: event.target.value }))} />
              </label>
              <label>
                Etiqueta de dirección
                <input className="input" value={form.shipping_address_label} onChange={(event) => setForm((current) => ({ ...current, shipping_address_label: event.target.value }))} />
              </label>
            </div>

            <label>
              Notas
              <textarea className="input input--textarea" value={form.billing_notes} onChange={(event) => setForm((current) => ({ ...current, billing_notes: event.target.value }))} />
            </label>

            <label className="checkbox">
              <input
                checked={form.save_shipping_address}
                type="checkbox"
                onChange={(event) => setForm((current) => ({ ...current, save_shipping_address: event.target.checked }))}
              />
              Guardar dirección
            </label>

            <div className="coupon-row">
              <input
                className="input"
                placeholder="Cupón"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
              />
              <button className="button button--ghost" type="button" onClick={() => void applyCoupon()}>
                Aplicar cupón
              </button>
            </div>

            <button className="button button--solid" disabled={submitting} type="submit">
              {submitting ? 'Procesando compra...' : 'Completar compra'}
            </button>
          </form>

          <aside className="summary-card">
            <h3>Resumen</h3>
            <dl className="summary-lines">
              <div><dt>Items</dt><dd>{summary.items_count}</dd></div>
              <div><dt>Subtotal</dt><dd>{money(summary.subtotal)}</dd></div>
              <div><dt>Envío</dt><dd>{money(summary.shipping_cost)}</dd></div>
              <div><dt>Descuento</dt><dd>{money(summary.coupon_discount)}</dd></div>
              <div><dt>IVA</dt><dd>{money(summary.tax_amount)}</dd></div>
            </dl>
            <strong>{money(summary.total)}</strong>
          </aside>
        </div>
      )}
    </div>
  )
}

function AccountPage({ state }: { state: AppState }) {
  return (
    <div className="shell page-stack">
      <SectionTitle title={`Hola, ${state.user?.name ?? ''}`} subtitle="Tu cuenta conectada al backend productivo." />
      <div className="account-grid">
        <AccountLink to="/perfil/ordenes" title="Órdenes" subtitle="Historial, totales y detalle por compra." />
        <AccountLink to="/perfil/wishlist" title="Wishlist" subtitle="Productos guardados para volver luego." />
        <AccountLink to="/perfil/direcciones" title="Direcciones" subtitle="Entrega y datos de envío guardados." />
        <AccountLink to="/perfil/resenas" title="Reseñas" subtitle="Tus opiniones publicadas en la tienda." />
      </div>
    </div>
  )
}

function AccountLink({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link className="account-card" to={to}>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </Link>
  )
}

function WishlistPage({ state }: { state: AppState }) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const result = await api<{ data: WishlistItem[] }>('/wishlist', { token: state.token })
        setItems(result.data)
      } catch (error) {
        state.setFlash({ tone: 'error', text: (error as Error).message })
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [state.token])

  if (loading) {
    return <div className="shell"><p className="muted-copy">Cargando wishlist...</p></div>
  }

  return (
    <div className="shell page-stack">
      <SectionTitle title="Wishlist" subtitle="Productos guardados desde la cuenta del cliente." />
      {items.length === 0 ? (
        <EmptyState actionLabel="Ir a catálogo" actionTo="/productos" description="Todavía no has agregado productos." title="Wishlist vacía." />
      ) : (
        <div className="product-grid">
          {items.map((item) => (
            <ProductCard key={item.id} product={item.product} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrdersPage({ state }: { state: AppState }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api<{ data: Order[] }>('/orders', { token: state.token })
        setOrders(result.data)
      } catch (error) {
        state.setFlash({ tone: 'error', text: (error as Error).message })
      }
    }

    void load()
  }, [state.token])

  const loadOrder = async (id: number) => {
    try {
      const result = await api<{ data: Order }>(`/orders/${id}`, { token: state.token })
      setSelectedOrder(result.data)
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
    }
  }

  return (
    <div className="shell page-stack">
      <SectionTitle title="Órdenes" subtitle="Historial completo del cliente autenticado." />
      <div className="orders-layout">
        <div className="page-stack">
          {orders.map((order) => (
            <button className="order-card" key={order.id} type="button" onClick={() => void loadOrder(order.id)}>
              <div>
                <h3>{order.code}</h3>
                <p>{order.payment_status_label}</p>
              </div>
              <strong>{money(order.total)}</strong>
            </button>
          ))}
        </div>

        <aside className="summary-card">
          {selectedOrder ? (
            <>
              <h3>{selectedOrder.code}</h3>
              <p>{selectedOrder.payment_method_label}</p>
              <p className="muted-copy">{selectedOrder.shipping.method_name}</p>
              <p className="muted-copy">
                {selectedOrder.shipping.recipient_name} · {selectedOrder.shipping.city}
              </p>
              <strong>{money(selectedOrder.total)}</strong>
              {selectedOrder.items?.map((item) => (
                <div className="line-item" key={item.id}>
                  <span>{item.product_name} x {item.quantity}</span>
                  <span>{money(item.line_total)}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <h3>Detalle</h3>
              <p className="muted-copy">Selecciona un pedido para ver sus líneas y datos de envío.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function AddressesPage({ state }: { state: AppState }) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [form, setForm] = useState({
    label: 'Casa',
    recipient_name: state.user?.name ?? '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: 'CDMX',
    postal_code: '',
    country: 'MX',
    references: '',
    is_default: true,
  })

  const load = async () => {
    const result = await api<{ data: Address[] }>('/addresses', { token: state.token })
    setAddresses(result.data)
  }

  useEffect(() => {
    void load().catch((error: Error) => state.setFlash({ tone: 'error', text: error.message }))
  }, [state.token])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api('/addresses', {
        method: 'POST',
        token: state.token,
        body: JSON.stringify(form),
      })
      await load()
      state.setFlash({ tone: 'success', text: 'Dirección guardada.' })
    } catch (error) {
      state.setFlash({ tone: 'error', text: (error as Error).message })
    }
  }

  return (
    <div className="shell page-stack">
      <SectionTitle title="Direcciones" subtitle="Alta rápida de direcciones desde la SPA." />
      <div className="orders-layout">
        <div className="page-stack">
          {addresses.map((address) => (
            <article className="account-card" key={address.id}>
              <h3>{address.label}</h3>
              <p>{address.full_address}</p>
              {address.is_default ? <span className="pill">Predeterminada</span> : null}
            </article>
          ))}
        </div>
        <form className="checkout-card" onSubmit={submit}>
          <div className="form-columns">
            <label>
              Etiqueta
              <input className="input" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} />
            </label>
            <label>
              Destinatario
              <input className="input" value={form.recipient_name} onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))} />
            </label>
            <label>
              Teléfono
              <input className="input" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label>
              Dirección
              <input className="input" value={form.line1} onChange={(event) => setForm((current) => ({ ...current, line1: event.target.value }))} />
            </label>
            <label>
              Línea 2
              <input className="input" value={form.line2} onChange={(event) => setForm((current) => ({ ...current, line2: event.target.value }))} />
            </label>
            <label>
              Ciudad
              <input className="input" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
            </label>
            <label>
              Estado
              <input className="input" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} />
            </label>
            <label>
              CP
              <input className="input" value={form.postal_code} onChange={(event) => setForm((current) => ({ ...current, postal_code: event.target.value }))} />
            </label>
          </div>
          <button className="button button--solid" type="submit">Guardar dirección</button>
        </form>
      </div>
    </div>
  )
}

function ReviewsPage({ state }: { state: AppState }) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const result = await api<{ data: unknown[] }>('/reviews', { token: state.token })
      setCount(result.data.length)
    }

    void load().catch((error: Error) => state.setFlash({ tone: 'error', text: error.message }))
  }, [state.token])

  return (
    <div className="shell page-stack">
      <SectionTitle title="Reseñas" subtitle="Lectura de tus reseñas personales desde la API." />
      <article className="account-card">
        <h3>Total de reseñas</h3>
        <p>{count ?? 0}</p>
      </article>
    </div>
  )
}

function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const category = product.categories[0]?.name ?? 'General'
  const discount =
    product.compare_at_price && product.compare_at_price > product.effective_price
      ? Math.round(((product.compare_at_price - product.effective_price) / product.compare_at_price) * 100)
      : 0

  return (
    <article className={`product-card ${compact ? 'product-card--compact' : ''}`}>
      <Link className="product-card__media" to={`/productos/${product.slug}`}>
        {discount > 0 ? <span className="badge">-{discount}%</span> : null}
        <img alt={product.name} src={absoluteImageUrl(product.image_url)} />
      </Link>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span className="pill">{category}</span>
          <span className={product.stock > 0 ? 'stock stock--ok' : 'stock stock--off'}>
            {product.stock > 0 ? `Stock ${product.stock}` : 'Sin stock'}
          </span>
        </div>
        <h3>{product.name}</h3>
        <p>{truncate(product.description || product.short_description, compact ? 92 : 120)}</p>
        <div className="price-stack">
          {product.compare_at_price && product.compare_at_price > product.effective_price ? (
            <span className="price-strikethrough">{money(product.compare_at_price)}</span>
          ) : null}
          <strong>{money(product.effective_price)}</strong>
        </div>
        <Link className="button button--ghost button--block" to={`/productos/${product.slug}`}>
          Ver detalle
        </Link>
      </div>
    </article>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  )
}

function EmptyState({
  title,
  description,
  actionTo,
  actionLabel,
}: {
  title: string
  description: string
  actionTo: string
  actionLabel: string
}) {
  return (
    <section className="empty-panel">
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button button--solid" to={actionTo}>
        {actionLabel}
      </Link>
    </section>
  )
}

function NotFoundPage() {
  return (
    <div className="shell page-stack">
      <EmptyState
        actionLabel="Volver al inicio"
        actionTo="/"
        description="La ruta que buscas no existe en este storefront."
        title="Página no encontrada."
      />
    </div>
  )
}

function truncate(value: string, size: number) {
  return value.length <= size ? value : `${value.slice(0, size).trim()}...`
}

function absoluteImageUrl(path: string) {
  return path.startsWith('http') ? path : `https://ecommerce.qodexia.site${path}`
}

export default App
