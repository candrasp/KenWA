'use strict';

const router = require('express').Router();
const ContactController = require('../controllers/contact.controller');

router.get   ('/',    ContactController.list);
router.get   ('/check', ContactController.check);
router.get   ('/:id', ContactController.show);
router.post  ('/',    ContactController.create);
router.post  ('/sync',  ContactController.sync);
router.post  ('/verify/:id', ContactController.verify);
router.put   ('/:id', ContactController.update);
router.post  ('/bulk-tags', ContactController.bulkAddTags);
router.delete('/',    ContactController.bulkDestroy);
router.delete('/:id', ContactController.destroy);

module.exports = router;
