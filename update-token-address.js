// Script: update-token-address.js
// Tự động cập nhật tokenAddress, tokenSymbol, tokenName cho signal & proposal dựa vào collection token

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://luong09876789_db_user:ljqznuIanjlOcYX0@cluster0.wr8ooyu.mongodb.net/'; 
const dbName = 'GR2'; // Đổi tên DB

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Bước 1: Đảm bảo mọi signal đều có 2 trường tokenSymbol và tokenName (nếu chưa có thì thêm với giá trị rỗng)
  const allSignals = await db.collection('signal').find({}).toArray();
  for (const s of allSignals) {
    const update = {};
    if (!('tokenSymbol' in s)) update.tokenSymbol = '';
    if (!('tokenName' in s)) update.tokenName = '';
    if (Object.keys(update).length > 0) {
      await db.collection('signal').updateOne({ _id: s._id }, { $set: update });
    }
  }

  // Lấy toàn bộ token
  const tokens = await db.collection('token').find({}).toArray();
  const tokenMap = {};
  tokens.forEach(t => {
    tokenMap[t.symbol] = t;
    tokenMap[t.name] = t;
  });

  function findToken(val) {
    if (!val) return null;
    return tokenMap[val] || null;
  }

  // Update cho collection signal
  const signals = await db.collection('signal').find({}).toArray();
  for (const s of signals) {
    let guess = null;
    if (s.tokenSymbol) guess = findToken(s.tokenSymbol);
    if (!guess && s.tokenName) guess = findToken(s.tokenName);

    // Dò từ rationaleSummary
    if (!guess && s.rationaleSummary && s.rationaleSummary.toLowerCase().includes('tron')) {
      guess = findToken('TRX') || findToken('Tron');
    }

    // Dò từ sources (ví dụ: justinsuntron → TRX)
    if (!guess && Array.isArray(s.sources)) {
      if (s.sources.some(src => src.url && src.url.includes('justinsuntron'))) {
        guess = findToken('TRX') || findToken('Tron');
      }
    }

    // Nếu tìm được token, cập nhật đủ 3 trường
    if (guess) {
      await db.collection('signal').updateOne(
        { _id: s._id },
        { $set: { tokenAddress: guess.symbol, tokenSymbol: guess.symbol, tokenName: guess.name } }
      );
    }
  }

  // Update cho collection proposal
  const proposals = await db.collection('proposal').find({}).toArray();
  for (const p of proposals) {
    if (p.tokenAddress && p.tokenAddress !== 'unknown') continue;
    let guess = null;
    if (p.tokenSymbol) guess = findToken(p.tokenSymbol);
    if (!guess && p.tokenName) guess = findToken(p.tokenName);
    if (guess) {
      await db.collection('proposal').updateOne(
        { _id: p._id },
        { $set: { tokenAddress: guess.symbol, tokenSymbol: guess.symbol, tokenName: guess.name } }
      );
    }
  }

  console.log('Done!');
  await client.close();
}

main();
