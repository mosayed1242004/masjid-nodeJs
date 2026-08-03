const student = require('../models/student');
const user = require('../models/user');
const Attendance = require('../models/attendance');
const ExcelJS = require("exceljs")
const asyncMiddleware = require('../middleware/async-middleware');
const { validationResult } = require('express-validator');
const errorHandler = require('../utils/error-handler');


const showReports = asyncMiddleware(async (req, res, next) => {

  const [year, month, day] = req.body.day.split("-").map(Number);

  const startOfDay = new Date(
    Date.UTC(year, month - 1, day)
  );

  const endOfDay = new Date(
    Date.UTC(year, month - 1, day + 1)
  );

  const getStudents = await student.find({ userId: req.body.userId });

  const studentsIds = getStudents.map(s => s._id);
  const attendanceStats = await Attendance.aggregate([
    {
      $match: {
        student_id: { $in: studentsIds },
        day: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      }
    },
    {
      $group: {
        _id: "$attend",
        count: { $sum: 1 }
      }
    }
  ]);

  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  };

  attendanceStats.forEach(item => {
    counts[item._id] = item.count;
  });

  const total =
    counts.present +
    counts.absent +
    counts.late +
    counts.excused;

  const percentages = {
    present: total ? (counts.present / total) * 100 : 0,
    absent: total ? (counts.absent / total) * 100 : 0,
    late: total ? (counts.late / total) * 100 : 0,
    excused: total ? (counts.excused / total) * 100 : 0
  };

  if (!studentsIds || studentsIds.length == 0) {
    const Handler = new errorHandler('Fail', 'لا يوجد طلبة', 400);
    return next(Handler);
  }
  res.json({ status: 'success', message: 'تم استرجاع البيانات بنجاح', code: 200, data: percentages });
});

const downloadExcel = asyncMiddleware(async (req, res, next) => {
  try {
    const startOfDay = new Date(req.body.day);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    // جلب بيانات المحفظ
    const getUser = await user.findById(req.body.userId);

    if (!getUser) {
      return res.status(404).json({
        message: "المحفظ غير موجود",
      });
    }

    // جلب الطلاب
    const getStudents = await student.find({
      userId: req.body.userId,
    });

    const studentsIds = getStudents.map((s) => s._id);

    // جلب الحضور
    const attendance = await Attendance.find({
      student_id: { $in: studentsIds },
      day: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    }).populate("student_id");

    // =========================
    // التاريخ واليوم
    // =========================

    const date = new Date(req.body.day);

    const days = [
      "الأحد",
      "الإثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ];

    const dayName = days[date.getUTCDay()];

    const formattedDate = date.toLocaleDateString("ar-EG", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    // =========================
    // نظام الألوان (Navy / Gold identity)
    // =========================

    const NAVY = "0B1D3A";
    const NAVY_SOFT = "13294B";
    const GOLD = "C9A227";
    const GOLD_LIGHT = "F5EBC8";
    const WHITE = "FFFFFF";
    const ROW_EVEN = "F4F6F9";
    const ROW_ODD = "FFFFFF";
    const BORDER_COLOR = "D9DEE7";

    const STATUS_COLORS = {
      "حاضر": { fg: "1E7F4F", bg: "E5F5EC" }, // green
      "غائب": { fg: "B3261E", bg: "FBE7E6" }, // red
      "متأخر": { fg: "9A6B00", bg: "FFF3D6" }, // amber
      "بعذر": { fg: "3B5BA5", bg: "E7ECFA" }, // blue
    };

    // =========================
    // إنشاء Excel
    // =========================

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "نظام إدارة حلقات القرآن الكريم";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(`تقرير - ${req.body.day}`, {
      properties: { defaultRowHeight: 22 },
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "portrait" },
    });

    // اتجاه الصفحة من اليمين لليسار
    worksheet.views = [
      {
        rightToLeft: true,
        showGridLines: false,
      },
    ];

    // =========================
    // تحديد عرض الأعمدة
    // =========================

    worksheet.getColumn(1).width = 32;
    worksheet.getColumn(2).width = 22;
    worksheet.getColumn(3).width = 18;

    // =========================
    // شعار/عنوان علوي (Row 1)
    // =========================

    worksheet.mergeCells("A1:C1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "تقرير حضور - " + dayName + " - " + req.body.day;
    titleCell.font = { bold: true, size: 16, color: { argb: WHITE }, name: "Calibri" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 34;

    // =========================
    // صف معلومات المحفظ والتاريخ (Row 2)
    // =========================

    worksheet.mergeCells("A2:C2");
    const infoCell = worksheet.getCell("A2");
    infoCell.value = `المحفظ: ${getUser.name}      |      التاريخ: ${formattedDate}      |      اليوم: ${dayName}`;
    infoCell.font = { bold: true, size: 11, color: { argb: NAVY }, name: "Calibri" };
    infoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD_LIGHT } };
    infoCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 26;

    // خط فاصل ذهبي رفيع (Row 3)
    worksheet.mergeCells("A3:C3");
    worksheet.getRow(3).height = 4;
    worksheet.getCell("A3").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GOLD },
    };

    // =========================
    // Headers (Row 4)
    // =========================

    const headerRow = worksheet.getRow(4);
    headerRow.values = ["الاسم", "رقم الهاتف", "الحضور"];
    headerRow.font = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_SOFT } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: BORDER_COLOR } },
        bottom: { style: "medium", color: { argb: GOLD } },
        left: { style: "thin", color: { argb: BORDER_COLOR } },
        right: { style: "thin", color: { argb: BORDER_COLOR } },
      };
    });

    // =========================
    // إضافة بيانات الطلاب (starting row 5)
    // =========================

    let rowIndex = 5;

    attendance.forEach((attend) => {
      let attendStatus = "حاضر";

      if (attend.attend === "absent") {
        attendStatus = "غائب";
      } else if (attend.attend === "late") {
        attendStatus = "متأخر";
      } else if (attend.attend === "excused") {
        attendStatus = "بعذر";
      }

      const row = worksheet.getRow(rowIndex);
      row.values = [
        attend.student_id.name,
        attend.student_id.phone_number,
        attendStatus,
      ];
      row.height = 22;

      const isEven = rowIndex % 2 === 0;
      const baseFill = isEven ? ROW_EVEN : ROW_ODD;

      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: BORDER_COLOR } },
          bottom: { style: "thin", color: { argb: BORDER_COLOR } },
          left: { style: "thin", color: { argb: BORDER_COLOR } },
          right: { style: "thin", color: { argb: BORDER_COLOR } },
        };

        if (colNumber === 3) {
          const statusStyle = STATUS_COLORS[attendStatus];
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: statusStyle.bg },
          };
          cell.font = { bold: true, color: { argb: statusStyle.fg } };
        } else {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: baseFill },
          };
          cell.font = { color: { argb: "333333" } };
        }
      });

      rowIndex++;
    });

    // =========================
    // صف إحصائي في النهاية
    // =========================

    const total = attendance.length;
    const present = attendance.filter((a) => a.attend === "present" || !a.attend).length;
    const absent = attendance.filter((a) => a.attend === "absent").length;
    const late = attendance.filter((a) => a.attend === "late").length;
    const excused = attendance.filter((a) => a.attend === "excused").length;

    rowIndex += 1; // فاصل
    worksheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
    const summaryCell = worksheet.getCell(`A${rowIndex}`);
    summaryCell.value = `الإجمالي: ${total}   |   حاضر: ${present}   |   غائب: ${absent}   |   متأخر: ${late}   |   بعذر: ${excused}`;
    summaryCell.font = { bold: true, size: 11, color: { argb: NAVY } };
    summaryCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD_LIGHT } };
    summaryCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(rowIndex).height = 26;

    // تجميد الصفوف العلوية عند التمرير
    worksheet.views[0].state = "frozen";
    worksheet.views[0].ySplit = 4;

    // =========================
    // Response headers
    // =========================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance-${req.body.day}.xlsx`
    );

    const buffer = await workbook.xlsx.writeBuffer();

    return res.status(200).send(buffer);

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Failed to export data",
    });
  }
});

module.exports = {showReports, downloadExcel};