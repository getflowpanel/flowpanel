# FlowPanel и FreelanceRadar: план качества от установки до ежедневной работы

Дата: 2026-09-08. Статус: программа реализации; пункты ниже не означают, что возможности уже выпущены.

Результаты первого цикла и границы фактической проверки: [delivery record](2026-09-08-quality-delivery-record.md). Roadmap ниже остаётся программой дальнейшей работы; его нельзя использовать как список уже доступных API.

**Цель:** разработчик подключает FlowPanel к поддерживаемому Next.js-приложению, открывает работающую админку и постепенно адаптирует её без догадок, опасных заглушек и копирования инфраструктуры. FreelanceRadar становится проверкой этого обещания на реальном продукте.

**Архитектура:** развиваем существующие compiler/runtime/CLI и транзакционный filesystem plan. Разделяем обнаружение проекта, план установки, применение и проверку результата. Один контракт ресурса и авторизации обслуживает страницы, JSON API, drawers и связанные списки; бизнес-смысл аналитики остаётся в приложении.

**Стек:** TypeScript, Next App Router, React, Drizzle/Prisma, pnpm workspace, Vitest, Playwright. Текущий опубликованный пакет у host — 0.2.0; версии в checkout FlowPanel — 0.1.0. Номер выпуска определять release-процессом, не выводить из названия friction log.

**Исходные документы:** [план по опыту интеграции](2026-09-08-10-of-10-from-freelance-radar.md), [F1–F43](2026-09-08-friction-log-freelance-radar.md), локальный предыдущий roadmap `1.x-roadmap-to-10-of-10.md`. Это входные наблюдения и предложения, а не обязательство реализовать каждую предложенную сигнатуру.

## 1. Что проверено и что нужно поправить в исходном плане

Аудит FlowPanel выполнен по checkout `2804944`. FreelanceRadar: `feat/new-admin`, зависимости FlowPanel 0.2.0. Чужой untracked `docs/plans/2026-09-03-pipeline-architecture.md` не относится к работе.

| Наблюдение | Проверка по текущему коду | Вывод |
| --- | --- | --- |
| Установка может сломать `/admin` | `packages/cli/src/commands/init.ts` строит `admin/[[...slug]]`, не нормализует route groups | Подтверждённый дефект планирования маршрутов |
| CLI нужно написать scan/plan/apply с нуля | `packages/cli/src/plan/` уже содержит preview, conflict detection и rollback | Сохранить этот механизм, добавить semantic preflight |
| CLI не читает `.env` | `packages/cli/src/index.ts` уже вызывает `loadDotEnv()` | F7 частично устарел: проверить совместимость порядка, expansion, test mode с Next |
| CLI теряет причину DB ошибки | `utils/fail.ts` обходит causes, но обычно печатает только верхнее сообщение | Исправить вывод; не путать неверный пароль/недоступность с отсутствием переменной |
| CSS всегда отсутствует под pnpm | Все 241 тест CLI, включая 8 настоящих Tailwind compilations, прошли при аудите | F34 не воспроизведён на текущем искусственном fixture. Нужен packed-package host и responsive/layout assertions; нельзя объявлять все pnpm-установки сломанными |
| `render` должен получить полный row | `runtime/project-row.ts` намеренно ограничивает declared surface и field access | Не убирать защиту. Разделить list/detail projection и явные зависимости renderer |
| В detail нужны 23 hidden columns | Уже существует `resource.expose`, но projection смешивает detail и list | Исправить границы выборки и документацию, не создавать параллельный механизм |
| Все проблемы ещё присутствуют в host | Host уже использует `/new-admin`, DB role lookup, nonce script и explicit CSS sources | Переносить исправления в framework, удаляя обходы по одному |
| 4 000 LOC можно удалить, значит будет 10/10 | Это оценка без контрольной реализации | Удалённые строки — дополнительная метрика, не критерий качества |

После входа пользователя выполнен read-only browser audit уже запущенного `http://localhost:3111/new-admin` на host HEAD `10428d7a`: обзор, система, фильтр прогонов, список пользователей и карточка существующего синтетического аккаунта. Действия парсинга, повторов, редактирования и записи в БД не запускались. Проверен viewport около 561 px; это не полный responsive/performance аудит. Историческую ошибку Next подтверждает конфликт маршрутов в исходниках, а не новый запуск с production credentials.

Браузер подтвердил дефект перехода Kwork: `?platform=kwork` оставляет фильтр «Any» и прогоны всех площадок; штатный выбор Kwork добавляет `f_platform=kwork` и оставляет только Kwork. В карточке пользователя видны UUID в главном заголовке, десять вкладок в горизонтальной полосе и `Edit`. Поиск, фильтры, даты и навигация частично английские, хотя host уже задаёт русские labels. Вкладка уведомлений открывается и показывает предметное пустое состояние; наличие пустого состояния не доказывает корректность прочих историй. Новый FlowPanel runtime в host ещё не установлен.

Дополнительные дефекты host, которых нет в F1–F43:

- `admin/ui/PlatformGrid.tsx:22`: `?platform=` не соответствует `f_*` в `parse-list-params.ts`; переход не применяет фильтр.
- `admin/queries/funnel.ts:89`: «Открыли заказ после него» проверяет любое историческое открытие пользователем. Нет временного порядка и корреляции с уведомлением/заказом.
- `admin/queries/business.ts:58`: revenue/payers не исключают тестовую популяцию, хотя обзор обещает это для growth metrics.
- `admin/ui/LiveStatus.tsx:42`: возраст данных сбрасывается до успешного refresh. Ошибка загрузки может выглядеть как свежий результат.
- `admin/queries/user-related.ts:14`: истории ограничены 50 записями; показ лимита не заменяет доступ к остальным.
- `admin/config/theme.ts`: синий accent расходится с lime-системой host. Копия stylesheet на 484 строки усложняет обновления.

Уточнение контракта Telegram-метрики: `markViewed` в `src/app/api/trpc/routers/orders.ts` использует `onConflictDoNothing`; `user_order_view` хранит **первый** просмотр пары user/order. Исправленный агрегат может доказывать только «первый просмотр того же заказа после доставки», а не повторное открытие или переход из Telegram. Подпись и пояснение должны отражать это ограничение. Контрактные fixtures обязаны различать просмотр до доставки, другой заказ, первый просмотр после доставки и повторные подходящие уведомления одного пользователя.

## 2. Решение о границах продукта

Рассмотрены три подхода:

1. Только исправить freelance-radar. Быстрый локальный выигрыш, но следующая установка повторит обходы.
2. Сначала переписать FlowPanel и сделать универсальный DSL аналитики. Большой риск сломать существующие возможности и отложить работающий результат.
3. **Рекомендуется: законченные вертикальные этапы framework → чистый fixture → host.** Каждый этап закрывает пользовательский сценарий, совместимость проверяется через реальные package tarballs. Доменные компоненты сохраняются там, где они понятнее DSL.

Поддерживаемый проект — конкретная опубликованная матрица, а не «любой Next». Первый контракт: App Router, Node runtime, TypeScript, поддерживаемые React/Next и Drizzle/Prisma версии. Pages Router, Edge-only и неподдерживаемый ORM получают понятный отказ до записи файлов. Добавление версий Next возможно только после CI, без автоматического изменения host dependencies.

Приоритеты: **не сломать приложение → запуститься → объяснять ошибки → корректные данные и действия → удобная навигация → визуальное качество → уменьшение конфигурации**.

## 3. Критерий готовности вместо оценки на глаз

Релиз закрывает этап только при наличии артефакта проверки. Зелёные unit tests сами по себе недостаточны.

| Область | Проверяемое требование |
| --- | --- |
| Установка | Чистый поддерживаемый fixture: install → init → dev → admin без ручной правки generated файлов; измеряем время отдельно от скачивания зависимостей |
| Существующий проект | Root layout, middleware/proxy, чужие routes и зависимости не меняются неявно; отказ оставляет файловое дерево прежним |
| Повтор | Второй init либо no-op, либо объясняет drift; `--dry-run --json` ничего не пишет и не подключается к БД |
| Авторизация | Anonymous/обычный пользователь не читают данные через UI/API/SSE/actions; production не получает development identity |
| Данные | Projection и scope совпадают на всех путях; запрос карточки не запускает неактивные табы; pagination доступна после 25/50 строк |
| UX | Deep link, Back/Forward, refresh и копирование URL сохраняют выбранный контекст; видимый control выполняет обещанное действие |
| Состояния | Empty, initial loading, refresh, validation failure, dependency failure и forbidden имеют разные сообщения и следующий шаг |
| Вид | 375/390/768/1440px, light/dark, keyboard, reduced motion; нет прокрутки всей страницы по X, таблица может прокручиваться внутри |
| Документация | Quickstart выполняется над опубликованным tarball; каждый пример компилируется; documented API существует |
| Обновление | Существует tested upgrade с предыдущего поддерживаемого релиза и список ручных действий; старый config либо работает, либо получает actionable migration error |

Численные бюджеты устанавливаем после baseline, а не придумываем p95: SQL count на первый tab должен перестать зависеть от числа неактивных tab; payload списка не содержит prompts/bio только из detail; bundle/CSS size сравниваем с baseline в CI.

## 4. Этап A — установка, которой можно доверять

### A1. Общий ProjectScan

Файлы: `packages/cli/src/utils/detect.ts`, новый модуль маршрутов в `utils/`, `commands/init.ts`, `commands/doctor.ts`.

Контракт: результат обнаружения хранит значение, источник и confidence (`detected`, `inferred`, `unresolved`). Preview показывает путь и export, который действительно будет импортирован. Сканирование не исполняет пользовательский TypeScript и не импортирует DB/auth.

- Читать installed versions и declared ranges раздельно; не разбирать semver первым совпавшим числом. Проверять Node/React/Next/adapter совместимость одним правилом, используемым также doctor и release checks.
- Поддержать `app/`, `src/app/`, alias/relative imports и barrel `index.ts`. Учитывать `baseUrl`/`extends`; unresolved alias не превращать в ложное detected.
- Из `drizzle.config.*` извлекать статическую строку `schema`, barrel paths разрешать на диске. Dynamic expressions и glob с несколькими результатами показывать как unresolved; не импортировать конфиг ради обнаружения.
- Проверять наличие ожидаемого export (`db`, `prisma`, auth hook), отдельно от существования файла. Несколько кандидатов — выбор с пояснением, не первый случайный.
- Нормализовать URL через route groups; учитывать private folders, parallel/intercepting routes и catch-all. Не вставлять optional catch-all поверх существующих вложенных admin страниц.
- `--path /ops/admin` задаёт mount. При занятом `/admin` показать конфликтующий файл и предложить `/flowpanel`; unattended run должен либо выбрать явно отражённый безопасный путь, либо отказать, если безопасного решения нет.
- API и SSE проходят такую же collision-проверку; `paths.admin` и `paths.api` записываются вместе с route files.

### A2. CLI как понятный пользовательский интерфейс

Последовательность: короткое обнаружение → разрешение неоднозначностей → один preview/confirm → apply → install → postflight → следующий шаг. `--yes` пропускает подтверждение, но не валидацию. Cancel до apply оставляет 0 изменений.

Пример UX (предлагаемый вывод, не существующий контракт):

```text
FlowPanel init

Project      freelance-radar · Next App Router · pnpm
Database     Drizzle · src/shared/lib/db/index.ts → db
Schema       src/shared/lib/db/schema/index.ts
Authentication  better-auth found · role mapping needs configuration
Admin URL    /flowpanel
             /admin is occupied by src/app/(dashboard)/admin/page.tsx

Create       flowpanel.config.ts
Create       src/app/flowpanel/layout.tsx
Create       src/app/flowpanel/[[...slug]]/page.tsx
Create       src/app/api/flowpanel/[...route]/route.ts
Review       src/middleware.ts may redirect the admin route

Apply these changes?
```

Общие требования: тихий pipe без spinner/ANSI, `NO_COLOR`, понятные exit codes, JSON только в stdout, diagnostics в stderr, cancellation не выглядит crash. JSON содержит unresolved/warnings/install result, а не только `applied: true`. Install failure не называется успехом; показать сохранённые файлы и команду восстановления. Не обещать атомарный rollback package-manager side effects: файловая транзакция и installation — разные стадии.

### A3. CSS, layout и тема

- Admin CSS подключается из layout выбранного mount. Root layout не патчится, не добавляется второй глобальный theme controller.
- Установщик обязан учитывать, что CSS import в nested layout **не делает глобальные selectors локальными**. Финальный default — precompiled styles без глобального preflight, scoped tokens/utilities включая portalled overlays. Проверить host marketing page до/после client navigation.
- Пока prebuilt CSS не доставлен, explicit per-package sources и реальный compile probe — промежуточная совместимость, не заявлять независимость от Tailwind.
- `ThemeScript` принимает nonce. Отдельный server-safe export позволяет Server Component использовать тот же script builder; проверить собранный пакет на RSC boundary.
- CSP integration использует nonce, реально переданный host. Не выдумывать универсальный header `x-nonce`; documented recipe и ручная настройка, если источник неизвестен.

### A4. Auth и первая полезная страница

- Обнаружение dependency не равно обнаружению готового session API. Отсутствие getSession никогда не подменяет существующий auth development-admin stub.
- Если wire-up неизвестен: сгенерировать отказ по умолчанию и setup diagnostics с ссылкой на provider recipe. Явный opt-in development auth возможен только в dev и показан в preview.
- `AuthConfig.role(session)` принимает `string | Promise<string>`; request setup ожидает результат один раз до запросов/кешей. Ошибка provider не превращается в admin или guest success.
- Начать с better-auth generic adapter без жёсткой dependency, существующие Clerk/NextAuth/Lucia не переписывать. Тесты null/session/deleted user/non-admin/async rejection.
- Интроспекцию схемы предлагать отдельной явной стадией после безопасного config load. Автогенерация ресурсов начинается read-only; mutation enablement требует проверяемой формы и policies.
- Setup screen при пустом `resources` объясняет один следующий шаг и показывает минимальный реальный ресурс. Полный автоматический CRUD по всем таблицам не включать.

### A5. doctor, ошибки, env

- Static doctor использует тот же route/config model, умеет re-exported `flowpanel.config.ts → admin/config/index.ts`. Dynamic config сообщает unknown, а не создаёт `/admin` через `--fix`.
- `--fix` не создаёт conflicting route и не сообщает repair как verified runtime health.
- Runtime checks отделены от static: DB connection, HTTP mount, auth and CSS требуют явного dev context. `doctor --json` не импортирует production config как скрытый побочный эффект.
- Environment semantics взять из `@next/env`: env-specific files, shell precedence, expansion, test exception. Загружать до config import, не печатать значения.
- Error output показывает безопасную цепочку причин и remediation. Не выводить raw SQL params/session/secrets. SQL текст доступен только как opt-in dev diagnostic после redaction.
- NOTICE filtering делать на принадлежащем FlowPanel driver/logger, не глобально через перехват console host.
- `dev` сохраняет host dev command/port, печатает реальный admin URL; открытие браузера opt-in. Не заводить второй dev server поверх работающего.

**Приёмка A:** packed CLI устанавливается на fixtures с root/src app, no alias/custom alias, FSD Drizzle, Prisma, better-auth, existing `/admin` в route group, CSP, pnpm и host Tailwind. Negative fixtures: missing export, dynamic schema, duplicate route, unsupported version, failed install, malformed config, повторный init. Каждый negative case завершается понятным сообщением без повреждения host.

## 5. Этап B — список, карточка и действия как один продукт

Файлы: `packages/core/src/types/resource.ts`, `types/config.ts`, `policy/fields.ts`; `packages/next/src/runtime/project-row.ts`, `require-authorized.ts`, `pages/resource-{list,detail}.tsx`, `pages/DetailTabsClient.tsx`; `packages/react/src/_organisms/` и фактические DataTable/form модули.

- Разделить list/read/detail/edit projection. `columns + rowKey + явно expose` — доступное list представление, с field policies до adapter query и повторной фильтрацией на выходе. Detail fields не раздувают list SELECT и JSON payload. Не считать `hidden: true` security policy.
- Render dependencies объявляются явно через существующий `expose` или отдельный detail-select, если list/detail разделение этого потребует. Никогда не отдавать `Object.keys(databaseRow)` по умолчанию.
- `rowClick: "detail" | "drawer" | false`; default detail только при detail config. Link cells и action buttons не вызывают row action. Keyboard подсказка соответствует реальной возможности. Сохранить open-in-new-tab для entity link.
- Header identity: поддержать существующий `detail.header` или deprecate с working replacement; title/subtitle/badge строятся из разрешённых полей. Пользователь видит email/name, ID остаётся copyable secondary text.
- Lazy tabs через существующий App Router navigation и `?tab=`. Не создавать отдельный API с сериализацией React nodes. Сначала фильтровать доступные tabs, затем выбирать active и выполнять только его render/query; неизвестный tab имеет детерминированный fallback. Back/Forward и pending transition тестируются в браузере.
- Related collection — настоящий paginated list с total, scoped filter, sort, reference labels, excluded parent column и ссылкой «Открыть список». Hidden таб не является authorisation boundary.
- `FieldDef.label` сохраняется в serialization; fields sections и form fields независимы от списка колонок. При невозможном create конфигурация получает точный diagnostic с отсутствующими required fields/defaults, не обещание универсальной compile-time проверки БД.
- Ошибка одного ресурса не уносит весь host в generic error page: название операции, correlation id, retry, dev detail. Server logs содержат cause, UI — безопасное сообщение.
- Authorisation gates проверяются и для UI edit actions, и для серверной операции; singular/plural и required messages проходят единый labels contract.

**Приёмка B:** adapter spy подтверждает SELECT и scope; secret canaries отсутствуют в RSC/JSON/export/related; 12 tabs запускают query только активного; navigation/back/keyboard реально меняют content; page 2 показывает ранее недоступные строки; broken create объясняется до отправки невалидной формы.

## 6. Этап C — выразительная аналитика без принудительного DSL

Файлы: core `types/widget.ts`, `builders/widget.ts`, `types/labels.ts`, `format-column.ts`; next `pages/dashboard.tsx`, widget renderers; react primitives; charts renderers.

### Общие контракты

- `locale` и `timeZone` проходят через server/client formatters, deterministic SSR и Intl. Проверить UTC, Europe/Moscow, DST zone, null/invalid/zero/negative values. Money хранит явную единицу: major/minor и currency; не угадывает копейки.
- Formats: date/datetime/relative/number/money/boolean/enum-badge/link. `render` остаётся escape hatch. Accessibility text и export representation не должны зависеть от JSX.
- Полный labels inventory по surfaces: navigation, search, filters, presets, saved views, pagination, detail, form validation, actions, related, charts и empty/error states. Проверять пользовательский DOM на RU fixture; простой regex всех JSX literals даёт ложные срабатывания и не заменяет контракт.
- Mount-aware `href` строит resource/detail/tab/filter URL, кодирует id и значения, сохраняет Next basePath contract. Typed resource names — compile tests; непроверенный external href — не trusted internal drilldown.
- Разделить query error и empty. Metric `0` — данные; неизвестно — отдельное состояние. Delta содержит direction и `goodWhen`, а не автоматически зелёный рост.

### Набор компонентов

Сначала улучшить существующие `metric`, `table`, KV и Panel, затем добавлять `bars`/`list` по двум подтверждённым host usages. `stat` не становится дубликатом metric. Funnel первоначально может остаться domain component.

- Metric data может вернуть value/tone/hint/delta/href; opts задают fallback presentation.
- Table получает typed columns, label/format/alignment, stable rowKey, row link, empty state, limit + explicit total/see-all. Это не второй CRUD DataTable с отдельными filters.
- Widget grid используется в dashboard и detail tabs с row context, только после согласования projection/access. Request-local cache keys включают auth scope, range, filters; глобальный cache на user data не вводить.
- Initial skeleton сохраняет размеры. Refresh оставляет последнюю успешную data с stale indicator; timestamp меняется после успеха, ошибки видны. Polling останавливается на hidden tab, отменяет запросы, не дублирует SSE refresh.
- Charts имеют empty/error/loading, legend у donut и текстовую альтернативу; mobile header actions переносятся, hit targets не перекрываются.
- Date helpers явно задают inclusive/exclusive range и timezone bucket; zero-fill не превращает пропущенные данные upstream failure в нули.

**Приёмка C:** два одинаковых query в одном request выполняются один раз, между users не разделяют результат; localization snapshot/DOM; таблицы со стабильными keys и transitions; chart [] отличается от error; failed refresh сохраняет timestamp последнего успешного ответа.

## 7. Этап D — инфраструктура и документация

- Publisher принимает собственный клиент host или URL, owns envelope, publish-only не создаёт subscriber. Отдельные transport ownership и dispose semantics; нельзя закрывать переданный host client.
- Redis connection errors имеют handler; lost connection не валит процесс и не объявляется доставкой. HMR binding обновляется по config identity, прежние owned connections закрываются; нет накопления listeners.
- SQL helper добавлять только после воспроизведения Date issue на поддерживаемой driver matrix. Не делать универсальный rewrite SQL object graph; date/timestamp/UTC semantics — explicit. DB query helpers обязаны сохранять scope; не предлагать обход policy через `ctx.count` по умолчанию.
- Package README содержит работающий путь first resource и troubleshooting по error codes. Документы по Next versions, paths, tabs и CSS выводятся/проверяются из public contract.
- Agent guidance в пакете объясняет server/client import boundaries, safe auth, minimal example, invalid patterns и upgrade path. Не заменяет human docs.
- Smoke helper сначала внутренний CI utility. Отдельный `@flowpanel/test` выпускать только при стабильном публичном API и двух реальных consumers; generic проверка «никакого английского» не применяется к domain data.
- Release gates: build, typecheck, unit, public API type tests, docs snippets, publint/attw, packed install, browser tests и upgrade fixture. Changeset с breaking/deprecation notes; никакого auto publish/deploy из этого плана.

## 8. FreelanceRadar: конечный UX и устройство кода

### Информационная архитектура

Навигация отражает работу оператора:

| Раздел | Главный вопрос | Переход к действию |
| --- | --- | --- |
| Обзор | Что требует внимания сейчас? | Problem → affected group → entity |
| Пользователи | Почему человек не получает ожидаемый результат? | Search → identity → delivery/activity/billing |
| Заказы | Что произошло с конкретным заказом? | Order → pipeline stages → scoring/delivery |
| Операции | Где и с какого момента сломалась обработка? | Health → platform/queue/stage → filtered failures |
| Аналитика | Как меняется продукт за выбранный период? | Metric → definition → reproducible filtered population |

Не удалять пять текущих dashboard routes до проверки новых сценариев; дать им место в nav и совместимые ссылки. Служебные таблицы убрать в вторичную группу, но сохранить доступ для диагностики.

Обзор: health + требующие действия исключения наверху; ниже 4–6 основных метрик, затем trends. У каждой цифры период, единица, определение и осмысленный drilldown. Не показывать 20 одинаково важных карточек.

Карточка пользователя: persistent name/email, role/subscription/delivery status; primary actions только доступные для роли. Пять групп: Обзор, Активность, Доставка, Подписка, Доступ. Внутри групп — текущие полезные subviews с URL и pagination, без eager queries всех десяти старых tabs.

Карточка заказа: readable title/platform/status, timeline обработки, причины решения и retry только конкретного доступного этапа. Сырые AI prompts/logs вторичны и под field permissions.

Визуальная система: lime accent и токены host, спокойная typography, mono только числа/IDs, без декоративных капсов. Контент/состояния/иерархия важнее новой сетки карточек. Проверять реальные длинные RU строки, пустые данные, длинные IDs и таблицы на mobile.

### Данные и архитектура host

- `admin/config` отвечает за composition; `admin/queries` — domain contracts; `admin/ui` содержит только специализированные investigation views. Не вводить FSD-вверх импорты в `src/shared` ради admin.
- Queries возвращают данные/entity identity; URL строит mount-aware helper в presentation boundary. Убрать хардкод `/new-admin` из SQL и компонентов.
- Каждая metric получает definition: population, event/cohort/snapshot semantics, range boundaries, timezone, currency, tests exclusion, freshness source. Проверить funnel causality, одинаковый REAL cohort для revenue/payers и честное название proxy activity.
- Timestamp успешной загрузки приходит с данными; `router.refresh()` сам по себе не подтверждение успеха.
- Истории получают total/cursor или страницы и reproducible filter. Ограниченный preview всегда имеет путь к полной истории.
- Последовательно заменять QueryTable/ValueCard/format wrappers/theme/publisher, только когда framework replacement доказал parity. Сохранить удобный custom React для domain trace вместо конфигурации на сотню строк.

### Последовательность переноса

1. Зафиксировать isolated seed и baseline старой/новой админки. Не читать/менять production DB для browser QA.
2. Исправить correctness defects: platform filter, cohort, причинность funnel, stale refresh. Контрактные DB tests на противоположных случаях, не mocks SQL chains.
3. Подключить собранные FlowPanel tarballs одной версии; проверить отсутствие duplicate core и server/client boundary errors.
4. Перевести layout/theme/auth/links, затем списки и одну карточку пользователя. Проверить parity до переноса остальных views.
5. Перестроить navigation/overview и order investigations; улучшить empty/error/loading states.
6. Разрешить ownership `/admin`: проверить функции старой админки, перенести необходимые, только затем переключить route и сохранить `/new-admin` bookmarks redirects. До этого `/new-admin` остаётся рабочим mount.
7. Удалить только доказанно заменённые workarounds; выполнять type-check/lint/unit/DB contracts/browser checks и независимый review по AGENTS host. Отдельно измерить LOC без обещания целевой цифры.

Seed для приёмки: две площадки, real/test users, >50 событий истории, события до/после уведомления для разных orders, нулевые/неизвестные значения, отсутствующая подписка, failed/slow dependency, два разных tenant/scope при наличии scope.

Обязательные browser сценарии: platform tile действительно фильтрует строки; пользователь найден и открыт клавиатурой; переход tab меняет content и URL; Back восстанавливает tab; page 2 показывает другие записи; неуспешный refresh не освежает timestamp; forbidden API/SSE не раскрывает данные; действие имеет подтверждение, pending, success/failure и проверенный результат.

## 9. Очерёдность поставки и ответственность

| Поставка | Зависимость | Законченный результат | Условие остановки |
| --- | --- | --- | --- |
| A1–A2 | baseline | mount/import validation + reviewed init plan | unresolved route/export → 0 writes |
| A3–A5 | A1 | CSS/auth/env/doctor + packed host launch | root side effect или auth bypass → не выпускать |
| B | A | list/detail/actions parity | field leak или hidden tab query → не переносить host |
| C | B | localized dashboards и widgets | неверные units/cohort/cache scope → не выпускать |
| D | A, совместно с B/C | reliable transport/docs/upgrade | package и source ведут себя по-разному → не выпускать |
| Host correctness | isolated seed | аналитика и drilldowns верны | без DB evidence не объявлять исправленным |
| Host migration | A+B, нужные C/D | приятная поддерживаемая админка | parity/UX regressions → оставить предыдущий маршрут |

Оценку длительности давать после A fixture и одного перенесённого user overview. Исходные 245/280 часов не подтверждены; matrix, CSS isolation и metric correctness могут стоить больше, чем сами widgets.

## 10. Покрытие friction log

| Пункты | Поставка и проверка |
| --- | --- |
| F1,F2,F3,F10,F17,F20 | A1/A2/A5: file/export resolution, route collision, doctor и supported matrix |
| F4,F11 | A4: existing auth detection, explicit dev opt-in, awaited role |
| F5,F6,F30,F34 | A3: nested layout, CSS isolation, nonce/RSC, actual packed compiler fixture |
| F7,F8,F9 | A5: env parity, cause/redaction, owned logger |
| F12,F13,F19,F31 | B: separate projection, query boundary, create diagnostics |
| F14,F16,F33 | B: actual row navigation + keyboard parity; F16 folded into F14 |
| F15,F18,F26,F27,F40 | B/C: singular, validation, labels, locale/formatters |
| F22,F29,F37,F38,F43 | B: identity, labels serialization, active-only tab and URL contract |
| F24,F39 | B/C: related pagination and table drilldown |
| F21,F25,F32,F41,F42 | C: typed tables, responsive header, freshness, chart states |
| F23,F35,F36 | D: owned Redis lifecycle and reusable publisher |
| F28 | D: driver reproduction before SQL helper |

## 11. Ближайший исполнимый цикл

В каждом пункте: regression test сначала → зафиксировать ожидаемый failure → minimal implementation → focused checks → package/build check → обновить delivery record. Не превращать весь roadmap в один непроверяемый commit.

- [x] **Маршруты установки.** Fixture содержит `src/app/(dashboard)/admin/page.tsx`. CLI init выбирает свободный mount либо explicit `--path`; `paths.admin` совпадает с page и outro. Negative nested/catch-all/private cases и `--dry-run` не меняют дерево. Рабочие файлы: `utils/admin-path.ts`, его tests, `commands/init.ts`, config templates.
- [x] **Imports.** Fixture FSD с `db/index.ts` и `schema/index.ts`, отсутствующим module и несколькими candidates. Generated config imports разрешаются до apply; JSONC/extends и named re-exports проверены. Рабочие файлы: `utils/detect.ts`, `utils/module-path.ts`, tests, init prompts.
- [x] **Диагностика причин.** Error с cause `ECONNREFUSED`, установленным DATABASE_URL и secret-bearing URL должен показать cause без credentials; цикл causes конечен. Рабочие файлы: `utils/fail.ts` и существующие tests.
- [x] **Async role.** Request с asynchronously resolved admin проходит, обычный user запрещён до adapter, rejected provider не вызывает DB. Рабочие файлы: `core/types/config.ts`, `next/runtime/request-setup.ts`, tests.
- [x] **Lazy detail.** Три tabs, включая hidden и throwing inactive renderer: только разрешённый requested tab исполняется; unknown falls back. Рабочие файлы: `pages/resource-detail.tsx`, `DetailTabsClient.tsx`, detail tests. Server regression tests и production host browser Back/Forward/reload проверены; отдельная UX-проверка медленного перехода остаётся частью общего loading-state аудита.
- [x] **CSP script.** `ThemeScript` forwards nonce; packed server import не имеет client-only call. Рабочие файлы: `react/_shell/ThemeScript.tsx`, exports/build entries и tests. Browser-safe subpath проверен настоящим Next render; это не заменяет отдельную проверку enforcement строгой CSP.

Команды локального baseline: `pnpm --filter @flowpanel/cli test:unit`, затем targeted tests соответствующего package; `pnpm typecheck`, `pnpm test:unit`, `pnpm check:docs`, `pnpm check:cli-package` перед закрытием поставки. Наличие зелёного subset не заменяет остальные gates.

## Источники внешних контрактов

- [Next: Project structure](https://nextjs.org/docs/app/getting-started/project-structure): route groups не добавляют URL segment, private folders не маршрутизируются.
- [Next: Environment variables](https://nextjs.org/docs/app/guides/environment-variables): env loading вне runtime через `@next/env`, порядок и режимы.
- [Tailwind: Detecting classes](https://tailwindcss.com/docs/detecting-classes-in-source-files): explicit sources для внешних библиотек. Работоспособность конкретной package layout всё равно проверяется compilation fixture.
