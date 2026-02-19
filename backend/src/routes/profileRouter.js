const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.post(`/usercomment`, profileController.usercomment);

module.exports = router;
