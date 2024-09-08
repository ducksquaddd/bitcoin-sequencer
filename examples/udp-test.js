const dgram = require("dgram");
const client = dgram.createSocket("udp4");
const msgpackr = require("msgpackr");
const { HighlayerTx } = require("../src/structs/transaction");

const SERVER_PORT = 2881;
const SERVER_ADDRESS = "localhost";

client.on("message", (msg, rinfo) => {
  const message = msgpackr.decode(msg);
  console.log(message);
  if (message.op === 11) {
    console.log("Heartbeat ACK received from server");
  } else if (message.op === 21) {
    console.log(HighlayerTx.decode(message.transaction));
  }
});

// Send a heartbeat every minute
sendHeartbeat();

// fetch transactions
batchTransactions(1, 1000);
setInterval(sendHeartbeat, 60000);

function sendHeartbeat() {
  const heartbeatMessage = msgpackr.encode({ op: 10 });
  client.send(heartbeatMessage, SERVER_PORT, SERVER_ADDRESS, (err) => {
    if (err) console.error("Failed to send heartbeat", err);
    else console.log("Heartbeat sent");
  });
}

async function batchTransactions(starting, amount) {
  const message = msgpackr.encode({
    op: 30,
    startingPoint: starting,
    amount: amount,
  });

  client.send(message, SERVER_PORT, SERVER_ADDRESS, (err) => {
    if (err) console.error("Failed to send heartbeat", err);
    else console.log("Heartbeat sent");
  });
}
