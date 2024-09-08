const bcoin = require("../bcoin");
const WalletPlugin = require("../bcoin/lib/wallet/plugin");
const lmdb = require("lmdb");
const fs = require("fs");
const path = require("path");
const ed25519 = require("bcrypto/lib/ed25519");
const { base58 } = require("bstring");
const blake2s = require("bcrypto/lib/blake2s");
const secret = require("../.secret/sequencer-secret.json");
const { iterateData } = require("./utils/iterateData");

(async () => {
  const dbDir = path.resolve("./db");
  global.config = JSON.parse(
    fs.readFileSync(`${__dirname}/config.json`, "utf8")
  );

  global.databases = {
    transactions: lmdb.open(`${dbDir}/transactions`),
    sequencerTxIndex: lmdb.open(`${dbDir}/sequencerTxIndex`), // Stores all the transaction hashes indexed by the number
    pendingBundles: lmdb.open(`${dbDir}/pendingBundles`), // index'd by the transaction txid
    confirmedBundles: lmdb.open(`${dbDir}/confirmedBundles`), // index'd by the transaction txid, and stores the bundle's hash
    bundleHash: lmdb.open(`${dbDir}/bundleHash`), // Index'd the bundle hash and keys the bundle number
    bundles: lmdb.open(`${dbDir}/bundles`), // Stores the entire bundle indexed by number
    toBeSettled: lmdb.open(`${dbDir}/toBeSettled`), // Transactions that have been uploaded but arent yet bundled. Used to sync old mempool onload
    balances: lmdb.open(`${dbDir}/balances`), // Stores user sequencer user deposits,
    depositsIndexed: lmdb.open(`${dbDir}/depositsIndexed`), // Stores the hashes of all deposit txs,
  };

  bcoin.set(global.config.network);
  global.node = new bcoin.FullNode({
    prefix: "~/.highlayer-sequencer-chain",
    file: true,
    "max-files": 256,
    argv: true,
    env: true,
    logFile: true,
    create: true,
    logConsole: true,
    logLevel: "error",
    "max-outbound": 25,
    memory: false,
    network: global.config.network,
    workers: true,
    listen: true,
    indexTX: true,
    indexAddress: true,
    loader: require,
    ensure: true,
  });
  await node.ensure();
  node.use(WalletPlugin);
  await node.open();
  await node.connect();
  const { wdb } = node.get("walletdb");

  global.pendingTransactionLength = 0; // Transactions that are not yet in a confirmed bundle
  global.sequencerTxIndex = 0; // The total transactions length
  global.bundleLentgh = 0; // The total amount of bundles
  global.recentBundleHash = ""; // The most recent parent bundle hash
  /*
    Bundles are made every 5 blocks however when the node is syncing it will spam blocks
    (AFAIK bcoin doesnt have a fully synced event that i could get working)
    
    so this is kinda a hacky way to not make bundles when syncing
  */
  global.lastBlockTime = Date.now();
  global.blockCounter = 0;
  global.blockResetThreshold = 15000;

  // Setup Wallet for uploading bundles
  global.wallet = await wdb.get(await wdb.getWID("sequencer"));
  global.account = await wallet.getAccount("sequencer");
  global.address = account.deriveReceive(0).getAddress("string");
  global.sequencerPubkey = ed25519
    .publicKeyCreate(Buffer.from(secret.sequencer_privkey, "hex"))
    .toString("hex");

  // Node data syncing
  global.pendingTransactionLength = await iterateData(
    global.databases.toBeSettled
  );
  global.sequencerTxIndex = await iterateData(
    global.databases.sequencerTxIndex
  );
  global.bundleLength = await iterateData(global.databases.bundles);
  console.log(global.bundleLength);
  global.recentBundle = global.bundleLength
    ? blake2s
        .digest(
          Buffer.from(
            await global.databases.bundles.get(global.bundleLength.toString())
          )
        )
        .toString("hex")
    : "Genesis";

  console.log("Current Bundle hash: " + recentBundle);

  node.startSync();
  await require("./handler.js")();

  /* Used to confrim bundles, well really delete a bundle so it doesnt have to get reuploaded */
  global.wallet.on("confirmed", async (tx, details) => {
    console.log(tx);
    let pendingBundle = await global.databases.pendingBundles.get(tx.txid());

    if (!pendingBundle) {
      return console.log("hrm");
    }

    console.log("Confirmed bundle", pendingBundle.bundleHash);

    await global.databases.confirmedBundles.put(
      tx.txid(),
      pendingBundle.bundleHash
    );
    await global.databases.pendingBundles.remove(tx.txid());
  });

  // Handles bundle making
  node.chain.on("connect", require("./events/block"));
  // node.chain.on('disconnect', require('./events/reorg'));
})();
