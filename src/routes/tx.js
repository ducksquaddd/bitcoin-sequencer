const { HighlayerTx } = require("../structs/transaction");
const blake2s = require("bcrypto/lib/blake2s");
const { base58 } = require("bstring");
const { Verifier } = require("bip322-js");
const { signData } = require("../utils/signData");
const dgram = require("dgram");
const msgpackr = require("msgpackr");

// This client is used for sending data to the connected clients
const udpSender = dgram.createSocket("udp4");

function handleTransaction(res, req, data) {
  try {
    let decodedTx = HighlayerTx.decode(data);

    if (decodedTx.actions.length <= 0) {
      res.writeStatus("400 Bad Request");
      res.tryEnd(msgpackr.encode({ Error: "Invalid TX Format" }));
      return;
    }

    const validTx = Verifier.verifySignature(
      decodedTx.address,
      decodedTx.extractedRawTxID(),
      decodedTx.signature
    );

    if (!validTx) {
      res.writeStatus("400 Bad Request");
      res.tryEnd(msgpackr.encode({ Error: "Invalid Signature" }));
      return;
    }

    let decodedTxId = decodedTx.txID();

    if (global.databases.transactions.get(decodedTxId)) {
      res.cork(() => {
        res.writeStatus("400 Bad Request");
        res.tryEnd(msgpackr.encode({ Error: "TX has already been uploaded" }));
      });
      return;
    }

    if (
      decodedTx.actions.length > 1 ||
      (decodedTx.actions[0] &&
        decodedTx.actions[0].action !== "sequencerDeposit")
    ) {
      let userBalance = global.databases.balances.get(decodedTx.address);

      if (!userBalance) {
        res.cork(() => {
          res.writeStatus("400 Bad Request");
          res.tryEnd(
            msgpackr.encode({ Error: "Insufficient Sequencer Balance" })
          );
        });
        return;
      }

      let bytes = Buffer.byteLength(data, "utf8");
      let fee = bytes * global.config.feePerByte;

      let newBalance = BigInt(userBalance) - BigInt(fee);

      if (newBalance < 0) {
        res.cork(() => {
          res.writeStatus("400 Bad Request");
          res.tryEnd(
            msgpackr.encode({ Error: "Insufficient Sequencer Balance" })
          );
        });
        return;
      }

      global.databases.balances.put(decodedTx.address, newBalance.toString());
    }

    // Increment and use the new length
    let ledgerPosition = ++global.sequencerTxIndex;
    let bundlePosition = ++global.pendingTransactionLength;

    // Add sequencer information
    decodedTx.bundlePosition = bundlePosition;
    decodedTx.sequencerTxIndex = ledgerPosition;
    decodedTx.parentBundleHash = global.recentBundle;

    decodedTx.sequencerSignature = signData(decodedTx.rawTxID());

    let signedTx = new HighlayerTx(decodedTx);
    let signedEncodedTx = signedTx.encode();

    let txHash = signedTx.txID();

    res.cork(() => {
      res.writeStatus("200 OK");
      res.writeHeader("Content-Type", "application/vnd.msgpack");
      res.tryEnd(
        msgpackr.encode({
          hash: txHash,
          bundlePosition: decodedTx.bundlePosition,
          sequencerTxIndex: decodedTx.sequencerTxIndex,
          parentBundleHash: decodedTx.parentBundleHash,
          sequencerSignature: decodedTx.sequencerSignature,
        })
      );
    });

    global.databases.transactions.put(txHash, signedEncodedTx);
    global.databases.transactions.put(decodedTxId, txHash);
    global.databases.sequencerTxIndex.put(ledgerPosition.toString(), txHash);
    global.databases.toBeSettled.put(txHash, signedEncodedTx);

    clients.forEach((client) => {
      udpSender.send(
        msgpackr.encode({
          op: 21,
          transaction: signedEncodedTx,
          sequencerTxIndex: ledgerPosition,
        }),
        client.port,
        client.address,
        (err) => {
          if (err)
            console.error("Error sending message to client:", client.key, err);
        }
      );
    });
  } catch (e) {
    console.error(e);
    res.cork(() => {
      res.writeStatus("500 Internal Server Error");
      res.tryEnd(
        msgpackr.encode({
          Error: "Internal Server Error",
        })
      );
    });
  }
}

module.exports = {
  path: "/tx",
  method: "post",
  handler: (res, req) => {
    res.onAborted(() => {
      res.aborted = true;
    });

    const contentLength = parseInt(req.getHeader("content-length"));
    if (!contentLength) {
      res.writeStatus("411 Length Required");
      res.tryEnd(msgpackr.encode({ Error: "Content-length header missing" }));
      return;
    }

    let totalBytesProcessed = 0;
    let dataStream = Buffer.allocUnsafe(contentLength);

    res.onData((chunk, isLast) => {
      totalBytesProcessed += chunk.byteLength;

      if (totalBytesProcessed > contentLength) {
        res.writeStatus("400 Bad Request");
        res.tryEnd(msgpackr.encode({ Error: "Content-length mismatch" }));
        return;
      }

      Buffer.from(chunk).copy(
        dataStream,
        totalBytesProcessed - chunk.byteLength
      );

      if (isLast) {
        if (totalBytesProcessed !== contentLength) {
          res.writeStatus("400 Bad Request");
          res.tryEnd(encode({ Error: "Content-length mismatch" }));
          return;
        }
        try {
          handleTransaction(res, req, dataStream);
        } catch (e) {
          console.error(e);
          res.writeStatus("500 Internal Server Error");
          res.tryEnd(encode({ Error: "Failed to process transaction" }));
        }
      }
    });
  },
};
