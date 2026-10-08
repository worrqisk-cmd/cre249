# Автоматическое обновление каталога на GitHub Pages

## Проверенное состояние и ограничения

Автоматизация подключена к проекту **milana** (`bvlcyhcuneaphuletnqz`) 08.10.2026. Edge Function `catalog-static-sync` активна (`verify_jwt=false`, отдельный shared secret обязателен). Установлены pg_net 0.20.4, pg_cron 1.6.4 и Vault 0.3.1; единственное задание `catalog-static-sync` активно с расписанием `* * * * *`. Очередь включена.

Таблицы products/categories/site_settings, их данные и прежние RLS сохранены. Новые очередь и журнал закрыты для PUBLIC/anon/authenticated; серверные RPC вызываются Edge Function. Существующие before-update triggers updated_at сохранены. После настройки официальным MCP выполнялись только проверки чтения; значения секретов в документацию и отчёт не попадают.

Angular 22.2.1 остаётся без обновлений; static prerender без hydration. Существующий Pages workflow собирает и проверяет main, concurrency `pages-${{ github.ref }}`, cancel-in-progress=false сохранены. Добавлены независимые проверки очереди/Edge Function, проверка пустого каталога и браузерного fallback. Deployment зависит от успешных существующих и новых проверок.

Официальные ограничения:

- [Supabase schedule](https://supabase.com/docs/guides/functions/schedule-functions): pg_cron + pg_net и Vault поддерживают периодический вызов Edge Function.
- [Database Webhooks](https://supabase.com/docs/guides/database/webhooks): асинхронный вызов после транзакции не заменяет долговечную очередь и гарантированные повторы.
- [Edge limits](https://supabase.com/docs/guides/functions/limits): время/CPU ограничены; функция не спит ради debounce и не ждёт завершения GitHub build.
- [GitHub dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event): Actions:write, ref=main; API 2026-03-10 возвращает workflow_run_id в ответе HTTP 200.
- [Concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency): новый pending run может вытеснить прежний даже при cancel-in-progress=false. Очередь проверяет conclusion и повторяет отменённый запуск.

## Итог подключения 08.10.2026

Код автоматизации опубликован через [PR #14](https://github.com/worrqisk-cmd/cre249/pull/14); права настройки уточнены в [PR #15](https://github.com/worrqisk-cmd/cre249/pull/15). Реальный цикл выполнялся на main SHA `d4c9269b73a8f407b756c07c79dba58677af34b0`.

| Проверка | Результат |
| --- | --- |
| Служебная ревизия 1, контролируемый отказ до dispatch | Попытка записана как failed; событие осталось в очереди и было автоматически повторено после backoff |
| Повтор ревизии 1 | [Workflow 37762555988](https://github.com/worrqisk-cmd/cre249/actions/runs/37762555988): build, проверки и deploy успешны; очередь подтвердила deployed=1 |
| Служебная ревизия 2 во время активной первой сборки | Событие сохранено; после первой сборки запущена отдельная завершающая сборка |
| Ревизия 2 | [Workflow 37762991334](https://github.com/worrqisk-cmd/cre249/actions/runs/37762991334): build, проверки и deploy успешны; очередь подтвердила deployed=2 |
| Завершение | requested=2, deployed=2, attempt=NULL, failures=0, last_error=NULL; ещё 75 секунд очередь оставалась пустой без новых запусков |
| Сохранность данных | Полные fingerprints строк products/categories/site_settings до и после миграций совпали; для проверки товары и настройки не изменялись |
| Очистка | setup: ok, cleanup: ok, exit: ok в 13:25:24 МСК; временный файл и пустая папка отсутствуют |

После сохранения изменений публичного каталога в админке **ручной deploy не требуется**. Работает описанная ниже очередь с debounce и повторами. Ручной `workflow_dispatch` Pages на main сохранён для восстановления и самостоятельных запусков.

GitHub PAT **mil2** действует **до 7 ноября 2026 года** по сведениям владельца. Его следует заменить заранее, например до 6 ноября; точное время истечения здесь не подтверждено. Значение хранится только в серверных secrets: `CATALOG_GITHUB_TOKEN` в Supabase Edge Function Secrets и одноимённом GitHub repository Actions secret. Рабочий dispatch читает Supabase secret; Pages workflow не читает repository-копию. В Vault хранится только общий webhook secret, а не PAT.

Временный Supabase PAT использовался локально для настройки и удалён из временной копии; его можно отозвать. Это не затронет работу функции: runtime использует встроенный Supabase service-role key. Удаление локального файла само по себе не отзывает PAT у сервиса.

Безопасный локальный отчёт: `/home/aozaki/.local/share/milana-catalog-sync/setup-report.jsonl` (файл 600, папка 700). Он хранит этапы, HTTP-статусы, безопасные категории ошибок и результат очистки; Authorization, SQL-параметры и значения secrets не сохраняются. Локальные setup helpers находятся вне Git и не являются переносимым инструментом репозитория. Проверка полного цикла имеет тайм-аут 25 минут, опрос каждые 15 секунд и заключительные 75 секунд ожидания пустой очереди.

## Механизм

Database trigger фильтрует события и атомарно увеличивает requested revision. INSERT/DELETE опубликованных товаров, публикация/скрытие и содержательные изменения публичного товара учитываются, включая фотографии, цену, описание, slug, порядок, featured, доступность. Любые изменения скрытого черновика игнорируются. Обновление только updated_at/created_at игнорируется. Публичные категории и настройки тоже учитываются. Загрузка файла в Storage до сохранения products не меняет страницы и не запускает сборку.

Database Webhook реализован SQL AFTER UPDATE trigger на агрегированной очереди через pg_net: передаётся только tick, без содержимого строк. Отдельный одноимённый webhook в Dashboard создавать НЕ нужно: иначе будут дубли. Cron раз в минуту пробуждает функцию только при наличии незавершённых изменений/активного запуска. Потеря первого HTTP-вызова не теряет событие.

Две минуты тишины объединяют сохранения; при непрерывных изменениях ожидание ограничено десятью минутами. Под блокировкой строки выдаётся одна аренда dispatch на пять минут. Функция вызывает только pages.yml в main фиксированного репозитория worrqisk-cmd/cre249, сохраняет run_id и далее опрашивает workflow. Успех подтверждается только completed/success и jobs.deploy/success. События во время сборки остаются dirty и вызывают завершающую сборку. Ошибка snapshot при изменениях во время подготовки также приводит к повтору.

Ошибка dispatch сохраняется в state.last_error и attempts.error. Отказ API/провал/отмена workflow повторяются с паузами 1, 2, 4, 8… максимум 60 минут без удаления события. При timeout/сбое до attach нельзя достоверно узнать, принял ли GitHub запрос: по истечении аренды следует повтор; возможно лишнее выполнение (at-least-once). Сохранённый run_id при временной ошибке poll не сбрасывается. HTTP 404 для исчезнувшего run вызывает повтор. Запуск, навсегда оставленный GitHub в queued/waiting/in_progress, требует оператора: его нельзя безопасно считать проваленным только по времени. Очередь не обещает exactly-once.

## Живые данные и старые страницы

Кэш и Realtime не менялись. Новый визит после bootstrap читает опубликованные товары Supabase; существующая вкладка сохраняет прежнюю политику восьмиминутного memory cache с отложенным refresh на странице изделия. Успешное сохранение админки обновляет её собственный store.

До нового deploy URL нового товара получает **HTTP 404** от Pages, но 404.html содержит Angular shell с baseHref=/, и клиент загружает опубликованный товар. Обновление URL тоже работает с HTTP 404. Это не HTTP 200 и не полноценная индексируемая страница: shell и клиент сохраняют noindex; настоящие prerender HTML и sitemap появляются после успешного deploy.

После скрытия/удаления товара старый HTML и sitemap остаются опубликованы **до замены Pages artifact**. Свежий клиент показывает недоступность, однако исходный HTML всё ещё содержит прежние сведения и HTTP 200. Нормальное окно: 2–3 минуты debounce + ожидание concurrency + build/checks/deploy + распространение CDN. При непрерывных сохранениях debounce до 10–11 минут. Фиксированной верхней границы нет: ошибки сборки, истёкший токен, недоступность Supabase/GitHub или ожидание workflow могут продлить окно. После deploy дополнительно остаются CDN/браузерные/поисковые кэши; удаление сторонних копий не гарантируется. Это не механизм срочного удаления конфиденциальных данных. Уже лежащие в public/photos исходные фото не удаляются автоматически.

Пустой публичный каталог теперь допустим при точном count=0; усечённый ответ по-прежнему останавливает сборку. Это необходимо для скрытия последнего товара. Удаление всех site_settings или публичной категории, на которую ссылается опубликованный товар, остаётся ошибкой целостности: исправить данные владельцем, затем повторить сборку.

## Первичная настройка нового окружения

Текущее production-окружение уже подключено. Эти шаги описывают первичную настройку; для замены токена используйте раздел ниже. Перед повторным запуском проверяйте существующие именованные ресурсы, чтобы не повторять миграции и не создавать второе задание Cron.

1. Опубликовать код через обычный PR/CI/merge в main и дождаться Pages deploy с workflow и fallback.
2. В GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens создать токен только для worrqisk-cmd/cre249 с Repository permissions **Actions: Read and write** и **Secrets: Read and write**, без Contents write, Administration и широкого classic repo. Actions нужно для `workflow_dispatch`; отдельное право Secrets нужно для чтения ключа шифрования и записи `CATALOG_GITHUB_TOKEN` в repository Actions secrets. GitHub требует Secrets permission для endpoint создания секрета. Metadata read добавляется автоматически. Установить срок действия и напоминание о замене. Не помещать токен в браузер, site-config, Git или чат.
3. Создать случайный общий секрет не короче 32 символов (например, `openssl rand -hex 32` в своём терминале). Через Supabase Dashboard → Edge Functions → Secrets сохранить `CATALOG_GITHUB_TOKEN` и `CATALOG_WEBHOOK_SECRET`. SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY предоставляет runtime; их не копировать в frontend.
4. В Dashboard → Vault добавить secret с именем `catalog_sync_webhook_secret`, значением точно того же CATALOG_WEBHOOK_SECRET. Не выводить decrypted_secrets в отчётах/чат. GitHub-токен в Vault не нужен.
5. Если Supabase CLI не установлен, команды можно выполнить через pnpm dlx (без изменения зависимостей проекта). Авторизоваться своим аккаунтом и выполнить из этой папки:
   ```sh
   pnpm dlx supabase login
   pnpm dlx supabase functions deploy catalog-static-sync --project-ref bvlcyhcuneaphuletnqz --no-verify-jwt
   ```
   config.toml отключает JWT только для этой функции; POST требует x-catalog-sync-secret, GET и посторонний POST отклоняются. Не включать CORS/вызовы из админки. Вызов без секрета должен дать 401; GET — 405. Не вставлять secret в команды, сохраняемые в истории; для пробного POST использовать локальный защищённый curl config либо Dashboard.
6. Проверить историю миграций и применить **только два новых файла** в указанном порядке через SQL Editor, каждый целиком в транзакции BEGIN/COMMIT: `20261008120000_catalog_static_sync.sql`, затем `20261008121000_catalog_static_sync_wakeup.sql`. Не выполнять слепой db push всех исторических файлов: исходная схема уже существует. Второй файл устанавливает pg_net/pg_cron и минутное задание; enabled=false предотвращает сетевые вызовы до включения. В production эти два файла уже применены через Management API SQL отдельно в транзакциях. Повторять их DDL для замены PAT не требуется.
7. Проверить extensions, cron.job, функции, privileges и единственный queue webhook trigger. В SQL Editor под postgres выполнить `select public.catalog_sync_enable(true);`. Включение само ставит первую сборку в очередь — тестовые товары не нужны.
8. Проверить состояние и журнал без секретов:
   ```sql
   select enabled,requested,deployed,attempt,revision,run_id,failures,retry_at,last_error
   from public.catalog_sync_state;
   select * from public.catalog_sync_attempts order by started_at desc limit 20;
   select jobid,status,return_message,start_time,end_time
   from cron.job_run_details order by start_time desc limit 20;
   ```
   После успешного deploy дождаться requested=deployed, attempt IS NULL; проверить sitemap и HTTP 200 существующих публичных URL. Сверить run_id с GitHub Actions, логи функции и при проблемах pg_net response logs (они временные, не долговечный журнал). Не читать http_request_queue с auth headers для отчётов.
9. Повторы автоматические. После исправления токена/ошибки можно ускорить следующую попытку под postgres: `update public.catalog_sync_state set retry_at=now() where id and attempt is null; select public.catalog_sync_wake();`. Для зависшего run сначала отменить его в GitHub и дождаться фиксации failure. Не подтверждать deployed вручную.
10. Пауза: `select public.catalog_sync_enable(false);` — перестаёт создавать новые вызовы, но уже запущенный workflow не отменяется. События сохраняются; повторное true ставит актуальную сборку. Для полного отключения отдельно отключить Cron и отменить активные workflow; frontend fallback остаётся.

## Замена GitHub PAT до истечения срока

1. До 7 ноября 2026 (рекомендуется до 6 ноября) создать новый fine-grained PAT только для `worrqisk-cmd/cre249`. Права: Actions — Read and write, Secrets — Read and write, Metadata — Read-only; без Contents write и Administration. Actions требуется для dispatch/опроса; Secrets — для обновления repository secret. Установить новый срок действия и записать дату следующей замены. Старый mil2 пока оставить действующим.
2. В GitHub repository Settings → Secrets and variables → Actions обновить существующий `CATALOG_GITHUB_TOKEN` новым значением. Затем в Supabase Dashboard проекта milana → Edge Functions → Secrets обновить существующий `CATALOG_GITHUB_TOKEN` тем же новым PAT. Вводить значение только в защищённые формы настроек или скрытый локальный ввод; не передавать в чат, argv, shell history, Git или site-config. Именованные secrets обновляются, а не создаются под новыми именами.
3. `CATALOG_WEBHOOK_SECRET` и `catalog_sync_webhook_secret` в Vault для замены GitHub PAT не менять. Очередь/Cron не переустанавливать, миграции не повторять. [Supabase применяет новые production secrets без повторного deploy функции](https://supabase.com/docs/guides/functions/secrets#production-secrets).
4. Для проверки нового токена под postgres **один раз** выполнить `select public.catalog_sync_enable(true);`. Даже для уже включённой очереди этот вызов создаёт служебную ревизию; многократный вызов создаёт дополнительные задания. Товары не менять. Дождаться debounce, реального workflow_dispatch и успешных build/deploy, затем requested=deployed, attempt IS NULL, failures=0, last_error IS NULL. Проверить run_id по журналу attempts; ручной запуск Pages сам по себе не проверяет токен Edge Function.
5. Только после успешного цикла с новой ревизией отозвать прежний mil2 в GitHub Settings → Developer settings → Personal access tokens. При ошибке новый токен/его права исправить до отзыва старого и повторить проверку очереди. Временные локальные копии обоих токенов удалить; временный Supabase PAT после операций настройки также отозвать, если он создавался для этой задачи.

Если PAT истёк, публичные API-запросы каталога продолжают работать, но prerender/sitemap не обновятся до восстановления dispatch. Ошибка запуска сохраняется в state.last_error и attempts.error; событие не теряется, повтор выполняется с backoff. После замены можно ускорить повтор командой из пункта 9 первичной настройки. Не выставлять deployed вручную.

## Локальные проверки и границы

`deno test --no-config --no-npm supabase/functions/catalog-static-sync/worker_test.ts`; `deno check .../index.ts`; `node scripts/test-catalog-sync-db.mjs` на одноразовом Docker PostgreSQL 17; `pnpm test:static-empty`; `pnpm test --watch=false`; production `pnpm build`, `pnpm test:seo`, `pnpm test:routing`, `pnpm test:catalog-api`, `pnpm test:catalog-fallback`.

SQL-тесты проверяют реальные транзакции/функции core migration, RLS privileges и SQL wiring с локальными doubles net/cron/Vault (включая отказ без секрета и адрес/headers/body webhook). После локальных проверок выполнен реальный hosted Supabase → GitHub → Pages цикл, описанный выше. Контролируемый отказ проверяет долговечность очереди и backoff до dispatch; реальный отказ GitHub API специально не вызывался. Ошибки GitHub HTTP и отмены workflow покрыты подменёнными ответами Edge unit tests. Дальнейшие миграции схемы должны учитывать фильтрацию trigger и статический snapshot. Журнал attempts пока без автоматической чистки: при редких сохранениях рост мал; чистить по согласованному сроку хранения позже, не теряя активные попытки.
