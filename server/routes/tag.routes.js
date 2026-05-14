'use strict';

const express = require('express');
const router = express.Router();
const TagController = require('../controllers/tag.controller');

router.get('/', TagController.list);
router.get('/:id', TagController.show);
router.post('/', TagController.create);
router.put('/:id', TagController.update);
router.delete('/:id', TagController.destroy);
router.delete('/', TagController.bulkDelete);

module.exports = router;
