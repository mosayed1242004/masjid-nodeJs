const user = require('../models/user');
const asyncMiddleware = require('../middleware/async-middleware');
const { validationResult } = require('express-validator');
const errorHandler = require('../utils/error-handler');
const jwt = require("jsonwebtoken");

const storeUser = asyncMiddleware(async (req, res, next) => {
  let storeUser;
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    
    const Handler = new errorHandler('Fail', errors.array().msg, 400);
    return next(Handler);
  }

  const getUser = await user.findOne({ name: req.body.name });
  if (getUser) {
    storeUser = getUser;
  } else {
    storeUser = await new user({
      name: req.body.name
    });
    storeUser.save();
  }


  res.json({status: 'success', message: 'User stored successfully', code: 200, data: storeUser});
});

const getUser = asyncMiddleware(async (req, res, next) => {
  const getUser = await user.findById(req.params.id);

  if (!getUser) {
    const Handler = new errorHandler('Fail', 'المستخدم غير موجود', 400);
    return next(Handler);
  }

  res.json({ status: 'success', message: 'User retrieved successfully', code: 200, data: getUser });
});

const deleteUser = asyncMiddleware(async (req, res, next) => {
  await user.findByIdAndDelete(req.params.id);

  res.json({ status: 'success', message: 'تم حذف المحفظ', code: 200})
})

const loginAdmin = asyncMiddleware(async (req, res, next) => {
  const getUser = await user.findOne({ name: req.body.name, password: req.body.password });
  if (!getUser) {
    const Handler = new errorHandler('Fail', 'المستخدم غير موجود', 400);
    return next(Handler);
  }

  const token = jwt.sign({ email: getUser.email, id: getUser._id, role: getUser.role }, process.env.JWT_SECRET_KEY,);

  getUser.token = token;
  await getUser.save();

  return res.json({ status: 'success', message: 'User retrieved successfully', code: 200, data: getUser});


})


module.exports = {
  storeUser,
  getUser,
  deleteUser,
  loginAdmin
};
