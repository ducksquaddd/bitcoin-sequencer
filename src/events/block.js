const bcoin = require("../../bcoin");
const { HighlayerBundle } = require("../structs/bundle");
const { iterateData } = require("../utils/iterateData");
const { base58 } = require("bstring");
const blake2s = require("bcrypto/lib/blake2s");

module.exports = async (chainEntry, block) => {
  global.block = chainEntry.height;
  console.log(global.block);

  await manageBlockCounter();
};

/* Decides when to upload bundles */
async function manageBlockCounter() {
  const now = Date.now();
  if (now - global.lastBlockTime > global.blockResetThreshold) {
    global.blockCounter++;
    if (global.blockCounter >= global.config.blockLengthToBundle) {
      if (pendingTransactionLength <= 0)
        return console.log("Empty bundle, stopping");
      await generateBundle();
      global.blockCounter = 0;
    }
  }
  global.lastBlockTime = now;
}

async function generateBundle() {
  // Returns all tx hashes, and deletes them from mempool
  let mempool = await exportMempool();

  // Waste of money to upload an empty bundle
  if (mempool.length <= 0) {
    return console.log("Empty bundle, stopping");
  }

  let bundle = new HighlayerBundle(global.recentBundle, mempool);

  let hash = blake2s.digest(Buffer.from(bundle.encode()), 32);

  global.recentBundle = hash.toString("hex");
  global.global.pendingTransactionLength = 0;
  let bundleLength = ++global.bundleLength;

  console.log("Attempting to upload bundle hash:", hash.toString("hex"));
  let tx = await createTx(hash);
  await global.databases.pendingBundles.put(tx.txid(), {
    bundleNumber: bundleLength.toString(),
    bundleHash: hash.toString("hex"),
    txhash: tx.hash(),
    txid: tx.txid(),
    blockCreated: global.block,
  });
  await global.databases.bundles.put(bundleLength.toString(), bundle.encode());
  await global.databases.bundleHash.put(
    hash.toString("hex"),
    bundleLength.toString()
  );

  global.node.broadcast(tx);
}

async function exportMempool() {
  let hashes = [];
  for await (let { key, value } of await global.databases.toBeSettled.getRange(
    {}
  )) {
    hashes.push(key);
    global.databases.toBeSettled.remove(key);
  }

  return hashes;
}

/* Helper function that creates transaction to upload */
async function createTx(hash) {
  const FEE = 10000;
  const mtx = new bcoin.MTX(); // Create a mutable transaction
  let coins = await global.wallet.getSmartCoins(global.account.accountIndex); // get all spendable coins

  console.log(coins);

  const totalValue = coins.reduce((acc, coin) => acc + coin.value, 0);
  console.log("Total Value of Valid Coins:", totalValue);

  const changeValue = totalValue - FEE;
  console.log("Change Value after Fee:", changeValue);

  coins.forEach((coin) => {
    mtx.addCoin(coin);
  });

  mtx.addOutput(address, changeValue);
  mtx.addOutput(bcoin.Output.fromScript(bcoin.Script.fromNulldata(hash), 0));

  await global.wallet.sign(mtx);
  const tx = mtx.toTX();

  return tx;
}
