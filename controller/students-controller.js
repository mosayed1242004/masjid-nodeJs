const student = require('../models/student');
const user = require('../models/user');
const attendance = require('../models/attendance');
const asyncMiddleware = require('../middleware/async-middleware');
const { validationResult } = require('express-validator');
const errorHandler = require('../utils/error-handler');
const cache = require("../utils/cahce");

const storeStudent = asyncMiddleware(async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const Handler = new errorHandler('fail', errors.array()[0].msg, 400)
    return next(Handler);
  }

  const newStudent = await new student({
    ...req.body
  });

  await newStudent.save();
  cache.del("students");
  res.json({status: 'success', message: 'User stored successfully', code: 200, data: newStudent});
});

const updateStudent = asyncMiddleware(async (req, res, next) => {
  const getStudent = await student.findOneAndUpdate({ _id: req.body.id }, {...req.body});

  if (!getStudent) {
    const Handler = new errorHandler('Fail', 'الطالب غير موجود', 400);
    return next(Handler);
  }
  cache.del("students");
  res.json({ status: 'success', message: 'User updated successfully', code: 200, data: getStudent });
});

const getStudent = asyncMiddleware(async (req, res, next) => {
  const getStudent = await student.findOne({ _id: req.params.id });

  if (!getStudent) {
    const Handler = new errorHandler('Fail', 'الطالب غير موجود', 400);
    return next(Handler);
  }

  res.json({ status: 'success', message: 'User retrieved successfully', code: 200, data: getStudent });
});

const getAllStudents = asyncMiddleware(async (req, res, next) => {
  const cacheKey = "students";
  const cachedStudents = cache.get(cacheKey);
  if (cachedStudents) {
      return res.json({ status: 'success', message: 'User retrieved successfully', code: 200, data: cachedStudents });
    }
  const getUser = await user.findById(req.params.id);

  if (!getUser) {
    const Handler = new errorHandler('Fail', 'المستخدم غير موجود', 400);
    return next(Handler);
  }

  const getStudents = await student.find({ userId: getUser._id });

  if (!getStudents || getStudents.length == 0) {
    const Handler = new errorHandler('Fail', 'لا يوجد طلبة', 400);
    return next(Handler);
  }

  cache.set(cacheKey, getStudents);

  res.json({ status: 'success', message: 'User retrieved successfully', code: 200, data: getStudents });
});
const deleteStudent = asyncMiddleware(async (req, res, next) => {
  const deleteStudent = await student.findByIdAndDelete(req.params.id);
  cache.del("students");
  const deleteAttendance = await attendance.deleteMany({student_id : deleteStudent._id});
  cache.del("attendances");
  res.json({ status: 'success', message: 'تم حذف الطالب بنجاح', code: 200, data: deleteStudent });
});


module.exports = {
  storeStudent,
  updateStudent,
  getStudent,
  getAllStudents,
  deleteStudent
};
