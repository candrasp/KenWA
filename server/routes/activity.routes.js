'use strict';

const express = require('express');
const router = express.Router();
const ActivityController = require('../controllers/activity.controller');

router.get('/', ActivityController.list);
router.post('/', ActivityController.create);
router.delete('/clear', ActivityController.clear);

module.exports = router;
