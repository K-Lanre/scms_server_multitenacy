const express = require('express');
const searchController = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', searchController.globalSearch);

module.exports = router;
