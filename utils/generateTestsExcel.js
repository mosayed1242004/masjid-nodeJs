const ExcelJS = require("exceljs");

// ====== ألوان التصميم ======
const WHITE       = "FFFFFFFF";
const NAVY        = "FF1B2A4A";
const NAVY_SOFT    = "FF2C3E63";
const GOLD        = "FFC9A227";
const GOLD_LIGHT   = "FFE8D48A";
const ROW_EVEN     = "FFF7F7F9";
const ROW_ODD      = "FFFFFFFF";
const BORDER_COLOR = "FFD9D9D9";

const GREEN_BG = "FFE2F0D9"; const GREEN_FG = "FF2E7D32";
const YELLOW_BG = "FFFFF2CC"; const YELLOW_FG = "FF8A6D00";
const RED_BG   = "FFFCE4E4"; const RED_FG   = "FFC62828";

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const borders = (color = BORDER_COLOR, style = "thin") => {
  const b = { style, color: { argb: color } };
  return { top: b, left: b, bottom: b, right: b };
};

// تلوين الدرجة حسب نسبتها من أعلى درجة تم تسجيلها لنفس الاختبار
function gradeTheme(value, max) {
  if (max <= 0) return { bg: ROW_EVEN, fg: NAVY };
  const pct = value / max;
  if (pct >= 0.8) return { bg: GREEN_BG, fg: GREEN_FG };
  if (pct >= 0.5) return { bg: YELLOW_BG, fg: YELLOW_FG };
  return { bg: RED_BG, fg: RED_FG };
}

/**
 * @param {Array} testsDegree  نتيجة test.find().populate("student_id", "name")
 * @returns {Promise<Buffer>}
 */
async function generateTestsExcel(testsDegree) {
  // ====== 1. استخراج أسماء الاختبارات الفريدة (أعمدة الجدول) ======
  const testNames = [...new Set(testsDegree.map((t) => t.name))];

  // ====== 2. تجميع الدرجات حسب الطالب ======
  const studentsMap = new Map();
  testsDegree.forEach((t) => {
    const sid = t.student_id._id.toString();
    if (!studentsMap.has(sid)) {
      studentsMap.set(sid, { name: t.student_id.name, scores: {} });
    }
    studentsMap.get(sid).scores[t.name] = t.degree;
  });
  const students = [...studentsMap.values()];

  // ====== 3. أعلى درجة مسجلة لكل اختبار (لتلوين الخلايا نسبيًا) ======
  const maxByTest = {};
  testNames.forEach((name) => {
    maxByTest[name] = Math.max(
      ...testsDegree.filter((t) => t.name === name).map((t) => t.degree),
      0
    );
  });

  // ====== 4. إنشاء ملف الإكسل ======
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "نظام إدارة حلقات القرآن الكريم";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("تقرير الدرجات", {
    properties: { defaultRowHeight: 22 },
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
    views: [{ rightToLeft: true }],
  });

  const colCount = 2 + testNames.length; // # + الاسم + أعمدة الاختبارات
  worksheet.getColumn(1).width = 6;
  worksheet.getColumn(2).width = 28;
  testNames.forEach((_, i) => (worksheet.getColumn(3 + i).width = 14));

  // ====== Row 1 — عنوان التقرير ======
  worksheet.mergeCells(1, 1, 1, colCount);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "📋  تقرير درجات الطلاب";
  titleCell.font = { bold: true, size: 18, color: { argb: WHITE }, name: "Calibri" };
  titleCell.fill = fill(NAVY);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = borders(GOLD, "medium");
  worksheet.getRow(1).height = 38;

  // ====== Row 2 — عناوين الأعمدة ======
  const headers = ["#", "الاسم", ...testNames];
  const headerRow = worksheet.getRow(2);
  headerRow.height = 26;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 12, color: { argb: GOLD_LIGHT }, name: "Calibri" };
    cell.fill = fill(NAVY_SOFT);
    cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    cell.border = borders(GOLD, "medium");
  });

  // ====== Rows 3+ — بيانات الطلاب ======
  let rowIndex = 3;
  students.forEach((student, idx) => {
    const isEven = idx % 2 === 0;
    const row = worksheet.getRow(rowIndex);
    row.height = 22;

    // # و الاسم
    [idx + 1, student.name].forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value;
      cell.font = { name: "Calibri", size: 11, color: { argb: NAVY }, bold: i === 1 };
      cell.fill = fill(isEven ? ROW_EVEN : ROW_ODD);
      cell.alignment = {
        horizontal: i === 0 ? "center" : "right",
        vertical: "middle",
        readingOrder: "rtl",
      };
      cell.border = borders();
    });

    // أعمدة الاختبارات
    testNames.forEach((name, i) => {
      const cell = row.getCell(3 + i);
      const value = student.scores[name];
      const hasValue = value !== undefined;
      const theme = hasValue
        ? gradeTheme(value, maxByTest[name])
        : { bg: isEven ? ROW_EVEN : ROW_ODD, fg: "FFAAAAAA" };

      cell.value = hasValue ? parseFloat(value.toFixed(2)) : "-";
      cell.font = { name: "Calibri", size: 11, bold: hasValue, color: { argb: theme.fg } };
      cell.fill = fill(theme.bg);
      cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
      cell.border = borders();
      if (hasValue) cell.numFmt = "0.00";
    });

    row.commit();
    rowIndex++;
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateTestsExcel };

// ====== مثال استخدام داخل route ======
// router.get("/tests/export", async (req, res) => {
//   const testsDegree = await test.find().populate("student_id", "name");
//   const buffer = await generateTestsExcel(testsDegree);
//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );
//   res.setHeader("Content-Disposition", "attachment; filename=tests-report.xlsx");
//   return res.status(200).send(buffer);
// });