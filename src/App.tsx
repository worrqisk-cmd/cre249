import { useCallback, useEffect, useRef, useState } from 'react'
import Catalog, { type CatalogState } from './components/Catalog'
import Header from './components/Header'
import Home, { Contacts } from './components/Home'
import ProductDialog from './components/ProductDialog'
import { CATEGORIES, type CategoryId, PRODUCTS, type Product } from './data'
import { prefersReduced, useHash } from './hooks'

// Маршруты (hash — для статического хостинга): #/  #/catalog  #/catalog/<категория>  #/item/<slug>
type Route = { view: 'home' | 'catalog'; category?: CategoryId; item?: string }
const parse = (h: string): Route => {
  const [, a, b] = h.replace(/^#/, '').split('/')
  if (a === 'catalog') return { view: 'catalog', category: CATEGORIES.some((c) => c.id === b) ? (b as CategoryId) : 'all' }
  if (a === 'item' && b) return { view: 'catalog', item: b }
  return { view: 'home' }
}

const introSeen = sessionStorage.getItem('intro-seen') === '1'
sessionStorage.setItem('intro-seen', '1')

export default function App() {
  const hash = useHash()
  const route = parse(hash)
  const [base, setBase] = useState<'home' | 'catalog'>(route.view)
  const [category, setCategory] = useState<CategoryId>(route.category ?? 'all')
  const [catState, setCatState] = useState<CatalogState>('ok')
  const [demoState, setDemoState] = useState<CatalogState>('ok')
  const [shown, setShown] = useState<{ product: Product | null; missing: boolean } | null>(null)
  const [closing, setClosing] = useState(false)
  const origin = useRef<HTMLElement | null>(null)
  const pushedItem = useRef(false)

  // Синхронизация с адресом
  useEffect(() => {
    if (route.item) {
      const p = PRODUCTS.find((x) => x.slug === route.item && !x.hidden) ?? null
      setShown({ product: p, missing: !p })
      setClosing(false)
    } else {
      if (route.view !== base) {
        setBase(route.view)
        window.scrollTo({ top: 0 })
      }
      if (route.category) setCategory(route.category)
      if (shown) setClosing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  useEffect(() => {
    document.body.style.overflow = shown ? 'hidden' : ''
  }, [shown])

  const loadCatalog = useCallback((target: CatalogState) => {
    setCatState('loading')
    const t = setTimeout(() => setCatState(target), 700)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { if (base === 'catalog') return loadCatalog(demoState) }, [base, demoState, loadCatalog])

  const goCatalog = (c: CategoryId = category) => { window.location.hash = c === 'all' ? '#/catalog' : `#/catalog/${c}` }
  const onCategory = (c: CategoryId) => {
    setCategory(c)
    history.replaceState(null, '', c === 'all' ? '#/catalog' : `#/catalog/${c}`)
  }

  const open = (p: Product, el: HTMLElement) => {
    origin.current = el
    pushedItem.current = true
    window.location.hash = `#/item/${p.slug}`
  }
  const requestClose = useCallback(() => {
    if (closing) return
    if (pushedItem.current) { pushedItem.current = false; history.back() }
    else {
      history.replaceState(null, '', base === 'catalog' ? '#/catalog' : '#/')
      setClosing(true)
    }
  }, [closing, base])
  const onClosed = () => {
    setShown(null)
    setClosing(false)
    origin.current?.focus({ preventScroll: true })
  }

  const scrollToId = (id: string) => {
    const go = () => document.getElementById(id)?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth' })
    if (base === 'home' || id === 'contacts') go()
    else { window.location.hash = '#/'; setTimeout(go, 80) }
  }
  const onNav = (to: 'home' | 'catalog' | 'about' | 'order' | 'contacts') => {
    if (to === 'home') { window.location.hash = '#/'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
    else if (to === 'catalog') goCatalog()
    else scrollToId(to)
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-paper focus:px-4 focus:py-2">
        К содержанию
      </a>
      <Header view={base} onNav={onNav} />
      <main id="main" key={base} className={introSeen || base !== 'home' ? 'page-in' : ''}>
        {base === 'home' ? (
          <Home intro={!introSeen} onOpen={open} onCatalog={() => goCatalog('all')} />
        ) : (
          <Catalog category={category} onCategory={onCategory} state={catState} onRetry={() => loadCatalog('ok')} onOpen={open} />
        )}
      </main>
      <Contacts onCatalog={() => goCatalog('all')} />

      {shown && (
        <ProductDialog
          key={shown.product?.slug ?? 'missing'}
          product={shown.product}
          missing={shown.missing}
          closing={closing}
          origin={origin.current}
          onRequestClose={requestClose}
          onClosed={onClosed}
          onCatalog={() => { pushedItem.current = false; history.replaceState(null, '', '#/catalog'); setBase('catalog'); setClosing(true) }}
        />
      )}

      <PrototypePanel state={demoState} setState={(s) => { setDemoState(s); goCatalog() }} />
    </>
  )
}

/** Служебная панель прототипа — не часть публичного интерфейса */
function PrototypePanel({ state, setState }: { state: CatalogState; setState: (s: CatalogState) => void }) {
  const [open, setOpen] = useState(false)
  const opts: [CatalogState, string][] = [['ok', 'Норма'], ['loading', 'Загрузка'], ['empty', 'Пусто'], ['error', 'Ошибка']]
  return (
    <div className="fixed bottom-4 left-4 z-30 font-mono text-xs">
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-line bg-paper p-4 shadow-lg">
          <p className="label mb-2 text-cocoa-soft">Прототип · состояние каталога</p>
          <div className="grid grid-cols-2 gap-1.5">
            {opts.map(([id, l]) => (
              <button key={id} onClick={() => setState(id)} aria-pressed={state === id}
                className={`rounded-md border px-2 py-2 ${state === id ? 'border-cocoa bg-cocoa text-paper' : 'border-line'}`}>{l}</button>
            ))}
          </div>
          <p className="label mb-2 mt-4 text-cocoa-soft">Прямые ссылки</p>
          <a className="block py-1 underline" href="#/item/milka">#/item/milka</a>
          <a className="block py-1 underline" href="#/item/pechenochny">Скрытое изделие</a>
          <p className="mt-3 leading-relaxed text-cocoa-soft">Цены — из прайса 02.12.2025, требуют подтверждения. Контакт из архива канала.</p>
        </div>
      )}
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="rounded-full border border-line bg-paper/90 px-3 py-2 text-cocoa-soft shadow-sm backdrop-blur hover:text-cocoa">
        {open ? 'Скрыть' : 'Прототип'}
      </button>
    </div>
  )
}
