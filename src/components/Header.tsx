import { useState } from 'react'
import { CONTACT, waLink } from '../data'

type Props = { view: 'home' | 'catalog'; onNav: (to: 'home' | 'catalog' | 'about' | 'order' | 'contacts') => void }

export default function Header({ view, onNav }: Props) {
  const [open, setOpen] = useState(false)
  const go = (to: Parameters<Props['onNav']>[0]) => { setOpen(false); onNav(to) }
  const links = [
    { id: 'catalog', label: 'Каталог' },
    { id: 'about', label: 'О Милане' },
    { id: 'order', label: 'Как заказать' },
    { id: 'contacts', label: 'Контакты' },
  ] as const
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-5 md:h-[72px] md:px-10">
        <button onClick={() => go('home')} className="flex items-baseline gap-2 text-left" aria-label="На главную">
          <span className="font-display text-xl leading-none md:text-2xl">Выпечка у Миланы</span>
          <span className="hidden font-hand text-lg text-berry sm:inline">Москва</span>
        </button>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              aria-current={l.id === 'catalog' && view === 'catalog' ? 'page' : undefined}
              className="relative rounded-full px-4 py-2 text-[0.95rem] transition-colors duration-150 hover:bg-kraft/60 aria-[current=page]:text-berry"
            >
              {l.label}
            </button>
          ))}
          <a href={waLink()} target="_blank" rel="noreferrer" className="btn btn-ghost ml-3 !min-h-10 !px-4 text-sm">
            WhatsApp
          </a>
        </nav>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
        >
          <span className="relative block h-3 w-6">
            <span className={`absolute left-0 h-[1.5px] w-6 bg-cocoa transition-transform duration-200 ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
            <span className={`absolute left-0 h-[1.5px] w-6 bg-cocoa transition-transform duration-200 ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
          </span>
        </button>
      </div>
      <div
        id="mobile-menu"
        className={`grid overflow-hidden border-line transition-[grid-template-rows] duration-250 md:hidden ${open ? 'grid-rows-[1fr] border-t' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0">
          <nav className="flex flex-col px-5 py-3" aria-label="Мобильная навигация">
            {links.map((l) => (
              <button key={l.id} onClick={() => go(l.id)} tabIndex={open ? 0 : -1} className="border-b border-line py-3.5 text-left text-lg">
                {l.label}
              </button>
            ))}
            <a href={waLink()} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1} className="btn btn-primary mt-4">
              Написать в WhatsApp · {CONTACT.whatsappDisplay}
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
