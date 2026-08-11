const student = require('../models/student');
const user = require('../models/user');
const Attendance = require('../models/attendance');
const Test = require("../models/test");
const asyncMiddleware = require('../middleware/async-middleware');
const errorHandler = require('../utils/error-handler');

const storeTests = asyncMiddleware(async (req, res, next) => {
  const tests = req.body;

  if (!Array.isArray(tests) || tests.length === 0) {
    const Handler = new errorHandler("failed", "البيانات المرسلة غير صحيحة", 400);
    return next(Handler);
  }

  const studentIds = tests.map(test => test.student_id);

  const students = await student.find({ _id: { $in: studentIds } });
  if (!students || students.length === 0) {
    const Handler = new errorHandler("failed", "المستخدم غير متاح", 401);
    return next(Handler);
  }

  const operations = tests.map(test => ({
  updateOne: {
    filter: {
      student_id: test.student_id,
      name: test.name
    },
    update: {
      $set: {
        degree: test.degree
      }
    },
    upsert: true
  }
}));

const storeTests = await Test.bulkWrite(operations);

  return res.json({ status: "success", message: "تم حفظ التقييمات بنجاح", data: storeTests, code: 201 });
});


const getTests = asyncMiddleware(async (req, res, next) => {
  const getStudents = await student.find({ userId: req.params.userId });

  if (getStudents.length === 0) {
    const handler = new errorHandler("failed", "لا يوجد طلبة", 400)
    return next(handler);
  }
  const studentsIds = getStudents.map(s => s._id);
  const getTests = await Test.aggregate([
  {
    $match: {
      student_id: { $in: studentsIds }
    }
  },
  {
    $group: {
      _id: "$student_id",
      totalDegree: {
        $sum: "$degree"
      }
    }
  },
  {
    $lookup: {
      from: "students",
      localField: "_id",
      foreignField: "_id",
      as: "student"
    }
  },
  {
    $unwind: "$student"
  },
  {
    $project: {
      _id: 0,
      student_id: "$_id",
      name: "$student.name",
      totalDegree: 1
    }
  }
]);
  if (getTests.length === 0 ) {
    const handler = new errorHandler("failed", "لا يوجد تقييمات", 400);
    return next(handler);
  }

  return res.json({ status: 'success', message: "تم استرداد التقييمات بنجاح", data: getTests, code: 200 });
})

const getAllTests = asyncMiddleware(async (req, res, next) => {
  const getTests = await Test.aggregate([
  {
    $group: {
      _id: "$student_id",
      totalDegree: { $sum: "$degree" },
    },
  },
  {
    $lookup: {
      from: "students", // collection name in MongoDB
      localField: "_id",
      foreignField: "_id",
      as: "student",
    },
  },
  {
    $unwind: "$student",
  },
  {
    $project: {
      _id: 0,
      student_id: "$student.student_id",
      name: "$student.name",
      totalDegree: 1,
    },
  },
  {
    $sort: { totalDegree: -1 },
  },
  {
    $limit: 15,
  },
]);
  return res.json(getTests);
})

module.exports = {
  storeTests,
  getTests,
  getAllTests
};
