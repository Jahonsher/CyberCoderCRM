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
// 2) Kunlik hisobot
// =============================================================
async function buildDailyReportWorkbook(lang, { date, departments = [], assignments = [] } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CyberCoderCRM';
  wb.created = new Date();
  const ws = wb.addWorksheet(safeSheetName(tr(lang, 'sheet.daily')));

  // Sarlavha (info row)
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${tr(lang, 'sheet.daily')} — ${date || '-'}`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 24;

  // Ustun headerlari (2-qatorda)
  const headers = [
    tr(lang, 'common.department'),
    tr(lang, 'common.code'),
    tr(lang, 'common.fullName'),
    tr(lang, 'common.direction'),
    tr(lang, 'common.shift'),
    tr(lang, 'common.productCount'),
    tr(lang, 'common.earning'),
  ];
  ws.getRow(2).values = headers;
  ws.columns = [
    { key: 'department', width: 22 },
    { key: 'code', width: 14 },
    { key: 'fullName', width: 30 },
    { key: 'direction', width: 22 },
    { key: 'shift', width: 10 },
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

  const deptName = (id) => {
    const d = departments.find((x) => String(x._id) === String(id));
    return d ? d.name : '-';
  };

  let totalProduct = 0;
  let totalEarning = 0;
  for (const a of assignments) {
    const earning = a.earning || 0;
    const pc = a.productCount || 0;
    totalEarning += earning;
    totalProduct += pc;
    ws.addRow({
      department: a.departmentSnapshot?.name || deptName(a.departmentId),
      code: a.employeeSnapshot?.code || '-',
      fullName: a.employeeSnapshot?.fullName || '-',
      direction: a.directionSnapshot?.name || '-',
      shift: a.shift || 0,
      productCount: pc,
      earning,
    });
  }

  // Jami qatori
  const totalRowIdx = ws.rowCount + 1;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.values = ['', '', '', '', tr(lang, 'common.total'), totalProduct, totalEarning];
  applyTotalRowStyle(ws, totalRowIdx);

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

module.exports = {
  buildEmployeesWorkbook,
  buildDailyReportWorkbook,
  buildMonthlyReportWorkbook,
  buildSalaryWorkbook,
  safeSheetName,
};
