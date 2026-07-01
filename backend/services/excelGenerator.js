/**
 * CyberCoderCRM - Excel Generator
 *
 * exceljs orqali xush ko'rinishdagi workbook yasaydi.
 * Har funksiya Promise<Buffer> qaytaradi (workbook.xlsx.writeBuffer()).
 *
 * Style: 1-qator bold + indigo (#4F46E5) background + oq matn,
 *        auto-filter va o'rtacha 18-22 width.
 */

const ExcelJS = require('exceljs');
const { tr } = require('./excelI18n');

// Excel sheet nomidagi taqiqlangan belgilarni almashtirish
function safeSheetName(name) {
  if (!name) return 'Sheet';
  return String(name).replace(/[\/\\\?\*\[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet';
}

// Excel ustun harfini index bo'yicha hisoblash (1 → A, 27 → AA)
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function applyHeaderStyle(ws, cols) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF4F46E5' } },
      left: { style: 'thin', color: { argb: 'FF4F46E5' } },
      bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
      right: { style: 'thin', color: { argb: 'FF4F46E5' } },
    };
  });
  ws.autoFilter = { from: 'A1', to: `${colLetter(cols)}1` };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function applyTotalRowStyle(ws, rowNum) {
  const row = ws.getRow(rowNum);
  row.font = { bold: true, color: { argb: 'FF1F2937' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
  row.alignment = { vertical: 'middle' };
}

// Ixtiyoriy qatordagi header'ni indigo uslubda bezaydi + autofilter + frozen
function styleHeaderRow(ws, rowNum, cols) {
  const row = ws.getRow(rowNum);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
  ws.autoFilter = { from: `A${rowNum}`, to: `${colLetter(cols)}${rowNum}` };
  ws.views = [{ state: 'frozen', ySplit: rowNum }];
}

// =============================================================
// 1) Xodimlar
// =============================================================
async function buildEmployeesWorkbook(lang, { employees = [] } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyberCoderCRM';
  wb.created = new Date();
  const ws = wb.addWorksheet(safeSheetName(tr(lang, 'sheet.employees')));

  ws.columns = [
    { header: tr(lang, 'common.code'), key: 'code', width: 14 },
    { header: tr(lang, 'common.fullName'), key: 'fullName', width: 32 },
    { header: tr(lang, 'common.phone'), key: 'phone', width: 18 },
    { header: tr(lang, 'common.department'), key: 'department', width: 22 },
    { header: tr(lang, 'common.direction'), key: 'direction', width: 22 },
    { header: tr(lang, 'common.status'), key: 'status', width: 14 },
    { header: tr(lang, 'common.createdAt'), key: 'createdAt', width: 20 },
  ];
  applyHeaderStyle(ws, ws.columns.length);

  for (const e of employees) {
    const dept = e.departmentId && typeof e.departmentId === 'object'
      ? (e.departmentId.name || '-') : '-';
    const dir = e.directionId && typeof e.directionId === 'object'
      ? (e.directionId.name || '-') : '-';
    const created = e.createdAt ? new Date(e.createdAt) : null;
    ws.addRow({
      code: e.code || '-',
      fullName: e.fullName || '-',
      phone: e.phone || '-',
      department: dept,
      direction: dir,
      status: tr(lang, 'status.active'),
      createdAt: created ? created.toISOString().slice(0, 10) : '-',
    });
  }

  return await wb.xlsx.writeBuffer();
}

// =============================================================
// 2) Kunlik hisobot — bitta bo'lim (ON yoki OFF)
// =============================================================
// ON  bo'lim: yo'nalish bo'yicha saralangan (Yo'nalish, Kod, F.I.SH, Smena, Daromad).
//             selectedDirectionName berilsa sarlavhada ko'rsatiladi.
// OFF bo'lim: mahsulot nomi + umumiy son info qatori, so'ng (Kod, F.I.SH, Mahsulot, Daromad).
async function buildDailyReportWorkbook(lang, {
  date,
  department = {},
  assignments = [],
  production = null,
  selectedDirectionName = null,
} = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyberCoderCRM';
  wb.created = new Date();

  const isOn = !!department.allowDirections;
  const deptName = department.name || '-';
  const ws = wb.addWorksheet(safeSheetName(deptName));

  const titleCol = (n) => {
    ws.mergeCells(`A1:${colLetter(n)}1`);
    const c = ws.getCell('A1');
    c.font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
    c.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 24;
    return c;
  };

  if (isOn) {
    const cols = 5;
    const dirSuffix = selectedDirectionName ? ` — ${selectedDirectionName}` : '';
    titleCol(cols).value = `${tr(lang, 'sheet.daily')} — ${deptName}${dirSuffix} — ${date || '-'}`;

    ws.getRow(2).values = [
      tr(lang, 'common.direction'),
      tr(lang, 'common.code'),
      tr(lang, 'common.fullName'),
      tr(lang, 'common.shift'),
      tr(lang, 'common.earning'),
    ];
    ws.columns = [
      { key: 'direction', width: 24 },
      { key: 'code', width: 14 },
      { key: 'fullName', width: 30 },
      { key: 'shift', width: 10 },
      { key: 'earning', width: 18 },
    ];
    styleHeaderRow(ws, 2, cols);

    const rows = [...assignments].sort((a, b) => {
      const da = String(a.directionSnapshot?.name || '').localeCompare(String(b.directionSnapshot?.name || ''));
      if (da !== 0) return da;
      return String(a.employeeSnapshot?.fullName || '').localeCompare(String(b.employeeSnapshot?.fullName || ''));
    });

    let totalEarning = 0;
    for (const a of rows) {
      totalEarning += a.earning || 0;
      ws.addRow({
        direction: a.directionSnapshot?.name || '—',
        code: a.employeeSnapshot?.code || '-',
        fullName: a.employeeSnapshot?.fullName || '-',
        shift: a.shift || 0,
        earning: a.earning || 0,
      });
    }

    const totalRowIdx = ws.rowCount + 1;
    ws.getRow(totalRowIdx).values = ['', '', '', tr(lang, 'common.total'), totalEarning];
    applyTotalRowStyle(ws, totalRowIdx);
  } else {
    const cols = 4;
    titleCol(cols).value = `${tr(lang, 'sheet.daily')} — ${deptName} — ${date || '-'}`;

    // Info qatori: mahsulot nomi + umumiy son
    ws.mergeCells(`A2:${colLetter(cols)}2`);
    const info = ws.getCell('A2');
    const pName = (production && production.productName) || '—';
    const pQty = (production && production.quantity) || 0;
    info.value = `${tr(lang, 'common.productName')}: ${pName}    ·    ${tr(lang, 'common.totalProduct')}: ${pQty}`;
    info.font = { bold: true, size: 11, color: { argb: 'FF4F46E5' } };
    info.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(2).height = 20;

    ws.getRow(3).values = [
      tr(lang, 'common.code'),
      tr(lang, 'common.fullName'),
      tr(lang, 'common.productCount'),
      tr(lang, 'common.earning'),
    ];
    ws.columns = [
      { key: 'code', width: 14 },
      { key: 'fullName', width: 30 },
      { key: 'productCount', width: 16 },
      { key: 'earning', width: 18 },
    ];
    styleHeaderRow(ws, 3, cols);

    const rows = [...assignments].sort((a, b) =>
      String(a.employeeSnapshot?.fullName || '').localeCompare(String(b.employeeSnapshot?.fullName || '')));

    let totalProduct = 0;
    let totalEarning = 0;
    for (const a of rows) {
      totalProduct += a.productCount || 0;
      totalEarning += a.earning || 0;
      ws.addRow({
        code: a.employeeSnapshot?.code || '-',
        fullName: a.employeeSnapshot?.fullName || '-',
        productCount: a.productCount || 0,
        earning: a.earning || 0,
      });
    }

    const totalRowIdx = ws.rowCount + 1;
    ws.getRow(totalRowIdx).values = ['', tr(lang, 'common.total'), totalProduct, totalEarning];
    applyTotalRowStyle(ws, totalRowIdx);
  }

  return await wb.xlsx.writeBuffer();
}

// =============================================================
// 3) Oylik hisobot
// =============================================================
async function buildMonthlyReportWorkbook(lang, { startDate, endDate, rows = [] } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyberCoderCRM';
  wb.created = new Date();
  const ws = wb.addWorksheet(safeSheetName(tr(lang, 'sheet.monthly')));

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${tr(lang, 'sheet.monthly')} — ${tr(lang, 'common.period')}: ${startDate || '-'} … ${endDate || '-'}`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 24;

  const headers = [
    tr(lang, 'common.code'),
    tr(lang, 'common.fullName'),
    tr(lang, 'common.department'),
    tr(lang, 'common.days'),
    tr(lang, 'common.shifts'),
    tr(lang, 'common.productCount'),
    tr(lang, 'common.earning'),
  ];
  ws.getRow(2).values = headers;
  ws.columns = [
    { key: 'code', width: 14 },
    { key: 'fullName', width: 30 },
    { key: 'department', width: 22 },
    { key: 'days', width: 12 },
    { key: 'shifts', width: 12 },
    { key: 'productCount', width: 14 },
    { key: 'earning', width: 18 },
  ];

  const headerRow = ws.getRow(2);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;
  ws.autoFilter = { from: 'A2', to: 'G2' };
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  let totalDays = 0, totalShifts = 0, totalPC = 0, totalEarning = 0;
  for (const r of rows) {
    totalDays += r.totalDays || 0;
    totalShifts += r.totalShifts || 0;
    totalPC += r.totalProductCount || 0;
    totalEarning += r.totalEarning || 0;
    ws.addRow({
      code: r.code || '-',
      fullName: r.fullName || '-',
      department: r.departmentName || '-',
      days: r.totalDays || 0,
      shifts: r.totalShifts || 0,
      productCount: r.totalProductCount || 0,
      earning: r.totalEarning || 0,
    });
  }

  const totalRowIdx = ws.rowCount + 1;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.values = ['', '', tr(lang, 'common.total'), totalDays, totalShifts, totalPC, totalEarning];
  applyTotalRowStyle(ws, totalRowIdx);

  return await wb.xlsx.writeBuffer();
}

// =============================================================
// 4) Maosh
// =============================================================
async function buildSalaryWorkbook(lang, { filter = 'all', startDate, endDate, employees = [], stats = {} } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyberCoderCRM';
  wb.created = new Date();

  let sheetTitle = tr(lang, 'sheet.salary');
  if (filter === 'paid') sheetTitle = tr(lang, 'sheet.salaryPaid');
  else if (filter === 'unpaid') sheetTitle = tr(lang, 'sheet.salaryUnpaid');

  const ws = wb.addWorksheet(safeSheetName(sheetTitle));

  // Filtrlanmagan ro'yxat
  let filtered = employees;
  if (filter === 'paid') {
    filtered = employees.filter((e) => (e.remaining || 0) <= 0 && (e.totalEarning || 0) > 0);
  } else if (filter === 'unpaid') {
    filtered = employees.filter((e) => (e.remaining || 0) > 0);
  }

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  const periodStr = startDate && endDate ? `${startDate} … ${endDate}` : '-';
  titleCell.value = `${sheetTitle} — ${tr(lang, 'common.period')}: ${periodStr}`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 24;

  const headers = [
    tr(lang, 'common.code'),
    tr(lang, 'common.fullName'),
    tr(lang, 'common.department'),
    tr(lang, 'common.earning'),
    tr(lang, 'common.paid'),
    tr(lang, 'common.remaining'),
    tr(lang, 'common.status'),
  ];
  ws.getRow(2).values = headers;
  ws.columns = [
    { key: 'code', width: 14 },
    { key: 'fullName', width: 30 },
    { key: 'department', width: 22 },
    { key: 'earning', width: 18 },
    { key: 'paid', width: 18 },
    { key: 'remaining', width: 18 },
    { key: 'status', width: 20 },
  ];

  const headerRow = ws.getRow(2);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;
  ws.autoFilter = { from: 'A2', to: 'G2' };
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  let tEarn = 0, tPaid = 0, tRem = 0;
  for (const e of filtered) {
    const earning = e.totalEarning || 0;
    const paid = e.totalPaid || 0;
    const remaining = e.remaining || 0;
    tEarn += earning;
    tPaid += paid;
    tRem += remaining;
    const status = remaining <= 0
      ? tr(lang, 'status.fullyPaid')
      : tr(lang, 'status.hasRemaining');
    ws.addRow({
      code: e.code || '-',
      fullName: e.fullName || '-',
      department: e.department?.name || '-',
      earning,
      paid,
      remaining,
      status,
    });
  }

  const totalRowIdx = ws.rowCount + 1;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.values = ['', '', tr(lang, 'common.total'), tEarn, tPaid, tRem, ''];
  applyTotalRowStyle(ws, totalRowIdx);

  return await wb.xlsx.writeBuffer();
}

// =============================================================
// 5) Bitta xodimning maoshi — ishlangan kunlar + to'lov tarixi
// =============================================================
async function buildSalaryEmployeeWorkbook(lang, { employee = {}, days = [], payments = [], stats = {} } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyberCoderCRM';
  wb.created = new Date();

  // ---------- Sheet 1: Ishlangan kunlar ----------
  const ws1 = wb.addWorksheet(safeSheetName(tr(lang, 'sheet.workDays')));

  ws1.mergeCells('A1:G1');
  const title1 = ws1.getCell('A1');
  const empName = employee.fullName || '-';
  const empCode = employee.code || '-';
  const empDept = (employee.departmentId && employee.departmentId.name) || employee.departmentName || '-';
  title1.value = `${tr(lang, 'sheet.salary')} — ${empName} (${empCode}) — ${empDept}`;
  title1.font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
  title1.alignment = { vertical: 'middle', horizontal: 'left' };
  ws1.getRow(1).height = 24;

  const headers1 = [
    tr(lang, 'common.date'),
    tr(lang, 'common.department'),
    tr(lang, 'common.direction'),
    tr(lang, 'common.shift'),
    tr(lang, 'common.productCount'),
    tr(lang, 'common.earning'),
    tr(lang, 'common.status'),
  ];
  ws1.getRow(2).values = headers1;
  ws1.columns = [
    { key: 'date', width: 14 },
    { key: 'department', width: 22 },
    { key: 'direction', width: 22 },
    { key: 'shift', width: 10 },
    { key: 'productCount', width: 14 },
    { key: 'earning', width: 18 },
    { key: 'status', width: 16 },
  ];

  const headerRow1 = ws1.getRow(2);
  headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow1.height = 22;
  ws1.autoFilter = { from: 'A2', to: 'G2' };
  ws1.views = [{ state: 'frozen', ySplit: 2 }];

  let tShift = 0, tProd = 0, tEarn = 0;
  for (const d of days) {
    const shift = Number(d.shift) || 0;
    const product = Number(d.productCount) || 0;
    const earning = Number(d.earning) || 0;
    tShift += shift; tProd += product; tEarn += earning;
    ws1.addRow({
      date: d.date || d.dateString || '-',
      department: d.departmentName || (d.departmentSnapshot && d.departmentSnapshot.name) || '-',
      direction: d.directionName || (d.directionSnapshot && d.directionSnapshot.name) || '-',
      shift: shift === 0.5 ? '½' : (shift || '-'),
      productCount: product || '-',
      earning,
      status: d.paid ? tr(lang, 'status.paid') : tr(lang, 'status.unpaid'),
    });
  }

  const totalIdx1 = ws1.rowCount + 1;
  const totalRow1 = ws1.getRow(totalIdx1);
  totalRow1.values = [tr(lang, 'common.total'), '', '', tShift, tProd, tEarn, ''];
  applyTotalRowStyle(ws1, totalIdx1);

  // ---------- Sheet 2: To'lovlar tarixi ----------
  const ws2 = wb.addWorksheet(safeSheetName(tr(lang, 'sheet.payments')));

  const headers2 = [
    tr(lang, 'common.paidAt'),
    tr(lang, 'common.daysCount'),
    tr(lang, 'common.untilDate'),
    tr(lang, 'common.amount'),
    tr(lang, 'common.note'),
  ];
  ws2.getRow(1).values = headers2;
  ws2.columns = [
    { key: 'paidAt', width: 18 },
    { key: 'daysCount', width: 14 },
    { key: 'untilDate', width: 14 },
    { key: 'amount', width: 18 },
    { key: 'note', width: 30 },
  ];
  applyHeaderStyle(ws2, 5);

  let tAmount = 0;
  for (const p of payments) {
    const amount = Number(p.amount) || 0;
    tAmount += amount;
    const daysCount = Array.isArray(p.paidDates) && p.paidDates.length > 0 ? p.paidDates.length : '-';
    ws2.addRow({
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : '-',
      daysCount,
      untilDate: p.untilDate || '-',
      amount,
      note: p.note || '',
    });
  }

  const totalIdx2 = ws2.rowCount + 1;
  const totalRow2 = ws2.getRow(totalIdx2);
  totalRow2.values = [tr(lang, 'common.total'), '', '', tAmount, ''];
  applyTotalRowStyle(ws2, totalIdx2);

  return await wb.xlsx.writeBuffer();
}

module.exports = {
  buildEmployeesWorkbook,
  buildDailyReportWorkbook,
  buildMonthlyReportWorkbook,
  buildSalaryWorkbook,
  buildSalaryEmployeeWorkbook,
  safeSheetName,
};
