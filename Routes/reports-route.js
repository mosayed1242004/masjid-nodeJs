const app = require('express');
const router = app.Router();

const {showReports, downloadExcel, showAdminReports, downloadExcelAdmin, downloadAdminTestsDegree}  = require('../controller/reports-controller');
const verifyToken = require('../middleware/verify-token-middleware');

const { validateUser }  = require('../middleware/validator-middleware');

router.route('/')
  .post(showReports);

router.route('/admin')
  .post(verifyToken, showAdminReports);

router.route('/download')
  .post(downloadExcel);

router.route('/download/admin')
  .get(downloadAdminTestsDegree)
  .post(verifyToken, downloadExcelAdmin);

module.exports = router;
