const app = require('express');
const router = app.Router();

const { storeStudent, updateStudent, getStudent, getAllStudents, deleteStudent } = require('../controller/students-controller');
const { editUser } = require('../controller/user-controller');


const { validateUser, validatePhoneNumber }  = require('../middleware/validator-middleware');
const verifyToken = require('../middleware/verify-token-middleware');

router.route('/')
  .post(validatePhoneNumber, storeStudent)
  .put(updateStudent);

router.route('/:id')
  .get(getAllStudents)
  .get(getStudent)
  .delete(deleteStudent);

router.route('/editUser')
  .post(verifyToken, editUser)

module.exports = router;