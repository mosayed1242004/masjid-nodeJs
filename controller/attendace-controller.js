const student = require('../models/student');
const user = require('../models/user');
const Attendance = require('../models/attendance');
const asyncMiddleware = require('../middleware/async-middleware');
const errorHandler = require('../utils/error-handler');

const cache = require("../utils/cahce");


const storeAttendance = asyncMiddleware(async (req, res, next) => {
  
  const { student_id, day, attend } = req.body;
  const startOfDay = new Date(req.body.day);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const newAttendance = await Attendance.findOneAndUpdate(
    {
      student_id: req.body.student_id,
      day: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    },
    {
      $set: {
        attend: req.body.attend
      },
      $setOnInsert: {
        student_id: req.body.student_id,
        day: startOfDay
      }
    },
    {
      returnDocument: 'after',
      upsert: true
    }
  );

  cache.del("attendances:" + req.params.userId + ":" + req.body.day);
  return res.json({status: 'success', message: 'تم حفظ الغياب بنجاح', code: 201, data: newAttendance});

});

const getAttendance = asyncMiddleware(async (req, res, next) => {
  const cacheKey = "attendances:" + req.params.userId + ":" + req.body.day;
  const cachedAttendaces = cache.get(cacheKey);

  if (cachedAttendaces) {
    console.log("from cache");
    return res.json({ status: 'success', message: "تم استرداد الغياب بنجاح", data: cachedAttendaces, code: 200 });
  }
  const getStudents = await student.find({ userId: req.body.userId });
  if (getStudents.length === 0) {
    const handler = new errorHandler("failed", "لا يوجد طلبة", 400)
    return next(handler);
  }
  const studentsIds = getStudents.map(s => s._id);
  const convertDay = new Date(req.body.day);
  const attendance = await Attendance.find({ student_id: { $in: studentsIds }, day: convertDay });
  if (attendance.length === 0 ) {
    const handler = new errorHandler("failed", "لا يوجد حضور", 400);
    return next(handler);
  }

  cache.set(cacheKey, attendance);
  return res.json({ status: 'success', message: "تم استرداد الغياب بنجاح", data: attendance, code: 200 });
})

module.exports = {
  storeAttendance,
  getAttendance
};
