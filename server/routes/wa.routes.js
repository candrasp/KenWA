'use strict';

const router = require('express').Router();
const WaController = require('../controllers/wa.controller');

router.get ('/',           WaController.getStatus);
router.post('/connect',    WaController.connect);
router.post('/disconnect', WaController.disconnect);

module.exports = router;
