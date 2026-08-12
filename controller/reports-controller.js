const student = require('../models/student');
const user = require('../models/user');
const Attendance = require('../models/attendance');
const ExcelJS = require("exceljs")
const asyncMiddleware = require('../middleware/async-middleware');
const { validationResult } = require('express-validator');
const errorHandler = require('../utils/error-handler');
const test = require('../models/test');


const showReports = asyncMiddleware(async (req, res, next) => {

  const [fromYear, fromMonth, fromDay] = req.body.from.split("-").map(Number);
  const [toYear, toMonth, toDay] = req.body.to.split("-").map(Number);

  const startOfDay = new Date(
    Date.UTC(fromYear, fromMonth - 1, fromDay)
  );

  const endOfDay = new Date(
    Date.UTC(toYear, toMonth - 1, toDay + 1)
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

const showAdminReports = asyncMiddleware(async (req, res, next) => {

  const [fromYear, fromMonth, fromDay] = req.body.from.split("-").map(Number);
  const [toYear, toMonth, toDay] = req.body.to.split("-").map(Number);

  const startDate = new Date(
    Date.UTC(fromYear, fromMonth - 1, fromDay)
  );

  const endDate = new Date(
    Date.UTC(toYear, toMonth - 1, toDay + 1) // +1 to make the end date inclusive
  );

  const getStudents = await student.find({});

  const studentsIds = getStudents.map(s => s._id);

  if (!studentsIds || studentsIds.length == 0) {
    const Handler = new errorHandler('Fail', 'لا يوجد طلبة', 400);
    return next(Handler);
  }

  const attendanceStats = await Attendance.aggregate([
    {
      $match: {
        day: {
          $gte: startDate,
          $lt: endDate
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

  res.json({ status: 'success', message: 'تم استرجاع البيانات بنجاح', code: 200, data: percentages });
});


const downloadExcel = asyncMiddleware(async (req, res, next) => {
  try {
    const startOfDay = new Date(req.body.from);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(req.body.to);
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
    const attendance = await Attendance.aggregate([
  // 1. فلترة بالتاريخ
  {
    $match: {
      day: { $gte: startOfDay, $lt: endOfDay }
    }
  },

  // 2. جلب بيانات الطالب
  {
    $lookup: {
      from: "students",
      localField: "student_id",
      foreignField: "_id",
      as: "student"
    },
  },
  { $unwind: "$student" },
  {
    $match: {
      "student.userId": req.body.userId
    }
  },

{
    $group: {
      _id: "$student._id",

      studentName: {
        $first: "$student.name"
      },

      phone: {
        $first: "$student.phone_number"
      },

      totalDays: {
        $sum: 1
      },

      presentCount: {
        $sum: {
          $cond: [
            { $eq: ["$attend", "present"] },
            1,
            0
          ]
        }
      },

      absentCount: {
        $sum: {
          $cond: [
            { $eq: ["$attend", "absent"] },
            1,
            0
          ]
        }
      }
    }
  }
]);

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

    const worksheet = workbook.addWorksheet(`تقرير - ${req.body.from} الي ${req.body.to}`, {
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
    worksheet.getColumn(4).width = 18;

    // =========================
    // شعار/عنوان علوي (Row 1)
    // =========================

    worksheet.mergeCells("A1:D1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "تقرير حضور - " + req.body.from + " - " + req.body.to;
    titleCell.font = { bold: true, size: 16, color: { argb: WHITE }, name: "Calibri" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 34;

    // =========================
    // صف معلومات المحفظ والتاريخ (Row 2)
    // =========================

    worksheet.mergeCells("A2:D2");
    const infoCell = worksheet.getCell("A2");
    infoCell.value = `المحفظ: ${getUser.name}      |      التاريخ: ${req.body.from}      |      اليوم: ${req.body.to}`;
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
    headerRow.values = ["الاسم", "رقم الهاتف", "ايام الحضور", "ايام الغياب"];
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

      const row = worksheet.getRow(rowIndex);
      row.values = [
        attend.studentName,
        attend.phone,
        attend.presentCount,
        attend.absentCount
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
          const statusStyle = STATUS_COLORS["حاضر"];
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: statusStyle.bg },
          };
          cell.font = { bold: true, color: { argb: statusStyle.fg } };
        } else if (colNumber === 4) {
          const statusStyle = STATUS_COLORS["غائب"];
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: statusStyle.bg },
          };
          cell.font = { bold: true, color: { argb: statusStyle.fg } };
        }
        else {
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
    // Response headers
    // =========================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance-${req.body.from}-${req.body.to}.xlsx`
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

const downloadExcelAdmin = asyncMiddleware(async (req, res, next) => {
  const [fromYear, fromMonth, fromDay] = req.body.from.split("-").map(Number);
  const [toYear, toMonth, toDay] = req.body.to.split("-").map(Number);

  const startDate = new Date(
    Date.UTC(fromYear, fromMonth - 1, fromDay)
  );

  const endDate = new Date(
    Date.UTC(toYear, toMonth - 1, toDay + 1) // +1 to make the end date inclusive
  );
  const getAttendanceStates = await Attendance.aggregate([
    {
      $match: {
        day: {
          $gte: startDate,
          $lt: endDate
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

const result = await Attendance.aggregate([
  // 1. فلترة بالتاريخ
  {
    $match: {
      day: { $gte: startDate, $lt: endDate }
    }
  },

  // 2. جلب بيانات الطالب
  {
    $lookup: {
      from: "students",
      localField: "student_id",
      foreignField: "_id",
      as: "student"
    }
  },
  { $unwind: "$student" },

  // 3. تجميع لكل طالب
  {
    $group: {
      _id: {
        userId: "$student.userId",
        studentId: "$student._id",
        studentName: "$student.name",
        phone: "$student.phone_number",
      },
      totalDays: { $sum: 1 },                                                        // كل الأيام
      presentCount: {
        $sum: { $cond: [{ $eq: ["$attend", "present"] }, 1, 0] }                    // أيام الحضور
      },
      absentCount: {
        $sum: { $cond: [{ $eq: ["$attend", "absent"] }, 1, 0] }                     // أيام الغياب
      }
    }
  },

  // 4. حساب النسبة والدرجة
  {
    $addFields: {
      attendancePercentage: {
        $round: [
          { $multiply: [{ $divide: ["$presentCount", "$totalDays"] }, 100] },
          2                                                                           // رقمين بعد العلامة
        ]
      },
      grade: {
        $round: [
          { $multiply: [{ $divide: ["$presentCount", "$totalDays"] }, 10] },
          2
        ]
      }
    }
  },

  // 5. تجميع الطلاب تحت الـ userId
  {
    $group: {
      _id: "$_id.userId",
      students: {
        $push: {
          studentId: "$_id.studentId",
          name: "$_id.studentName",
          phone: "$_id.phone",
          totalDays: "$totalDays",
          presentCount: "$presentCount",
          absentCount: "$absentCount",
          attendancePercentage: "$attendancePercentage",                             // مثال: 85.71
          grade: "$grade"                                                             // مثال: 8.57
        }
      }
    }
  },

  // 6. حول _id من String لـ ObjectId
  {
    $addFields: {
      userObjectId: { $toObjectId: "$_id" }
    }
  },

  // 7. جلب بيانات الـ User
  {
    $lookup: {
      from: "users",
      localField: "userObjectId",
      foreignField: "_id",
      as: "user"
    }
  },
  { $unwind: "$user" },

  // 8. الـ output النهائي
  {
    $project: {
      _id: 0,
      user: {
        _id: "$user._id",
        name: "$user.name"
      },
      students: 1
    }
  }
]);

  for (const std of result) {
  for (const student of std.students) {
    await test.findOneAndUpdate(
      { student_id: student.studentId },
      {
        $set: {
          student_id: student.studentId,
          name: "الحضور",
          degree: student.grade
        }
      },
      {
        upsert: true,
        returnDocument: 'after' 
      }
    );
  }
}

  let total = 0;

  let counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  };

  getAttendanceStates.forEach(e => {
    total += e.count;
    counts[e._id] = e.count;
  })


  const persentage = {
    present: Math.round(counts.present / total * 100),
    absent: Math.round(counts.absent / total * 100),
    late: Math.round(counts.late / total * 100),
    excused: Math.round(counts.excused / total * 100)
  }

const NAVY       = "0B1D3A";
const NAVY_SOFT  = "13294B";
const GOLD       = "C9A227";
const GOLD_LIGHT = "F5EBC8";
const WHITE      = "FFFFFF";
const ROW_EVEN   = "F4F6F9";
const ROW_ODD    = "FFFFFF";
const BORDER_COLOR = "D9DEE7";

const GRADE_COLORS = {
  high: { fg: "1E7F4F", bg: "E5F5EC" },  // >= 8 أخضر
  mid:  { fg: "9A6B00", bg: "FFF3D6" },  // >= 5 أمبر
  low:  { fg: "B3261E", bg: "FBE7E6" },  // < 5  أحمر
};

// ====== Helpers ======
const fill = (argb) => ({
  type: "pattern", pattern: "solid",
  fgColor: { argb },
});

const borders = (bottomColor = BORDER_COLOR, bottomStyle = "thin") => ({
  top:    { style: "thin",        color: { argb: BORDER_COLOR } },
  left:   { style: "thin",        color: { argb: BORDER_COLOR } },
  right:  { style: "thin",        color: { argb: BORDER_COLOR } },
  bottom: { style: bottomStyle,   color: { argb: bottomColor  } },
  });

  const STATUS_COLORS = {
  "حاضر":  { fg: "1E7F4F", bg: "E5F5EC" },  // أخضر
  "غائب":  { fg: "B3261E", bg: "FBE7E6" },  // أحمر
  "متأخر": { fg: "9A6B00", bg: "FFF3D6" },  // أمبر
  "بعذر":  { fg: "3B5BA5", bg: "E7ECFA" },  // أزرق
};

const gradeTheme = (grade) =>
  grade >= 8 ? GRADE_COLORS.high :
  grade >= 5 ? GRADE_COLORS.mid  : GRADE_COLORS.low;

// ====== Workbook ======
const workbook = new ExcelJS.Workbook();
workbook.creator = "نظام إدارة حلقات القرآن الكريم";
workbook.created = new Date();

const worksheet = workbook.addWorksheet(
  `تقرير من ${startDate.getDate()} إلي ${endDate.getDate()}`,
  {
    properties: { defaultRowHeight: 22 },
    pageSetup:  { fitToPage: true, fitToWidth: 1, orientation: "portrait" },
    views:      [{ rightToLeft: true }],
  }
);

// ====== عرض الأعمدة ======
[18, 30, 18, 14, 14, 14].forEach((w, i) =>
  worksheet.getColumn(i + 1).width = w
);

// ====== Row 1 — عنوان التقرير ======
worksheet.mergeCells("A1:F1");
const titleCell = worksheet.getCell("A1");
titleCell.value     = "📋  تقرير نسبة الحضور";
titleCell.font      = { bold: true, size: 18, color: { argb: WHITE }, name: "Calibri" };
titleCell.fill      = fill(NAVY);
titleCell.alignment = { horizontal: "center", vertical: "middle" };
titleCell.border    = borders(GOLD, "medium");
worksheet.getRow(1).height = 38;

// ====== Row 2 — عناوين الإحصائيات ======
const statsHeaders = ["حاضر", "غائب", "متأخر", "بعذر"];
const statsRow = worksheet.getRow(2);
statsRow.height = 26;
statsHeaders.forEach((label, i) => {
  const cell    = statsRow.getCell(i + 1);
  cell.value    = label;
  cell.font     = { bold: true, size: 12, color: { argb: WHITE }, name: "Calibri" };
  cell.fill     = fill(NAVY_SOFT);
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border   = borders(GOLD, "medium");
});

// ====== Row 3 — قيم الإحصائيات ======
const statsValues = [
  { value: `${persentage.present}%`,  key: "حاضر"  },
  { value: `${persentage.absent}%`,   key: "غائب"  },
  { value: `${persentage.late}%`,     key: "متأخر" },
  { value: `${persentage.excused}%`,  key: "بعذر"  },
];
const valuesRow = worksheet.getRow(3);
valuesRow.height = 24;
statsValues.forEach(({ value, key }, i) => {
  const theme   = STATUS_COLORS[key];
  const cell    = valuesRow.getCell(i + 1);
  cell.value    = value;
  cell.font     = { bold: true, size: 13, color: { argb: theme.fg }, name: "Calibri" };
  cell.fill     = fill(theme.bg);
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border   = borders(BORDER_COLOR);
});

// ====== Rows 4+ — المعلمون والطلاب ======
let rowIndex = 4;

result.forEach((user) => {

  // ── صف اسم المعلم ──────────────────────────────────────────
  worksheet.mergeCells(`A${rowIndex}:F${rowIndex}`);
  const userRow      = worksheet.getRow(rowIndex);
  userRow.height     = 30;
  const userCell     = userRow.getCell(1);
  userCell.value     = `👤  ${user.user.name}`;
  userCell.font      = { bold: true, size: 13, color: { argb: WHITE }, name: "Calibri" };
  userCell.fill      = fill(NAVY);
  userCell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  userCell.border    = borders(GOLD, "medium");
  rowIndex++;

  // ── صف عناوين الجدول ───────────────────────────────────────
  const HEADERS = ["#", "الاسم", "رقم الهاتف", "مرات الغياب", "مرات الحضور", "الدرجة / 10"];
  const headerRow  = worksheet.getRow(rowIndex);
  headerRow.height = 24;
  HEADERS.forEach((h, i) => {
    const cell     = headerRow.getCell(i + 1);
    cell.value     = h;
    cell.font      = { bold: true, size: 11, color: { argb: GOLD_LIGHT }, name: "Calibri" };
    cell.fill      = fill(NAVY_SOFT);
    cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    cell.border    = borders(GOLD, "medium");
  });
  rowIndex++;

  // ── صفوف الطلاب ────────────────────────────────────────────
  user.students.forEach((student, idx) => {
    const isEven  = idx % 2 === 0;
    const row     = worksheet.getRow(rowIndex);
    const theme   = gradeTheme(student.grade);
    row.height    = 22;

    const cells = [
      { value: idx + 1,              align: "center", isGrade: false },
      { value: student.name,         align: "right",  isGrade: false },
      { value: student.phone,        align: "center", isGrade: false },
      { value: student.absentCount,  align: "center", isGrade: false },
      { value: student.presentCount, align: "center", isGrade: false },
      { value: Math.round(student.grade),        align: "center", isGrade: true  },
    ];

    cells.forEach(({ value, align, isGrade }, i) => {
      const cell     = row.getCell(i + 1);
      cell.value     = isGrade ? parseFloat(student.grade.toFixed(2)) : value;
      cell.font      = {
        name:  "Calibri",
        size:  11,
        bold:  isGrade,
        color: { argb: isGrade ? theme.fg : NAVY },
      };
      cell.fill      = fill(isGrade ? theme.bg : isEven ? ROW_EVEN : ROW_ODD);
      cell.alignment = { horizontal: align, vertical: "middle", readingOrder: "rtl" };
      cell.border    = borders();
      if (isGrade) cell.numFmt = "0.00";
    });

    row.commit();
    rowIndex++;
  });

  // ── صف فاصل ────────────────────────────────────────────────
  worksheet.mergeCells(`A${rowIndex}:F${rowIndex}`);
  const sepCell  = worksheet.getCell(`A${rowIndex}`);
  sepCell.fill   = fill(GOLD);
  worksheet.getRow(rowIndex).height = 4;
  rowIndex++;
});

      res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance-${req.body.from}-to-${req.body.to}.xlsx`
    );

    const buffer = await workbook.xlsx.writeBuffer();

    return res.status(200).send(buffer);

})

module.exports = {showReports, downloadExcel, showAdminReports, downloadExcelAdmin};
