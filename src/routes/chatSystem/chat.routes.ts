// src/chat/chat.routes.ts
import { Router } from 'express';
import { ChatController } from '../../controllers/ChatSystem/chat.controller';
import { authenticationMiddleware } from '../../middlewares/authentication';

const router = Router();
const chatController = new ChatController();

router.post('/initialize', authenticationMiddleware, chatController.initializeChatRoom.bind(chatController));
router.post('/message', authenticationMiddleware, chatController.sendMessage.bind(chatController));
router.post('/report', authenticationMiddleware, chatController.submitReport.bind(chatController));
router.post('/end', authenticationMiddleware, chatController.endChat.bind(chatController));
router.get('/:orderId/:orderType', authenticationMiddleware, chatController.getChatRoom.bind(chatController));

export default router;