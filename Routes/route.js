const app = require('express');
const router = app.Router();

const { storeUser, getUser, deleteUser, loginAdmin } = require('../controller/login-controller');
const { getAllUsers } = require("../controller/user-controller");


const { validateUser } = require('../middleware/validator-middleware');
const verifyToken = require('../middleware/verify-token-middleware');

router.route('/')
  .post(validateUser, storeUser);

router.route('/:id')
  .get(getUser)
  .delete(deleteUser)

router.route('/admin/getUsers')
  .post(loginAdmin)
  .get(verifyToken, getAllUsers);


module.exports = router;