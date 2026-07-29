const { body } = require('express-validator');

const validateUser = [
  body('name')
    .notEmpty()
    .isLength({ min: 2 })
    .withMessage('الاسم لا يقل عن 2 حروف'),
];

const validatePhoneNumber = [
  body("phone_number")
    .notEmpty()
    .withMessage("رقم الهاتف مطلوب")
    .matches(/^01[0125][0-9]{8}$/)
    .withMessage("برجاء إدخال رقم هاتف مصري صحيح"),
];

module.exports = {
  validateUser,
  validatePhoneNumber
};