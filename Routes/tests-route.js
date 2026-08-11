const app = require('express');
const router = app.Router();

const { storeTests, getTests } = require('../controller/tests-controller');
const verifyToken = require('../middleware/verify-token-middleware');


const { validateUser }  = require('../middleware/validator-middleware');

router.route('/')
  .post(storeTests)
  .get(verifyToken, getAllTests)

router.route('/:userId')
  .get(getTests)
module.exports = router;
