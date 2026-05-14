'use strict';

const express = require('express');
const router = express.Router();
const SettingController = require('../controllers/setting.controller');

router.get('/', SettingController.get);
router.put('/', SettingController.update);

module.exports = router;
