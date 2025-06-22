const { Router } = require('express');
const chatController = require('../controllers/chat.controller');

const router = Router();

router.post('/chat', chatController.handleChatRequest);

module.exports = router;