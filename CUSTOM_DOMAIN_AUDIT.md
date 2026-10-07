# Production: milana-pechet.ru

Проверено 2026-10-07. Область: перенос Angular GitHub Pages с project URL в корень custom domain; без общего UI/SEO/performance аудита.

## Причина и зависимости

Публичный HTML https://milana-pechet.ru/ фактически содержит `<base href="/cre249/">` (диагностическое чтение curl с отключённой проверкой сертификата). Относительные main JS и CSS разрешаются в прежний подкаталог. Источник — production.baseHref в angular.json. Этот же base влияет на Router, site-config.json, photos и catalog-media. Точные HTTP-статусы старых ресурсов отдельно не измерялись.

Другие зависимости: src/app/seo.ts — canonical старого origin; scripts/finalize-static.mjs — sitemap и ссылка 404; scripts/serve-production.mjs — preview только под /cre249/; .github/workflows/pages.yml — ожидание старого preview URL; browser/API/admin/UI/intro/routing проверки — старый адрес по умолчанию. Актуальные инструкции AGENTS.md, STATIC_PAGES.md, SUPABASE_SETUP.md обновлены. Исторические отчёты сохраняют прежние условия измерений.

## Минимальные исправления

Production baseHref и preview prefix теперь `/`. Canonical и sitemap используют https://milana-pechet.ru. Ссылка 404 ведёт на /catalog/. Workflow ожидает корневой URL; структура artifact и deploy jobs сохранена. deployUrl не задан и не добавлен. Фото и site-config используют относительные пути; ручная замена их URL не требуется. Lazy loadComponent, Path Router, trailing slash serializer и преобразование legacy hash относительно document.baseURI сохранены. Refresh обеспечивают существующие prerender index.html и admin shells, без SPA fallback.

CNAME не добавлен: при custom Actions deployment GitHub не требует этот файл и игнорирует его; custom domain задаётся в Pages Settings: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## Проверки

Node 22.22.3, pnpm 12.8.1. pnpm build: успешно, 17 опубликованных изделий, 4 категории, 23 prerender страницы. pnpm test --watch=false: 6 тестов успешно. Локальный production server без fallback на 127.0.0.1:8448/ (8447 был занят). BASE_URL задан явно для pnpm test:routing, test:catalog-api, test:admin-form — все успешно.

Chromium, 390×900 и 1440×900, reduced motion, без записи медиа. Проверены HTTP 200 всех публичных документов, canonical, base, sitemap, неизвестный маршрут 404, direct/reload каталога, категории, изделия и login, legacy hash, admin guard, dialog/history/focus/scroll и WhatsApp без отправки. Добавлены проверки отсутствия /cre249/ в публичном HTML, HTTP-ошибок локальных ресурсов и загрузки видимых изображений. В сгенерированных HTML/JS/XML старый prefix/origin не найден. Это локальная проверка artifact, не проверка уже опубликованного исправления.

## Внешний блокер и дальнейшее действие

Обычный HTTPS curl к milana-pechet.ru завершился ошибкой 60: SSL certificate subject name не соответствует домену. Исправление Angular не меняет DNS/сертификат. Перед приёмкой публикации проверить состояние сертификата и custom domain в Pages Settings, затем HTTPS без обхода проверки. По одному запросу нельзя установить причину выдачи неверного сертификата.

Push/deploy не выполнялись. После разрешённой публикации повторить HTTPS, загрузку ресурсов и refresh /catalog/ и /item/assorti/ на реальном домене. Внешние настройки GitHub/DNS не изменялись.
