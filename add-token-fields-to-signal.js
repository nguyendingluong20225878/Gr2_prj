// Script: add-token-fields-to-signal.js
// Thêm 2 trường tokenSymbol và tokenName vào tất cả signal nếu chưa có

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://luong09876789_db_user:ljqznuIanjlOcYX0@cluster0.wr8ooyu.mongodb.net/'; 
const dbName = 'GR2'; // Đổi tên DB

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Lấy toàn bộ signal
  const signals = await db.collection('signal').find({}).toArray();
  let count = 0;
  for (const s of signals) {
    const update = {};
    if (!('tokenSymbol' in s)) update.tokenSymbol = '';
    if (!('tokenName' in s)) update.tokenName = '';
    if (Object.keys(update).length > 0) {
      await db.collection('signal').updateOne({ _id: s._id }, { $set: update });
      count++;
    }
  }
  console.log(`Đã thêm tokenSymbol/tokenName cho ${count} signal.`);
  await client.close();
}

main();
