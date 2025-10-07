// prisma/mongodb/migrations/001_init.js
async function migrate(db) {
  await db.collection('chat_rooms').createIndex({ orderId: 1, orderType: 1 });
  await db.collection('chat_rooms').createIndex({ userId: 1 });
  await db.collection('chat_rooms').createIndex({ agentId: 1 });
  await db.collection('chat_rooms').createIndex({ rocketChatRoomId: 1 });
  await db.collection('chat_messages').createIndex({ roomId: 1 });
  await db.collection('chat_messages').createIndex({ senderId: 1 });
  await db.collection('chat_reports').createIndex({ roomId: 1 });
  await db.collection('chat_reports').createIndex({ reporterId: 1 });
  console.log('MongoDB indexes created successfully');
}

module.exports = { migrate };