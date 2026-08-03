const user = require('../models/user');
const student = require('../models/student');
const asyncMiddleware = require('../middleware/async-middleware');
const errorHandler = require('../utils/error-handler');
const jwt = require("jsonwebtoken");

const getAllUsers = asyncMiddleware(async (req, res, next) => {
  const getUsers = await user.find({ role: { $ne: "admin" } });

  if (!getUsers) {
    const Handler = new errorHandler('Fail', 'لا يوجد محفظين', 400);
    return next(Handler);
  }

  res.json({ status: 'success', message: 'Users retrieved successfully', code: 200, data: getUsers });
});

const editUser = asyncMiddleware(async (req, res, next) => {
  const getStudent = await student.findById(req.body.id);

  if (!getStudent) {
    const Handler = new errorHandler('Fail', 'لا يوجد طالب', 400);
    return next(Handler);
  }

  getStudent.userId = req.body.userId;

  await getStudent.save();

  res.json({ status: 'success', message: 'Users retrieved successfully', code: 200, data: getStudent });
});

module.exports = { getAllUsers, editUser };