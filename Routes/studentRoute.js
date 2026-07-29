const app = require('express');
const router = app.Router();

const {storeStudent, updateStudent, getStudent, getAllStudents, deleteStudent} = require('../controller/students-controller');


const { validateUser, validatePhoneNumber }  = require('../middleware/validator-middleware');

router.route('/')
  .post(validatePhoneNumber, storeStudent)
  .put(updateStudent);

router.route('/:id')
  .get(getAllStudents)
  .get(getStudent)
  .delete(deleteStudent);

module.exports = router;