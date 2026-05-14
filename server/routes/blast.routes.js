'use strict';

const router = require('express').Router();
const BlastController = require('../controllers/blast.controller');

// Templates
router.get   ('/templates',     BlastController.listTemplates);
router.post  ('/templates',     BlastController.createTemplate);
router.put   ('/templates/:id', BlastController.updateTemplate);
router.delete('/templates/:id', BlastController.deleteTemplate);

// History
router.get('/history', BlastController.listHistory);
router.get('/stats',   BlastController.getStats);

// Start blast
router.post('/start', BlastController.startBlast);

module.exports = router;
