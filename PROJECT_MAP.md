# CyberCoderCRM — To'liq Texnik Xarita

> **Maqsad:** Loyihaning logikasi, dizayni va UI ni 80–90% qayta yozish jarayonida
> Claude uchun barcha endpointlar, modellar, frontend yo'llari va biznes-qoidalarni eslab qoluvchi yagona reference.
> Sana: 2026-06-23 holatiga ko'ra.

---

## 0. BACKEND NIMA UCHUN ISHGA TUSHMAYAPTI

**Sabab:** loyiha ildizida `.env` fayli **MAVJUD EMAS**. `npm start` / `nodemon` ishlamaydi chunki:

- `backend/server.js:157` → `mongoose.connect(process.env.MONGO_URI, ...)` — `undefined` ga ulanishga urinadi va xato beradi.
- `backend/middleware/auth.js:25` va `routes/auth.js:45,84` → `process.env.JWT_SECRET` bo'lmasa, JWT yarata olmaydi.
- `backend/utils/createSuperAdmin.js:11,12` → `SUPER_USERNAME` / `SUPER_PASSWORD` bo'lmasa shunchaki warning chiqaradi (server ishlaydi), lekin login imkonsiz.

**Kerakli `.env` shabloni (loyiha ildiziga qo'yish — `package.json` yonida, `.gitignore`-da allaqachon istisno qilingan):**

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB (Atlas yoki lokal)
MONGO_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/cybercodercrm?retryWrites=true&w=majority
# Yoki lokal:
# MONGO_URI=mongodb://127.0.0.1:27017/cybercodercrm

# JWT
JWT_SECRET=<kamida 32 belgili tasodifiy string>
JWT_EXPIRES_IN=30d

# SuperAdmin (server start-da avtomatik yaratadi/yangilaydi)
SUPER_USERNAME=superadmin
SUPER_PASSWORD=<kuchli parol>

# CORS (ixtiyoriy)
CLIENT_URL=http://localhost:3000

# Upload (ixtiyoriy, default 2MB)
MAX_UPLOAD_SIZE=2097152
```

Bundan tashqari `node --version` → **v24.13.0** (package.json: `>=18`). MongoDB ulanmaganida server `process.exit(1)` qiladi (`server.js:213`).

**Tekshirish:** `.env` yaratilgach `npm install && npm start`. Console-da `✅ MongoDB ulandi` va `🚀 Server ishlayapti! Port: 3000` ko'rinishi kerak.

---

## 1. STACK & ARXITEKTURA

- **Backend:** Node.js (≥18), Express 4, Mongoose 8, JWT, bcryptjs, multer, helmet, express-rate-limit, express-mongo-sanitize, xss-clean, hpp, compression, node-cron (hozir o'chirilgan).
- **Frontend:** Vanilla JS + Tailwind CSS (CDN) + Space Grotesk/JetBrains Mono shriftlar. Build yo'q — HTML/CSS/JS to'g'ridan-to'g'ri static serve qilinadi.
- **Multi-tenant:** Bitta MongoDB instance, har Business o'zining `_id` orqali ajratiladi (`businessId` har modelda + `businessScope` middleware).
- **Deploy:** Railway (nixpacks) + MongoDB Atlas. Server tanlovi: `node backend/server.js`. Procfile: `web: node backend/server.js`.
- **Static yo'llar:**
  - `GET /` → redirect `/admin/`
  - `GET /admin/...` → `client/admin/*`
  - `GET /superadmin/...` → `client/superadmin/*`
  - `GET /shared/...` → `client/shared/*` (asosan `translations.js`)
  - `GET /uploads/...` → biznes logo fayllari (`uploads/` papkasidan)
  - `GET /health` → `{ status: 'ok', mongoStatus, uptime }`

---

## 2. FOYDALANUVCHI ROLLARI

| Rol | Login orqali | Token payload | Asosiy panel |
|---|---|---|---|
| `superadmin` | username (lowercase) | `{ id, role: 'superadmin', username }` | `/superadmin/` — bizneslarni boshqarish |
| `admin` (biznes) | `business.login` (lowercase) | `{ id, role: 'admin', businessId, login }` | `/admin/` — xodim, yo'nalish, hisobot |

JWT lifetime: `JWT_EXPIRES_IN` (default `30d`). LocalStorage kalitlari:
- Admin: `cc_admin_token`, `cc_admin_user`
- SuperAdmin: `cc_super_token`, `cc_super_user`
- Til: `cc_lang` (`uz-lat` | `uz-cyr` | `ru`)
- Tema: `cc_theme` (`dark` | `light`)

---

## 3. MONGOOSE MODELLAR

Hammasi `OverwriteModelError`-dan himoyalangan: `mongoose.models.X || mongoose.model(...)`.

### 3.1 `SuperAdmin` (`backend/models/SuperAdmin.js`)
```
username  String, unique, lowercase, 3–50
password  String, bcrypt hashed
timestamps
```
Boshlash paytida `utils/createSuperAdmin.js` `.env` dagi `SUPER_USERNAME`+`SUPER_PASSWORD` bilan upsert qiladi (mavjud bo'lsa parolni `.env` bilan moslashtirib qayta hash qiladi).

### 3.2 `Business` (`backend/models/Business.js`) — TENANT
```
name              String 0–100
phone             String 0–20
login             String unique lowercase 3–50
password          String bcrypt hashed
logo              String|null  (fayl nomi, uploads/...)
defaultLanguage   enum: 'uz-lat'|'uz-cyr'|'ru'  default 'uz-lat'
note              String 0–500
enabledModules    [String]  (config/modules.js dagi key'lar)
enabledWorkTypes  { piecework: Bool, daily: Bool }  default true/true
status            enum: 'active'|'suspended'  default 'active'
timestamps
```
Indexes: `status`, `createdAt: -1`.

### 3.3 `Employee` (`backend/models/Employee.js`)
```
businessId  ObjectId→Business  index
firstName   String 0–50
lastName    String 0–50  (UI da '-' bo'sh marker sifatida ishlatiladi)
code        String 0–50   (biznesda unique-ish — runtime tekshiriladi)
phone       String 0–20
status      'active'|'deleted'  default 'active'
deletedAt   Date|null
timestamps
```
Indexes: `(businessId, code)`, `(businessId, status)`.

> **Soft delete:** xodimni o'chirganda `status='deleted'`, kod oy oxirigacha `ReservedCode` collection'iga ko'chiriladi (`routes/employees.js:155-167`).

### 3.4 `ReservedCode` (`backend/models/ReservedCode.js`)
```
businessId      ObjectId→Business
code            String
reservedUntil   Date  (TTL: expires:0 — vaqti kelganda Mongo o'zi o'chiradi)
employeeData    { firstName, lastName, phone }
```

### 3.5 `Department` (`backend/models/Department.js`)
```
businessId       ObjectId→Business
name             String 0–100
description      String 0–500
type             enum: 'piecework'|'daily'   ← bo'lim turi
directionCount   Number  (runtime'da to'ldiriladi — schema cache uchun)
timestamps
```
Indexes: `(businessId, type)`.

### 3.6 `Direction` (`backend/models/Direction.js`)
```
businessId      ObjectId→Business
departmentId    ObjectId→Department
name            String 0–100
type            enum: 'piecework'|'daily'   ← yo'nalish turi (= department.type)
price           Number ≥0  (piecework: so'm/dona, daily: so'm/smena)
currentPrice    Number  (backward-compat — DB ga ham yoziladi)
pieceworkEnabled, pieceworkPrice, dailyEnabled, dailyPrice  ← ESKI fieldlar (pre-save hook migratsiyaga ishlatadi)
priceHistory    [{ price, changedAt }]
isArchived      Bool  (soft delete)
archivedAt      Date|null
timestamps
```
Indexes: `(businessId, departmentId, type, isArchived)`, `(businessId, type, isArchived)`.

> **Type o'zgartirish ruxsat etilmaydi** — `routes/directions.js:131`. Foydalanuvchiga: "O'chirib qayta yarating".

### 3.7 `DailyAssignment` (`backend/models/DailyAssignment.js`) — KUNLIK BIRIKTIRISH
```
businessId         ObjectId→Business
employeeId         ObjectId→Employee
directionId        ObjectId→Direction
dateString         String "YYYY-MM-DD"   ← TIMEZONE-SAFE asosiy kalit
date               Date
shift              0.5|1
type               'piecework'|'daily'
dailyAmount        Number  (legacy)
priceSnapshot      Number  (assign vaqtidagi yo'nalish narxi)
earning            Number  (yakuniy daromad — recalc keyin)
fairShare          Number  (piecework: teng ulush)
bonus              Number  (manual > fairShare bo'lganda farq)
isManual           Bool    (admin earning ni qo'lda kiritganmi)
manualAmount       Number|null
employeeSnapshot   { firstName, lastName, code }
directionSnapshot  { name, departmentName, type, price }
timestamps
```
Indexes (unique): `(businessId, employeeId, dateString)` — bir xodim bir kunda faqat bitta yo'nalishda.
`(businessId, dateString: -1)`, `(businessId, directionId, dateString)`.

Migratsiya: `runMigration()` startda eski `(employeeId, date)` unique indexini o'chiradi va `dateString` yo'q yozuvlarga to'ldiradi.

### 3.8 `DailyProduct` (`backend/models/DailyProduct.js`) — KUN BO'YICHA UMUMIY MAHSULOT
```
businessId         ObjectId→Business
directionId        ObjectId→Direction  (optional — odatda ishlatilmaydi)
dateString         String "YYYY-MM-DD"
date               Date
productName        String 0–100
quantity           Number ≥0
directionSnapshot  { name, price }
timestamps
```
Migratsiya: shu kabi — eski mahsulotlarga `dateString` qo'shadi.

### 3.9 `SalaryPayment` (`backend/models/SalaryPayment.js`) — TO'LOV
```
businessId        ObjectId→Business
employeeId        ObjectId→Employee
assignmentId      ObjectId→DailyAssignment   ← qaysi kunga to'lov
dateString        String  (qulaylik uchun)
employeeSnapshot  { firstName, lastName, code }
amount            Number ≥0
paidAt            Date  (default now)
note              String
timestamps
```
Unique: `(businessId, assignmentId)` — bir kunga bitta to'lov.
> **DIQQAT — bug zonasi:** `routes/monthlyReport.js POST /pay` har xodim uchun *bitta* yozuv yaratadi (`amount` bilan), lekin **`assignmentId` ni umuman to'ldirmaydi** (`monthlyReport.js:191-203`). Bu schemaga `assignmentId: required` qoidasiga zid — `insertMany` xato beradi yoki `assignmentId: null` bilan ikkinchi yozuvda unique violation chiqadi. Qayta yozishda **albatta** kelishib olish kerak: to'lov xodimning ochiq qoldig'iga umuman (assignmentId YO'Q) yoki har assignmentga teng tarqatib qo'yiladimi.

### 3.10 `Archive` (`backend/models/Archive.js`) — DAVR SNAPSHOT
```
businessId    ObjectId→Business
periodLabel   String   ("YYYY-MM-DD → YYYY-MM-DD")
startDate     Date
endDate       Date
archivedAt    Date
data          { assignments: [...], products: [...] }
stats         { totalEarnings, totalEmployeesWorked, totalShifts, totalProducts }
timestamps
```
Bu `POST /api/monthly-report/archive` orqali yaratiladi (assignments va products butunlay nusxa qilinadi — JSON blob).
> Ammo `GET /api/archive` aslida bu `Archive` collection'idan EMAS, balki `SalaryPayment` collection'idan oydan-oyga guruhlangan ma'lumotni qaytaradi (`routes/archive.js`). Ya'ni "Arxiv" sahifasi To'lovlar Tarixi ekan. Bu chalkash nomlash — qayta dizaynda aniqlash kerak.

---

## 4. MODULLAR (`backend/config/modules.js`)

`enabledModules` arrayga shu kalitlar yoziladi:

| key | name | default | order | parent |
|---|---|---|---|---|
| `employees` | Xodimlar | true | 1 | — |
| `directionsPiecework` | Dona ish | true | 2 | directions |
| `directionsDaily` | Kunlik ish | true | 3 | directions |
| `dailyReport` | Kunlik Hisobot | true | 4 | — |
| `monthlyReport` | Oylik Hisobot | true | 5 | — |
| `archive` | Arxiv | false | 6 | — |
| `directions` *(hidden)* | Yo'nalishlar (eski) | false | 99 | — |

`getAllModules()` `hidden:true` ni qaytarmaydi (eski `directions` SuperAdmin UI da ko'rinmaydi).
Eski biznes `enabledModules: ['directions']` bilan kelsa — admin frontend uni avtomatik `['directionsPiecework','directionsDaily']` ga aylantiradi (`client/admin/app.js:337-341`). Backend ham `directionsPiecework`/`directionsDaily` ruxsatini eski `directions` flagiga moslab tekshiradi (`routes/directions.js:18-20`, `routes/departments.js:18-19`).

---

## 5. MIDDLEWARE STACK (har request)

```
trust proxy 1
helmet (CSP: cdn.tailwindcss.com, cdn.jsdelivr.net, unpkg.com, fonts.googleapis.com)
cors (allowedOrigins: CLIENT_URL, *.railway.app, *.vercel.app, localhost:3000/5173 — REGEX/EXACT)
   NB: server.js:75 «bloklangan» originni HAM o'tkazib yuboradi (warn-only)
express.json({ limit: '10mb' })
express.urlencoded({ extended:true, limit:'10mb' })
compression
mongoSanitize
xss
hpp
generalLimiter   500/15min on /api/*
authLimiter      10/15min on /api/auth/login (skip successful)
path-traversal guard ('..', '%2e%2e' → 400)
```

Marshrut-darajadagi middlewares:

- **`verifyToken`** (`middleware/auth.js`) — `Authorization: Bearer <jwt>`, `req.user = decoded`. 401 javoblar: `'Token yo\'q'`, `'Token muddati tugagan'`, `'Token noto\'g\'ri'`.
- **`requireSuperAdmin`** / **`requireAdmin`** — `role` tekshiruvi.
- **`businessScope`** (`middleware/businessScope.js`) — SuperAdmin uchun `req.businessId = req.query/body.businessId || null`; Admin uchun `req.businessId = req.user.businessId`.
- **`requireModule(key)`** (`middleware/requireModule.js`) — biznesning `enabledModules`-ida kerakli kalit borligini va `status != suspended` ekanini tekshiradi. SuperAdmin avtomatik o'tadi.
- **`upload`** (`middleware/upload.js`) — multer disk storage, faqat `image/png|jpeg|jpg|webp|gif`, default 2MB cheklov, fayl nomi `${timestamp}-${randomHex}.ext`.

---

## 6. BARCHA API ENDPOINTLAR

Hammasi `/api/...` prefiksida. Header: `Authorization: Bearer <token>` (login va `/health` dan tashqari).

### 6.1 Auth — `backend/routes/auth.js`
| Method | Path | Body / Query | Javob |
|---|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` | `{ success, token, user }` — `user` ichida `role`, admin uchun: `enabledModules`, `enabledWorkTypes`, `defaultLanguage`, `logo`. **Tartib:** avval SuperAdmin (`SuperAdmin.findOne`), keyin Business (`Business.findOne({login})`). Suspended biznes 403 beradi. |
| GET  | `/api/auth/me`    | — (token) | superadmin: `{ id, username, role }`. admin: `{ id, login, name, logo, phone, role, enabledModules, enabledWorkTypes, modulesInfo, defaultLanguage }`. Suspended bo'lsa 403. |

### 6.2 SuperAdmin — `backend/routes/superadmin.js`
Hammasi `verifyToken + requireSuperAdmin`.
| Method | Path | Body / Query | Izoh |
|---|---|---|---|
| GET    | `/api/superadmin/modules`         | — | Barcha hidden bo'lmagan modullar ro'yxati. |
| GET    | `/api/superadmin/stats`           | — | `{ totalBusinesses, activeBusinesses, suspendedBusinesses, totalEmployees }`. |
| GET    | `/api/superadmin/businesses`      | — | Bizneslar ro'yxati + har biriga `stats.employees`. |
| POST   | `/api/superadmin/businesses`      | `multipart/form-data`: `name, phone, login, password, defaultLanguage?, note?, enabledModules?(JSON string), logo?(file)` | Yangi biznes. `enabledModules` bo'sh bo'lsa default modullar. |
| PUT    | `/api/superadmin/businesses/:id`  | multipart, fieldlar ixtiyoriy | Biznesni yangilash. `password` bo'sh bo'lsa o'zgarmaydi. |
| POST   | `/api/superadmin/businesses/:id/suspend` | — | `status` ni `active <-> suspended` ga aylantiradi. |
| PUT    | `/api/superadmin/businesses/:id/modules` | `{ enabledModules: [String] }` | Array bo'lishi kerak. |
| DELETE | `/api/superadmin/businesses/:id`  | — | **CASCADE:** Employee, Direction, DailyAssignment, DailyProduct, ReservedCode, Archive, Business o'chiriladi. *(Department va SalaryPayment cascade'ga kirmagan — bug.)* |

### 6.3 Employees — `backend/routes/employees.js`
Stack: `verifyToken + requireAdmin + businessScope + requireModule('employees')`.
| Method | Path | Query / Body | Izoh |
|---|---|---|---|
| GET    | `/api/employees`             | `?search=<text>` (firstName/lastName/code/phone bo'yicha regex `i`) | `status != deleted` xodimlar. |
| POST   | `/api/employees`             | `{ firstName, lastName, code, phone? }` | Kod biznesda band yoki `ReservedCode`-da bo'lmasligi shart. |
| PUT    | `/api/employees/:id`         | `{ firstName?, lastName?, code?, phone? }` | Kod o'zgarsa qayta tekshiriladi. |
| DELETE | `/api/employees/:id`         | — | Soft delete: `status='deleted'`, `code` oy oxirigacha `ReservedCode`-ga qo'yiladi. |

### 6.4 Departments — `backend/routes/departments.js`
Stack: `verifyToken + requireAdmin + businessScope` + maxsus `checkModuleAccess(type)` (`directionsPiecework`/`directionsDaily` yoki eski `directions`).
| Method | Path | Query / Body | Izoh |
|---|---|---|---|
| GET    | `/api/departments`             | **MAJBURIY** `?type=piecework\|daily` | Bo'limlar + har birida `directionCount`. |
| POST   | `/api/departments`             | `{ name, description?, type }` | `type` bo'lim turini belgilaydi (keyin o'zgarmaydi). |
| PUT    | `/api/departments/:id`         | `{ name?, description? }` | `type` o'zgartirilmaydi. |
| DELETE | `/api/departments/:id`         | `?force=true` | Yo'nalishlari bo'lsa `force=true` kerak — `Direction.updateMany({isArchived:true})`, keyin bo'lim o'chadi. |

### 6.5 Directions — `backend/routes/directions.js`
Xuddi shu stack.
| Method | Path | Query / Body | Izoh |
|---|---|---|---|
| GET    | `/api/directions`            | **MAJBURIY** `?type=piecework\|daily`, optional `&departmentId=<id>` | `isArchived != true`. `populate('departmentId','name')`. |
| POST   | `/api/directions`            | `{ name, departmentId, type, price }` | Yangi yo'nalish, `price` ≥0. `currentPrice` ham yoziladi (backward-compat). |
| PUT    | `/api/directions/:id`        | `{ name?, departmentId?, type?(faqat oldingisi bilan tengi), price? }` | Narx o'zgarsa eski narx `priceHistory`-ga push qilinadi. Type o'zgartirish 400. |
| DELETE | `/api/directions/:id`        | — | Soft archive: `isArchived=true`, `archivedAt=now`. |

### 6.6 Daily Report — `backend/routes/dailyReport.js`
Stack: `verifyToken + requireAdmin + businessScope + requireModule('dailyReport')`.
Tashkent timezone helper: `todayDateString()` `now + 5h` ni `YYYY-MM-DD` ga aylantiradi. Kelajak kun **rad etiladi**.
| Method | Path | Query / Body | Izoh |
|---|---|---|---|
| GET    | `/api/daily-report`                       | `?date=YYYY-MM-DD` (default bugun) | `{ date, dateStr, assigned[], unassigned[], products[], stats:{ totalAssigned, totalUnassigned, totalEarning, totalProducts } }`. `assigned` `.populate('employeeId','firstName lastName code phone status')`. `unassigned` = `status!='deleted'` minus biriktirilganlar. |
| POST   | `/api/daily-report/assign`                | `{ employeeId, directionId, shift(0.5|1), date? }` | Type va narxni yo'nalishdan oladi. Daily: `earning = price * shift`. Piecework: `earning=0`, lekin keyin `recalculateForDate` chaqiriladi. Bir xil sanada bir xodim ikkinchi marta biriktirilmaydi. |
| PUT    | `/api/daily-report/assign/:id/earning`    | `{ earning }` | Qo'lda kiritish — `isManual=true`, `manualAmount=earning`. Piecework bo'lsa `recalculateForDate` qayta. |
| DELETE | `/api/daily-report/assign/:id`            | — | Biriktirishni olib tashlash. Piecework edi → recalc. |
| POST   | `/api/daily-report/products`              | `{ productName, quantity, date? }` | Umumiy kunlik mahsulot. Hammasidan keyin `recalculateForDate`. |
| PUT    | `/api/daily-report/products/:id`          | `{ productName?, quantity?, date? }` | Sana ham o'zgartirilishi mumkin (kelajak emas). Recalc. |
| DELETE | `/api/daily-report/products/:id`          | — | O'chirish + recalc. |
| POST   | `/api/daily-report/recalculate`           | `{ date? }` | Qo'lda qayta hisoblash. |

### 6.7 Monthly Report — `backend/routes/monthlyReport.js`
Stack: same + `requireModule('monthlyReport')`.
| Method | Path | Query / Body | Izoh |
|---|---|---|---|
| GET    | `/api/monthly-report` | **MAJBURIY** `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&code?=<empCode>` | Xodimlar bo'yicha guruhlangan: `{ _id, firstName, lastName, code, totalDays, totalShifts, totalEarning, totalPaid, remaining, assignments[] }`. Stats: `{ totalEarning, totalEmployees, totalProductCount, totalAssignments, totalPaid }`. To'lovlarni `SalaryPayment.dateString`-dan oladi. |
| POST   | `/api/monthly-report/pay`     | `{ employeeIds: [String], amount, dateString? }` | **Har** xodim uchun *bitta* `SalaryPayment.insertMany` yozuvi (employeeId, amount, dateString=bugun) — **`assignmentId` qo'yilmagan ⇒ schema validation buziladi**. *Qayta yozishda bunga e'tibor.* |
| POST   | `/api/monthly-report/archive` | `{ startDate, endDate }` | Davrdagi `assignments` va `products` ni `Archive` document'iga saqlaydi + stats. |

### 6.8 Archive — `backend/routes/archive.js`
Stack: same + `requireModule('archive')`. Aslida bu **to'lovlar tarixi**, `Archive` collection EMAS.
| Method | Path | Query | Izoh |
|---|---|---|---|
| GET    | `/api/archive` | `?month=YYYY-MM`, `?code=<empCode>`, `?startDate&endDate` | `SalaryPayment` ni oyga guruhlab qaytaradi: `{ months: [{ periodMonth, payments[], totalAmount, totalEmployees }], stats: {...} }`. Eslatma: `month` filter `dateString` regex bilan. |
| DELETE | `/api/archive/:id` | — | Bitta `SalaryPayment` ni o'chiradi. |

### 6.9 Health — non-API
| Method | Path | Izoh |
|---|---|---|
| GET | `/health` | `{ status:'ok', timestamp, uptime, mongoStatus }` — auth-siz. |
| GET | `/` | 302 → `/admin/`. |

### 6.10 404 va Error handler
- `app.use((req,res)=>res.status(404).json({error:'Topilmadi'}))`
- Global error handler: `ValidationError` → 400, `MulterError` → 400, qolgan: 500. Console-ga `console.error` bilan log.

---

## 7. BIZNES LOGIKASI — PIECEWORK QAYTA HISOBLASH

`services/recalculate.js` `recalculateForDate(businessId, dateStr)`:

1. Shu kunning `DailyAssignment` lar va `DailyProduct` lar (umumiy `quantity = totalQuantity`) olinadi.
2. Yo'nalishlarning narxlari yoki snapshot'idan `directionMap` quriladi.
3. **Daily** assignmentlar: `priceSnapshot = price`, `fairShare = price * shift`, `earning = price * shift` (agar `isManual` bo'lmasa). Bonus = 0.
4. **Piecework** assignmentlar yo'nalish bo'yicha guruhlanadi. Har guruh uchun:
   - `totalAmount = totalQuantity * pieceworkPrice`
   - `totalShifts = sum(group.shift)`
   - `oneShiftPrice = totalAmount / totalShifts`
   - Manual'lar: `fairShare = oneShiftPrice * shift`, `earning = manualAmount`, `bonus = max(0, manualAmount - fairShare)`.
   - Manual'lar olgan summa `totalAmount`-dan ayriladi → non-manual'larga `(totalAmount - sum(manualAmounts)) / nonManualShifts` bo'yicha taqsimlanadi.
   - Bonus = `max(0, earning - fairShare)` — har holatda saqlanadi.
5. `DailyAssignment.bulkWrite` orqali yangilanadi.

> `totalAmount = umumiy mahsulot × shu yo'nalish narxi` — boshqa yo'nalishlardagi mahsulotlar **alohida hisoblanmaydi**: ya'ni umumiy daromad bir kunda yagona `totalQuantity` ga bog'liq. UI dizaynda bu nuance ko'rinmasa, foydalanuvchi chalkashishi mumkin.

---

## 8. FRONTEND — `/admin/` (BIZNES ADMINI)

### 8.1 Fayllar
- `client/admin/index.html` — 1678 qator, barcha modal va sahifalar SHU FAYLDA, sahifa-almashinish CSS `.page.active` orqali (SPA emas — sahifalar dom'da, lekin yashirin).
- `client/admin/app.js` — 1989 qator, hech qanday build, IIFE ham yo'q — `state` global, har modul `setupX()` da DOM listener boglaydi.

### 8.2 Globals
```
API_BASE   = window.API_BASE || ''   (har HTML pastida o'rnatiladi)
STORAGE    = { token: 'cc_admin_token', user: 'cc_admin_user' }
MODULE_ICONS = { employees, directions, directionsPiecework, directionsDaily, dailyReport, monthlyReport, archive }
state      = { token, user, business, currentPage, confirmCallback,
                employees,
                departments_pw, directions_pw, selectedDepartmentId_pw,
                departments_d,  directions_d,  selectedDepartmentId_d,
                dirModalType, deptModalType,
                dailyData, dailyDate, monthlyData, archives,
                _assignDirections,
                editingEmpId, editingDirId, editingDeptId, editingProductId }
```

### 8.3 Asosiy funksiyalar (`app.js`)
**Utility:** `escapeHtml`, `formatMoney` (`Intl 'uz-UZ'`), `todayISO`, `formatDate({withTime?})`, `toast(msg, 'success'|'error')`, `api(endpoint, opts)` — JSON yoki FormData detect, 401 da `logout()`.
**Theme:** `getCurrentTheme`, `setTheme`, `toggleTheme`, `updateThemeButton`, `setupThemeToggle`. Saqlash: `localStorage.cc_theme`.
**i18n:** `t(key)` — `window.TRANSLATIONS[lang][key]`. `setupLangSwitchers` `[data-lang]` tugmalar.
**Auth:** `setupLogin` (`#loginForm`), `logout` (storage tozalash + redirect login), `applyBranding(business)` — logo, name, document.title.
**Sidebar:** `buildSidebar(enabledModules, modulesInfo)` — guruhlash: `directionsPiecework`+`directionsDaily` "Yo'nalish" parent ostida toggle'lanadi. Eski `directions` `directionsPiecework + directionsDaily` ga aylantiriladi. `setupSidebar` — menu toggle (mobile), logout.
**Router:** `navigateTo(pageKey)` — `.page` element'ini active qiladi va sahifa loader chaqiradi (`loadEmployees`/`loadDepartmentsForType('piecework'|'daily')`/`loadDailyReport`/`initMonthlyReport`/`loadArchive`).
**Employees:** `loadEmployees`, `renderEmployees`, `setupEmployeesPage`, `openEmpEdit`, `confirmDeleteEmployee` — `#empSearch` 300ms debounce.
**Departments/Directions (per type):** `suffixForType('daily'|'piecework')` → `_d` yoki `_pw`. Holat va DOM `${selector}_pw`/`${selector}_d` bilan ajratilgan. `selectDepartment` → tegishli yo'nalishlarni yuklaydi.
**Daily Report:**
- `loadDailyReport(dateStr)` — `/api/daily-report?date=`.
- `renderDailyReport(data)` — assigned list (badge `KUNLIK` daily uchun, `bonus-badge`/`deficit-badge`), unassigned, mahsulotlar jadvali.
- `openAssignModal(employeeId, name)` — workType radio (`piecework`/`daily`) faqat yoqilgan bo'lsa ko'rinadi, depto select keyin direction select.
- `setupEarningEdit` — qo'lda earning kiritish; piecework manual entry → fairShare dan kam bo'lsa "deficit" sifatida ko'rinadi.
- Sana navigatsiyasi: `datePrevBtn`, `dateNextBtn`, `dateTodayBtn`, `dailyDateInput` (max=today).
**Monthly Report:**
- `initMonthlyReport` — defaultlar: `monthStart=oy boshi`, `monthEnd=today`.
- `loadMonthlyReport` — `/api/monthly-report?startDate&endDate&code?`.
- `renderMonthlyReport` — checkbox bilan jadval (Smena, Kun, Daromad, Berildi, Qoldiq), "To'lash" tugmasi har xodim uchun. Multi-select to'lov: `payMultipleEmployees`.
- Date preset tugmalari: `today`, `yesterday`, `week`, `month`.
- `exportMonthlyToExcel` — `XLSX.utils.book_new()` orqali. **DIQQAT:** `index.html`-da XLSX kutubxonasi yuklangani aniq emas — `typeof XLSX === 'undefined'` tekshiruvi bor. CDN: `https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js` qo'yish lozim.
**Archive:** `loadArchive`/`renderArchive` — gridda kichik kartochkalar.
**Modallar:** `openModal(id)`, `closeModal(id)`, `setupModalCloses` ([data-close], backdrop click), `openConfirm(title,text,cb)`/`setupConfirmModal` (`#confirmModal`).

### 8.4 HTML strukturasi (`index.html`)
- Tashqi: bg-mesh + bg-grid + orbs (purple glass effekti).
- 874–931: **Login view** (`#loginView` → form `#loginForm`).
- 932+: **App view** (`#appView`):
  - **Aside** `#sidebar` — logo `#businessLogo`, ism `#businessName`, nav `#sidebarNav` (dinamik), theme toggle, lang buttons, logout.
  - **Main** `#mainContent`:
    - Header: `#pageTitle`, `#pageSubtitle`, `#headerActions`.
    - `#pageContent` ichida:
      1. `data-page="employees"` — `#empSearch`, `#empAddBtn`, `#empTableContainer`.
      2. `data-page="directionsPiecework"` (`_pw` suffix) — `#deptAddBtn_pw`, `#departmentsContainer_pw`, `#directionsSection_pw`, `#dirAddBtn_pw`, `#dirTableContainer_pw`.
      3. `data-page="directionsDaily"` (`_d` suffix) — xuddi shu, faqat suffix `_d`.
      4. `data-page="dailyReport"` — sana navigatori, stat cards (`#dailyStatAssigned/Unassigned/Earning/Products`), `#productsContainer`, `#assignedList`, `#unassignedList`, `#productAddBtn`.
      5. `data-page="monthlyReport"` — `#monthStart`, `#monthEnd`, `#monthCode`, `#monthLoadBtn`, presetlar (`[data-preset]`), stat cards (`#monthStatEarning/Employees/Paid/Products`), `#monthActionBar`, `#monthSelectedCount`, `#monthPayBtn`, `#monthExportBtn`, `#monthResultsContainer`.
      6. `data-page="archive"` — `#archiveResultsContainer`.
- Modallar (1336–1670 qatorlari):
  - `#empModal` — `#empForm` (firstName, lastName, code, phone).
  - `#deptModal` — `#deptForm` (name, description).
  - `#dirModal` — `#dirForm` (name, departmentId select, hidden `#dirType`, price). Badge type bo'yicha ranglanadi (`applyDirModalTypeStyles`).
  - `#assignModal` — `#assignForm` (workType radio, depto select, direction select, shift radio). Type radiosi `state.business.effectiveModules` asosida ko'rinadi/yashirinadi.
  - `#productModal` — `#productForm` (productName, qty).
  - `#earningModal` — `#earningForm` (xodim infosi + `#earningAmount`).
  - `#payModal` — `#payForm` (tanlangan xodimlar + amount).
  - `#confirmModal` — universal confirm (`#confirmTitle`, `#confirmText`, `#confirmOkBtn`).
- Logout barcha `cc_admin_*` keylarni tozalaydi va loginga qaytadi.

### 8.5 CSS o'zgaruvchilari (har ikkala panelda bir xil naming)
```
--bg-primary       (dark: #0a0a0f / light: #f1f3f8)
--bg-secondary     (dark: #12121a / light: #ffffff)
--accent           (dark: #8b5cf6 / light: #6d28d9)
--text-primary, --text-secondary
--glass-bg, --glass-border, --sidebar-bg, --input-bg, --input-border
```
Sinflar: `.glass`, `.btn-primary`, `.btn-ghost`, `.btn-icon`, `.btn-icon.danger`, `.input-field`, `.card`, `.stat-card`, `.biz-card`, `.dept-card`, `.modal-backdrop`, `.modal-content`, `.nav-item`, `.nav-sub-item`, `.nav-group-toggle`, `.toast.toast-success/error`, `.spinner`, `.badge`, `.bonus-badge`, `.deficit-badge`, `.daily-badge`.

---

## 9. FRONTEND — `/superadmin/`

### 9.1 Fayllar
- `client/superadmin/index.html` — 714 qator, single-page (faqat "Bizneslar" sahifa).
- `client/superadmin/app.js` — 812 qator.

### 9.2 Globals
```
STORAGE = { token: 'cc_super_token', user: 'cc_super_user' }
state = { token, user, businesses, editingId, deleteTargetId,
          logoFile, selectedModules (Set), allModules, _dirGroupOpen }
```

### 9.3 Funksiyalar
- Theme: aynan admin kabi.
- `setupLogin` (`#loginForm`), `logout`, `showLogin`/`showApp`, `setupSidebar` (mobile menu).
- `loadStats`, `loadModules`, `loadBusinesses` — har 60 soniyada `loadStats` qaytadan.
- `renderBusinesses(arr)` → `renderBusinessCard(b, idx)` — biz card: logo, name, login, phone, employee/module count, status badge, Edit/Suspend/Delete tugmalari.
- `setupSearch` — name/login/phone bo'yicha clientda filtr.
- `renderModulesInForm` — modullar grid. `directionsPiecework`+`directionsDaily` collapse'lanuvchi "Yo'nalish" parent ostida (`_dirGroupOpen` state).
- `openCreateModal`, `openEditModal(id)`, `closeBusinessModal`, `resetLogoPreview`.
- `setupBusinessModal` — form submit FormData ga yig'ilib `/api/superadmin/businesses` (POST) yoki `/:id` (PUT) ga yuboriladi. Logo: max 2MB, MIME tekshiriladi.
- `toggleSuspend(id)` — confirm + `/suspend` endpoint.
- `confirmDelete(id, name)` + `setupConfirmModal` — `DELETE /:id`.
- `initApp` — `/api/auth/me` superadmin tekshiruvi, modullarni va statlarni yuklaydi.

### 9.4 HTML elementlar
- `#loginView` / `#appView`.
- Sidebar: logo, "Bizneslar" nav-item (statik), theme toggle, logout. (Boshqa sahifa yo'q.)
- Header: `#pageTitle="Bizneslar"`, `#createBtn`.
- Stats: `#statTotal`, `#statActive`, `#statSuspended`, `#statEmployees`.
- `#searchInput`, `#loadingState`, `#emptyState`, `#emptyCreateBtn`, `#businessesGrid`.
- `#businessModal`:
  - `#modalTitle` ("Yangi biznes" / "Biznesni tahrirlash")
  - Form fieldlari: `#f_name`, `#f_phone`, `#f_login`, `#f_password` (+ `#passwordLabel`, `#passwordHint`), `#f_language` (select uz-lat/uz-cyr/ru), `#f_note`, `#logoInput`/`#logoPreview`, `#modulesContainer`.
  - `#submitModalBtn` + spinner.
- `#confirmModal`: `#confirmText`, `#confirmDeleteBtn`, `#cancelConfirmBtn`.

---

## 10. TARJIMALAR — `client/shared/translations.js`

Object `TRANSLATIONS` 3 til: `uz-lat`, `uz-cyr`, `ru` (har biri 660+ qator). Asosiy namespace prefikslari: `common.*`, `login.*`, `nav.*`, `emp.*`, `dir.*`, `dept.*`, `daily.*`, `month.*`, `archive.*`, `msg.*`, `theme.*`. Helper:
- `getCurrentLang()` — `localStorage.cc_lang || 'uz-lat'`
- `setLang(lang)` — saqlash, `<html lang>` o'zgartirish, `applyTranslations()` chaqirish.
- `_t(key)` ichki, lekin admin app'da `t()` o'z funksiyasi orqali ishlatiladi (translations.js ham `window.TRANSLATIONS` exposes).
- `applyTranslations()` — `[data-i18n]` (textContent) va `[data-i18n-placeholder]` (placeholder) elementlarni alfavitga ko'ra to'ldiradi. Admin va Super HTML-da `data-i18n` keng ishlatilgan (faqat super-da kamroq).

---

## 11. CRON / FON XIZMATLARI

`backend/services/dailyResetJob.js`:
```js
function start() {
  console.log("ℹ️  Kunlik reset: Admin qo'lda boshqaradi (cron o'chirilgan)");
}
```
Aslida hech narsa qilmaydi. Faqat compat uchun saqlangan, `server.js:201` chaqiradi. `node-cron` dependency hozir ishlatilmaydi (lekin paket o'rnatilgan).

---

## 12. UPLOADS

- `uploads/` papkasi avtomatik yaratiladi (`server.js:120` va `middleware/upload.js:12`).
- Static yo'l: `/uploads/<fayl>` — `Cross-Origin-Resource-Policy: cross-origin`, 7d cache.
- Fayl nomi: `${timestamp}-${randomHex}.<ext>`.
- Yo'l biznes logosi sifatida `Business.logo`-da saqlanadi.
- Eski biznes o'chirilganda **logo fayli diskdan o'chirilmaydi** — bu yig'iladigan axlat (qayta dizaynda fix qilish).

---

## 13. XAVFSIZLIK NUANSLARI

1. **Helmet CSP** `cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com` ga ruxsat. Inline-style/script yoqilgan.
2. **CORS** allow-list mavjud, lekin server.js:75 da hatto mos kelmagan origin ham `callback(null, true)` bilan o'tkaziladi — effektiv ravishda allow-all. (Audit'da diqqat.)
3. **Rate limit** umumiy 500/15min, login 10/15min (muvaffaqiyatli urinish hisobga olinmaydi).
4. **JWT** 30 kun, refresh yo'q.
5. **Password hash** bcrypt cost 10.
6. **Soft sanitize:** `express-mongo-sanitize`, `xss-clean`, `hpp`. Lekin `escapeHtml` faqat frontend-da.
7. **Tenant izolyatsiyasi:** `businessScope` middleware orqali har query'da `businessId` filtr. SuperAdmin uchun `?businessId=...` qabul qilinadi.

---

## 14. MA'LUM BUGLAR / TEXNIK QARZ

| # | Joy | Muammo |
|---|---|---|
| 1 | `routes/monthlyReport.js POST /pay` | `SalaryPayment.assignmentId` to'ldirilmaydi, lekin schema'da `required` va `(businessId, assignmentId)` unique. Ikkinchi to'lov xato beradi. |
| 2 | `routes/superadmin.js DELETE /:id` | `Department` va `SalaryPayment` cascade'ga kirmagan. |
| 3 | `routes/archive.js` | Aslida `SalaryPayment` ni qaytaradi, lekin `Archive` modeli alohida ham bor — chalkash domen. UI da "Arxiv" sahifasi to'lovlar tarixini ko'rsatadi, lekin `POST /api/monthly-report/archive` mutlaqo boshqa Archive yozadi va hech qayerda ko'rinmaydi. |
| 4 | `client/admin/app.js:1864-1867` | `archive.year`, `archive.month`, `archive.employeeCount`, `archive.totalPaid` ni o'qiydi, lekin API `{ months: [...] }` qaytaradi — sahifa har doim bo'sh ko'rinishi mumkin. |
| 5 | `server.js CORS` | Bloklangan originni ham `callback(null, true)` bilan o'tkazib yuboradi (effective allow-all). |
| 6 | `Direction.pre('save')` | `currentPrice` va `price`-ni sinxronlash murakkab — eski/yangi yozuvlarni ikki tomonlama tutib turish. Migratsiya bir marta o'tib, eski fieldlarni o'chirib tashlash mumkin. |
| 7 | `uploads/` | Biznes/logo o'chirilsa, eski fayllar diskdan o'chmaydi. |
| 8 | `dailyResetJob` no-op | `services/dailyResetJob.js` faqat console.log — `node-cron` dependency ortiqcha. |
| 9 | `validate: { xForwardedForHeader: false, trustProxy: false }` | Railway uchun rate-limit ogohlantirishlarini bostiradi, lekin agar `trust proxy` to'g'ri bo'lmasa, x-forwarded-for ishonchsiz manbadan kelishi mumkin. |
| 10 | `lastName: '-'` marker | Frontend bo'sh familiyani `-` bilan to'ldiradi, backend uni shu holicha saqlaydi — UI da har joyda `lastName !== '-'` shartiga qarab tozalanadi. |

---

## 15. FOYDALANUVCHI OQIMLARI

### A. Birinchi sozlash
1. `.env` yarat → `npm install` → `npm start` → `✅ MongoDB` + `✅ SUPERADMIN YARATILDI` log.
2. `http://localhost:3000/superadmin/` → SuperAdmin login.
3. "Yangi biznes" → name/phone/login/password + modullar (default: hammasi `archive`-dan tashqari).
4. Yangi biznes login bilan `http://localhost:3000/admin/` ga kirishi mumkin.

### B. Kundalik admin oqimi
1. **Yo'nalish (Dona ish)** — Bo'lim → Yo'nalish (price `so'm/dona`).
2. **Yo'nalish (Kunlik)** — Bo'lim → Yo'nalish (price `so'm/smena`).
3. **Xodim** qo'shish (unique code).
4. **Kunlik Hisobot** — sana tanla → xodim biriktirilmagan listdan "Biriktirish" → ish turi (piecework/daily) → bo'lim → yo'nalish → smena (1/0.5). Piecework bo'lsa earning 0; "Mahsulot qo'shish" bilan umumiy `quantity` kiritilgach — barcha piecework xodimlarning `earning` qayta hisoblanadi.
5. **Daily** turidagi yo'nalishda earning = price × shift darhol qo'yiladi.
6. **Manual earning** (qalam ikoni) → admin qo'lda summa kiritadi; agar `< fairShare` bo'lsa `deficit-badge` ko'rinadi.
7. **Oylik Hisobot** — sana oraliq + ixtiyoriy kod → xodimlar bo'yicha guruh. "Qoldiq"ga "To'lash" tugmasi yoki ko'plab tanlash → multi-pay.
8. **Arxiv** sahifasi to'lovlar tarixini oydan-oyga ko'rsatadi.

### C. Xodimni o'chirish
- Soft delete (`status=deleted`). `code` `ReservedCode`-ga oy oxirigacha qo'yiladi. Boshqa xodimga shu kodni berib bo'lmaydi.
- Ish hisobotlari (`DailyAssignment`) snapshotlangani uchun saqlanib qoladi.

---

## 16. TIMEZONE STRATEGIYASI

- **Asosiy kalit:** `dateString` = "YYYY-MM-DD" string. Bu lokal/server time chalkashlarini bartaraf etadi.
- Server `todayDateString()` ni Tashkent (UTC+5) bilan hisoblaydi (`routes/dailyReport.js:22-26`).
- Frontend `todayISO()` esa **browser lokal vaqtidan** olinadi — agar foydalanuvchi boshqa timezonida bo'lsa, server "bugun" va client "bugun" farq qiladi.
- `date` (Date object) ham saqlanadi, lekin asosan ko'rsatish va sortlash uchun. Unique va filter `dateString` orqali.

---

## 17. QAYTA DIZAYN UCHUN ESLATMALAR

> Bu loyiha logikasi/dizayni 80–90% qayta yoziladi. Quyidagi sxema saqlanishi shart:
> - **Multi-tenant model:** `Business._id` + har modelda `businessId`.
> - **Soft delete:** xodim, yo'nalish.
> - **Reserved code** mexanizmi oy oxirigacha.
> - **Piecework recalc** algoritmi (umumiy quantity × narx → manual'lar minus → qolgani non-manuallar orasida shift-proportional).
> - **Daily** yo'nalish — `price × shift` darhol.
> - **dateString timezone-safe** strategiyasi.
> - **Module gating** har sahifa uchun.
>
> Erkin qayta yozish mumkin:
> - UI: barcha sahifalar, modallar, sidebar struktura, ranglar.
> - API: response formati, naming. (Lekin model fieldlariga teging — DB schema migratsiya talab qiladi.)
> - Translations key naming.
> - Frontend state management (hozir global object — Redux/Zustand/Pinia o'tish mumkin agar framework qo'shilsa).
>
> **DB migratsiyasiz tegmaslik kerak:**
> - `DailyAssignment.dateString` unique key.
> - `(businessId, login)` unique Business'da.
> - `Employee.code` mantiqi (ReservedCode bilan).

---

## 18. FOYDALI KOMANDALAR

```bash
# Lokal ishga tushirish
npm install
npm start              # node backend/server.js
npm run dev            # nodemon backend/server.js

# Health
curl http://localhost:3000/health

# Login (admin)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"<parol>"}'

# Mongo ulanishni tekshirish
mongosh "$MONGO_URI" --eval "db.runCommand({ping:1})"
```

---

## 19. RAILWAY DEPLOY ESLATMALAR

- `nixpacks.toml` Node 20 ishlatadi (lokal v24, ammo Railway 20).
- `railway.json`: `startCommand=node backend/server.js`, `restartPolicy=ON_FAILURE` (10 retries).
- `Procfile` `web: node backend/server.js` — Heroku-style fallback.
- ENV o'zgaruvchilarini Railway dashboardiga qo'shish kerak: `MONGO_URI`, `JWT_SECRET`, `SUPER_USERNAME`, `SUPER_PASSWORD`, `CLIENT_URL`, `NODE_ENV=production`.
- `app.set('trust proxy', 1)` — Railway proxy uchun majburiy.

---

Bu xarita backend kodi (10 model + 8 route fayl + 4 middleware + 2 service) va frontend (3 ta JS, 2 ta HTML + tarjima) ni to'liq qamrab oladi. Loyiha yangidan yozilganda qayta murojaat qilish uchun shu fayldan foydalanish kerak — yangi fayllar yaratilsa, shu hujjat ham yangilanadi.

---

# 🆕 20. YANGI DIZAYN TALABLARI (2026-06-23 muhokama)

Ushbu bo'lim foydalanuvchi bilan og'zaki muhokamadan keyin yozildi.
Bu — **yakuniy maqsad**. Hozirgi kod 80-90% qayta yoziladi.
ESKI logikadan saqlanadigan narsalar: multi-tenant, `businessId` scoping, `dateString` timezone-safe strategiyasi, soft delete, JWT auth.

## 20.1 Sidebar — yangi tartib

5 ta asosiy + 1 yangi modul (jami 6 ta). **Yo'nalishlar endi yagona, guruhsiz.**

```
1. Xodimlar           (employees)
2. Yo'nalishlar       (directions — endi yagona)
3. Kunlik Hisobot     (dailyReport)
4. Oylik Hisobot      (monthlyReport)
5. Maosh to'lash      (salary)         ← YANGI MODUL
6. Arxiv              (archive)
```

> Hozirgi `directionsPiecework` / `directionsDaily` ajratish va `directions` parent guruhi olib tashlanadi.

## 20.2 Yo'nalishlar moduli — yangi mantiq

### Bo'lim yaratish
"Bo'lim qo'shish" tugmasi → modal:
- **Nomi** (majburiy)
- **Tasnifi** (description, ixtiyoriy)
- **Jami berilishi mumkin bo'lgan summa** (budget cap — bu bo'lim doirasida xodimlarga jami necha so'm berilishi mumkin)
- **Toggle: "Yo'nalish qo'sha olish" (on/off)** ⭐

### ON bo'lim (yo'nalish qo'sha olish YOQILGAN)
- Bo'lim **filter** sifatida ishlaydi.
- Ichida bir nechta **yo'nalish** yaratish mumkin.
- Yo'nalish = mahsulot turi (masalan "Ko'ylak", "Shim").
- Har yo'nalishda: **nomi** + **narxi** (har bir ishchi nechpulga ishlashi — per dona/birlik narx).
- Kunlik hisobotda: umumiy mahsulot soni × yo'nalish narxi = umumiy pul → biriktirilgan xodimlar orasida taqsim.

### OFF bo'lim (yo'nalish qo'sha olish O'CHIRILGAN)
- Bo'lim **o'zi bitta ish** (masalan "Tikuv").
- Yo'nalish yaratilmaydi.
- "Tikkan narsasiga qarab pul" mantig'i — har xodim qancha mahsulot ishlab chiqargan bo'lsa, o'zi shuncha pul oladi.
- ⚠️ **Aniqlanmagan:** OFF bo'limda narx qayerda saqlanadi? Variantlar:
  - (a) Bo'limning o'zida `pricePerUnit` field.
  - (b) Yo'nalish o'rniga bitta default "ish turi" yashirin yaratiladi.
  - (c) Har xodim qatorida admin earning ni qo'lda kiritadi (narx yo'q).
  > Default sifatida **(a)** ni tanlaymiz: OFF bo'limda `pricePerUnit` saqlanadi. Kunlik hisobotda admin har xodim uchun "mahsulot soni" kiritadi → narx × soni = earning.

## 20.3 Xodimlar moduli — soddalashtirilgan

### Yaratish formasi
- **Bitta input:** Ism + Familiya birgalikda (masalan "Ali Valiyev"). Hozirgi 2 ta inputni 1 ga birlashtirish.
- **Kod** (alohida input, biznesda unique, ReservedCode logikasi saqlanadi).
- **Bo'lim** (dropdown — yo'nalishlar modulida yaratilgan bo'lim). Bir xodim **faqat bitta** bo'limga tegishli.

### Ro'yxat ko'rinishi
- Xodimlar **bo'lim bo'yicha filterlanadi** — sahifada bo'limni tanlash → shu bo'lim ichidagi xodimlar ro'yxati.
- Har xodim qatorida (yoki kartochkada): ism, kod, telefon (ixtiyoriy), **"Biriktirish" tugmasi** (kunlik hisobotga).

> Eslatma: hozirgi schema'da `firstName` va `lastName` alohida. Endi `fullName` bitta string sifatida saqlanadi. Migratsiya: eskidan `firstName + ' ' + lastName` → `fullName`. Yoki `firstName` ni `fullName` sifatida ishlatib, `lastName` ni butunlay olib tashlash mumkin.

## 20.4 Kunlik Hisobot — yangi UX

### Yuqorida — bo'lim tabs (parda)
Yo'nalishlar modulida yaratilgan barcha bo'limlar **tab/parda** ko'rinishida.
Tanlangan bo'lim:
- **ON bo'lim:** ichida yo'nalish select (sub-tab) yoki dropdown.
- **OFF bo'lim:** to'g'ridan-to'g'ri xodimlar ro'yxati.

### Tanlangan bo'lim/yo'nalishda ko'rinadigan narsa:
1. **Biriktirilgan xodimlar** ro'yxati — earning, smena (1/0.5), tahrirlash tugmasi.
2. **Biriktirilmagan xodimlar** ro'yxati — *faqat shu bo'limga tegishli* xodimlar (boshqa bo'limlar emas).
3. **Umumiy mahsulot soni** input (ON bo'lim uchun) yoki **har xodim qatorida soni** (OFF bo'lim uchun).

### Earning tahrirlash
- Har xodim qatorida qalam (edit) tugma.
- Modal'da earning summa kiritiladi (cheklov: bo'lim budget'ini hisobga olib emas, faqat sifatida ko'rsatiladi).
- Admin daromadni **yo'nalish narxidan kam yoki ko'p** qila oladi (qandaydir sabab bilan).
- Hozirgi `isManual` + `manualAmount` + `bonus/deficit` mantig'i saqlanadi.

### Sana navigatori
- Hozirgi `prev/next/today` + sana picker saqlanadi (`max=today`, kelajak yo'q).

## 20.5 Oylik Hisobot — deyarli o'zgarmaydi

Hozirgi logika saqlanadi:
- Sana oraliq + ixtiyoriy kod filter.
- Xodimlar bo'yicha guruhlash: jami smena, jami daromad, to'langan, qoldiq.
- Excel export.

> **Eslatma:** to'lash tugmalari endi alohida "Maosh to'lash" modulida bo'ladi — oylik hisobotda faqat **ko'rsatish** (read-only) qoladi yoki "To'lashga o'tish" tugmasi shu modulga olib boradi.

## 20.6 Maosh to'lash moduli — 🆕 YANGI

### Sahifa ko'rinishi
- Yuqorida — **barcha xodimlar ro'yxati** (kartochka yoki jadval).
- Har xodim kartochkasida: ism, kod, bo'limi, **jami topilgan summa**, **jami to'langan**, **qoldiq**.
- Ustiga bosilganda — **xodim detail sahifasi**.

### Xodim detail sahifasi
- Yuqorida: ism, kod, bo'lim, telefon.
- **Statistika kartochkalari:**
  - Jami ishlangan kunlar
  - Ishga kelmagan kunlar (kelajakda Face ID dan)
  - Jami daromad (boshlanish - hozirgacha)
  - Jami to'langan
  - Qoldiq
- **Kalendar yoki jadval:** har kuni earning + keldi/kelmadi belgi.
- **To'lov qismi:**
  - Sana picker — "Ma'lum sanagacha to'lash"
  - Tanlangan sanagacha jami qoldiq hisoblanadi va ko'rsatiladi.
  - **"To'lash" tugmasi** → bitta `SalaryPayment` yozuvi yaratiladi (sanagacha bo'lgan qoldiq summa).
  - Bu yozuv keyingi marta o'sha xodimning qoldig'idan ayriladi.

### Backend logikasi
Yangi endpoint kerak:
- `GET /api/salary/employees` — barcha xodimlar + statistika (jami earned, paid, remaining).
- `GET /api/salary/employees/:id` — bitta xodim detali + kunlik breakdown.
- `POST /api/salary/employees/:id/pay` — `{ untilDate }` → sanagacha jami qoldiqni bitta to'lov sifatida saqlash.

`SalaryPayment` schema o'zgaradi: `assignmentId` **ixtiyoriy** bo'ladi (chunki to'lov endi konkret kunga emas, sanagacha to'planuvchi summaga).

## 20.7 Arxiv moduli

- **Har oyning to'lov tarixi** — oylik kartochkalar (yanvar/fevral/...).
- Bittasiga bosilganda — shu oyda to'lov olgan xodimlar ro'yxati + jami to'langan summa.
- **To'liq** to'langan / **qisman** to'langan xodimlar farqlanadi:
  - To'liq = oy yakunida `remaining === 0`
  - Qisman = `remaining > 0`
- Bu hozirgi Archive sahifasiga yaqin, lekin "to'liq vs qisman" ajratish qo'shiladi.

## 20.8 Face ID integratsiyasi (KELAJAK — 1-versiyada YO'Q)

> Bu funksiyani **birinchi versiyada yozmaymiz**. Faqat schema/UI strukturasi keyingi integratsiyani osonlashtirsin.

Kelajakdagi oqim:
- Apparat → API endpoint: `POST /api/attendance/checkin` `{ employeeCode }`.
- Backend: `AttendanceLog` model yaratish (`businessId, employeeId, dateString, checkedInAt`).
- Xodim "keldim" deganida → o'sha kun avtomatik biriktirish (`DailyAssignment`) bo'limning default yo'nalishiga.
- Yoki: xodim kelgan bo'lsa kunlik hisobotda "kelganlar" ro'yxatida ko'rinadi, admin qaysi yo'nalishga biriktirishni tanlaydi.

## 20.9 Schema o'zgarishlar (xulosa)

### `Business` o'zgarmaydi
Faqat `enabledModules` ro'yxatiga `salary` qo'shiladi. `directionsPiecework`/`directionsDaily`/`directions` olib tashlanadi.

### `Department` o'zgarishi
```diff
- type: 'piecework' | 'daily'
+ allowDirections: Boolean  (default: true)   ← on/off toggle
+ budget: Number             (default: 0)      ← jami berilishi mumkin summa
+ pricePerUnit: Number       (default: 0)      ← OFF bo'lim uchun 1 birlik narxi
```

### `Direction` o'zgarishi
```diff
- type: 'piecework' | 'daily'                   ← olib tashlash
- price                                         ← faqat 1 ta narx qoladi
+ price: Number                                 ← 1 mahsulot uchun narx (per dona)
```
Ya'ni Direction faqat ON-bo'lim ichida bo'ladi. OFF-bo'limda Direction yo'q.

### `Employee` o'zgarishi
```diff
- firstName: String
- lastName: String
+ fullName: String           ← bitta string
+ departmentId: ObjectId→Department, required  ← har xodim 1 bo'limga
```

### `DailyAssignment` o'zgarishi
```diff
- type: 'piecework' | 'daily'                   ← olib tashlash
- dailyAmount                                   ← daily tur yo'q
+ departmentId: ObjectId→Department, required   ← xodim bo'lim ichida ishlaydi
  directionId: ObjectId→Direction, OPTIONAL     ← faqat ON-bo'limda
+ productCount: Number                          ← OFF bo'lim uchun "necha mahsulot"
```

### `DailyProduct` ehtimol olib tashlanadi
- ON bo'lim: umumiy mahsulot soni → `Department` darajada `dailyTotalQuantity` saqlash mumkin (yoki alohida collection).
- OFF bo'lim: har `DailyAssignment.productCount` ichida.
- Hozirgi `DailyProduct` collection'i sodda emas — qayta dizaynda **olib tashlash mumkin**.

### `SalaryPayment` o'zgarishi
```diff
- assignmentId: ObjectId→DailyAssignment, REQUIRED
+ assignmentId: ObjectId→DailyAssignment, OPTIONAL  ← maosh to'lash sanagacha
+ untilDate: String "YYYY-MM-DD"                    ← qaysi sanagacha bo'lgan qoldiq
+ snapshot: {
+   earningTillDate: Number,    // shu sanagacha jami earning
+   paidBefore: Number,          // shu to'lovgacha to'langan
+   amount: Number,              // shu to'lovda berilgan summa
+ }
```

## 20.10 Recalculation logikasi (yangi)

### ON bo'lim uchun (yo'nalishli piecework)
- Kunlik hisobotda admin yo'nalishga **umumiy mahsulot soni** kiritadi.
- `totalAmount = quantity × direction.price`
- Biriktirilgan xodimlar orasida shift bo'yicha taqsim.
- Manual override saqlanadi (hozirgidek bonus/deficit).

### OFF bo'lim uchun (per-employee piecework)
- Har xodim qatorida admin **`productCount`** kiritadi.
- `earning = department.pricePerUnit × productCount × shift`
- Manual override: admin qo'lda earning ni o'zgartira oladi.

### Budget cheklovi
- `department.budget > 0` bo'lsa: kunlik / oylik darajada bo'lim ichidagi jami earning shu summadan oshmasligi kerak.
- ⚠️ Aniqlanmagan: budget **kunlik**mi, **oylik**mi, **umumiy bir martamilik**mi? Default: oylik cheklov.

## 20.11 Yangi API endpointlar (tasdiqlovchi taxmin)

| Method | Path | Maqsad |
|---|---|---|
| GET    | `/api/departments` | (o'zgarmaydi) — endi `?type` query'siz, bo'lim turi `allowDirections` bilan qaytadi |
| GET    | `/api/departments/:id/employees` | Bo'limga tegishli xodimlar |
| GET    | `/api/directions?departmentId=` | ON bo'limning yo'nalishlari |
| POST   | `/api/daily-report/quantity` | ON bo'lim uchun umumiy mahsulot soni kiritish |
| POST   | `/api/daily-report/assign` | (o'zgaradi) — `{ employeeId, departmentId, directionId?, shift, productCount?, date? }` |
| GET    | `/api/salary` | Maosh to'lash sahifasi — barcha xodimlar + statistika |
| GET    | `/api/salary/:employeeId` | Bitta xodim detali (kunlik breakdown) |
| POST   | `/api/salary/:employeeId/pay` | `{ untilDate }` — sanagacha to'lov |
| GET    | `/api/archive/months` | Oylik to'lov tarixi (to'liq/qisman ajratilgan) |

Hozirgi `monthlyReport/pay` olib tashlanadi (Maosh modulida birlashadi).

## 20.12 Yangi modullar konfiguratsiyasi (`config/modules.js`)

```js
const MODULES = {
  employees:     { order: 1, default: true,  name: 'Xodimlar' },
  directions:    { order: 2, default: true,  name: "Yo'nalishlar" },
  dailyReport:   { order: 3, default: true,  name: 'Kunlik Hisobot' },
  monthlyReport: { order: 4, default: true,  name: 'Oylik Hisobot' },
  salary:        { order: 5, default: true,  name: "Maosh to'lash" },  // ← YANGI
  archive:       { order: 6, default: false, name: 'Arxiv' },
};
```

`directionsPiecework`, `directionsDaily` va `directions` (eski hidden) olib tashlanadi.

## 20.13 Hal qilinishi kerak bo'lgan ochiq savollar

Implementatsiya boshlanishidan oldin foydalanuvchidan aniqlash kerak:

1. **OFF bo'limda narx qayerda?** — Hozirgi taxmin: `Department.pricePerUnit`. Tasdiqlash kerak.
2. **Budget — qaysi davr uchun?** — Kunlik / oylik / umumiy.
3. **Bo'lim o'zgartirilganda eski xodimlar/assignment'lar nima bo'ladi?** — Bo'lim o'chirilsa xodimlar bo'limsiz qoladimi yoki "default" bo'limga ko'chiriladimi?
4. **Maosh to'lash kalendarida "kelmadi" qanday belgilanadi?** — Face ID yo'q paytda manual flag kerakmi yoki shunchaki assignment yo'qligi = "kelmadi"?
5. **Bo'lim avval ON edi, keyin OFF qilindi (yoki aksincha) — eski yo'nalishlar nima bo'ladi?** — Avtomatik arxivlanadimi?
6. **Ish boshlash tartibi:** birinchi navbatda backend schema o'zgarishi + migratsiyami yoki to'g'ridan-to'g'ri yangi UI'dan boshlaymizmi?

## 20.14 Implementatsiya bosqichlari (tavsiya)

1. **Schema migratsiya** — `Department`, `Direction`, `Employee`, `DailyAssignment`, `SalaryPayment` ni yangilash. Migratsiya skripti yozish (eski yozuvlarni yangi formatga o'tkazish).
2. **Backend API qayta yozish** — `directions`/`departments` route'lariga yangi mantiq, `salary` route yaratish, `monthlyReport.pay` olib tashlash, `recalculate` ni ON/OFF logikaga moslab yozish.
3. **Frontend — Yo'nalishlar moduli** — bo'lim CRUD + on/off toggle, ON bo'limda yo'nalish CRUD.
4. **Frontend — Xodimlar moduli** — fullName, departmentId, bo'lim filteri.
5. **Frontend — Kunlik Hisobot** — bo'lim tabs, ON/OFF mantiqiga moslangan ro'yxatlar va inputlar.
6. **Frontend — Oylik Hisobot** — kichik o'zgarishlar (pay tugmasi olib tashlash).
7. **Frontend — Maosh to'lash** — yangi modul (xodimlar ro'yxati + detail + sanagacha to'lov).
8. **Frontend — Arxiv** — to'liq/qisman ajratish.
9. **i18n** — yangi keylar (`salary.*`, `dept.budget`, `dept.allowDirections`...).
10. **Face ID hook** — `AttendanceLog` model + `POST /api/attendance/checkin` (placeholder, integratsiya keyin).

---

> **MUHIM:** Bu bo'lim foydalanuvchining 2026-06-23 dagi muhokamasidan to'liq olingan. Har kod yozish bosqichida shu bo'limga qaytib qarash kerak. Yangi tafsilotlar paydo bo'lsa, shu yerga qo'shib boriladi.

---

# ✅ 21. AMALGA OSHIRILGAN BOSQICHLAR

## 21.1 Schema Migratsiyasi (2026-06-23 yakunlandi)

**Bosqich 1/10 yakunlandi.** DB tozalandi (test ma'lumot o'chirildi, SuperAdmin saqlandi). Yangi modellar:

| Model | Holat | Asosiy o'zgarishlar |
|---|---|---|
| `Business` | ✅ Yangi | `enabledWorkTypes` olib tashlandi. `enabledModules` yangi keylarni qabul qiladi. |
| `Department` | ✅ Yangi | `type` olib tashlandi. `allowDirections`, `budget`, `pricePerUnit` qo'shildi. |
| `Direction` | ✅ Yangi | `type`, `currentPrice`, eski piecework/daily fieldlar olib tashlandi. Faqat `price` qoldi. |
| `Employee` | ✅ Yangi | `firstName`+`lastName` → `fullName`. `departmentId` majburiy. |
| `DailyAssignment` | ✅ Yangi | `type`, `dailyAmount` olib tashlandi. `departmentId` majburiy, `directionId` ixtiyoriy, `productCount` qo'shildi. |
| `SalaryPayment` | ✅ Yangi | `assignmentId` olib tashlandi. `untilDate` + `snapshot` qo'shildi. |
| `DailyProduct` | ✅ O'chirildi | Yangi mantiqda kerak emas. |
| `ReservedCode` | ⏸️ O'zgarishsiz | Saqlanadi (oy oxirigacha kod band). |
| `Archive` | ⏸️ O'zgarishsiz | Hozircha tegilmadi — keyingi bosqichda qayta dizayn. |
| `SuperAdmin` | ⏸️ O'zgarishsiz | — |

**Konfiguratsiya:** `config/modules.js` — 6 ta modul (`employees`, `directions`, `dailyReport`, `monthlyReport`, `salary`, `archive`). `directionsPiecework`/`directionsDaily` butunlay olib tashlandi.

**Server:** ishga tushadi, login ishlaydi, `/api/superadmin/modules` yangi ro'yxat qaytaradi. Eski route'lar (`employees`, `departments`, `directions`, `daily-report`, `monthly-report`, `salary`, `archive`) — vaqtinchalik **503 "Modul v2-ga qayta yozilmoqda"** javob beradi. Bu kutilgan — keyingi bosqichlarda yangidan yoziladi.

## 21.2 Keyingi navbatdagi bosqichlar

1. **Backend route'lar (v2)** — quyidagi tartibda yangidan yozish:
   - `routes/departments.js` — bo'lim CRUD (allowDirections toggle, budget, pricePerUnit).
   - `routes/directions.js` — yo'nalish CRUD (faqat ON-bo'limga).
   - `routes/employees.js` — fullName, departmentId, bo'lim bo'yicha filter.
   - `routes/dailyReport.js` — ON/OFF logikasi, productCount, recalculate.
   - `routes/monthlyReport.js` — pay endpoint olib tashlanadi (salary moduliga).
   - `routes/salary.js` — yangi route: xodim ro'yxati, detail, sanagacha to'lov.
   - `routes/archive.js` — to'liq/qisman ajratish.
2. **`services/recalculate.js`** — ON/OFF logikasiga moslab qayta yozish.
3. **Frontend** — barcha sahifalar yangidan (admin/app.js, admin/index.html).
4. **Translations** — yangi keylar.
