const bcoin = require("../bcoin");
const path = require("path");
const dgram = require("dgram");
const uWS = require("uWebSockets.js");
const msgpackr = require("msgpackr");
const { base58 } = require("bstring");
const WebSocket = require("ws");
const fs = require("fs");

/* Events */
const sequencerDeposit = require("./events/sequencerDeposit");

global.clients = [];
const HEARTBEAT_INTERVAL = 60000 * 3; // 3 minutes

module.exports = async function handler() {
  await startWebserver(global.config.httpPort);
  await startUdpServer().then(() => {
    setInterval(checkHeartbeats, 60000);
  });

  await connectToNode();
};

function startWebserver(port) {
  const app = uWS.App();

  const files = fs.readdirSync(path.join(__dirname, "routes"));

  files.forEach((file) => {
    const route = require(path.join(__dirname, "routes", file));
    if (route.path && route.method && route.handler) {
      app[route.method](route.path, route.handler);
    }
  });

  app.listen("0.0.0.0", port, (token) => {
    if (token) {
      console.log(`Server running on http://localhost:${port}`);
    } else {
      console.log(`Failed to listen on port ${port}`);
    }
  });
}

async function startUdpServer() {
  const udpServer = dgram.createSocket("udp4");

  udpServer.on("error", (err) => {
    console.log(`UDP error: ${err.stack}`);
    udpServer.close();
  });

  udpServer.on("message", (msg, rinfo) => {
    const message = msgpackr.decode(msg);
    console.log(
      `Server received: ${message.op} from ${rinfo.address}:${rinfo.port}`
    );

    const clientKey = `${rinfo.address}:${rinfo.port}`;
    const index = clients.findIndex((client) => client.key === clientKey);

    /* Will move to functions in route/ probably */
    switch (message.op) {
      // Heartbeat received
      case 10: {
        if (index === -1) {
          clients.push({
            key: clientKey,
            address: rinfo.address,
            port: rinfo.port,
            lastHeartbeat: Date.now(),
          });
          console.log("Added new client:", clientKey);
        } else {
          clients[index].lastHeartbeat = Date.now();
          console.log("Updated heartbeat for:", clientKey);
        }

        // Send ACK for heartbeat
        const ackMessage = msgpackr.encode({ op: 11 });
        udpServer.send(ackMessage, rinfo.port, rinfo.address, (err) => {
          if (err) console.error("Error sending heartbeat ACK:", err);
          else console.log("Heartbeat ACK sent to", clientKey);
        });
        break;
      }

      // Transaction range request
      case 30: {
        (async () => {
          let { startingPoint, amount } = message;
          console.log(
            `Processing request from ${clientKey}: startingPoint=${startingPoint}, amount=${amount}`
          );

          if (startingPoint <= 0) {
            startingPoint = 1;
          }

          if (global.config.maxTxRequest > 1000) {
            amount = 1000;
          }

          for (let i = startingPoint; i < startingPoint + amount; i++) {
            let transactionHash = await global.databases.sequencerTxIndex.get(
              i.toString()
            );
            console.log(transactionHash);

            if (!transactionHash) {
              break;
            }

            let transactionData = await global.databases.transactions.get(
              transactionHash
            );

            if (!transactionData) {
              console.log("something went wrong");
              break;
            }

            const responseMessage = msgpackr.encode({
              op: 31,
              transaction: transactionData,
              sequencerTxIndex: i,
            });
            udpServer.send(
              responseMessage,
              rinfo.port,
              rinfo.address,
              (err) => {
                if (err) console.error("Error sending processing result:", err);
              }
            );
          }
        })();
      }
    }
  });

  udpServer.on("listening", () => {
    const address = udpServer.address();
    console.log(`UDP Server listening ${address.address}:${address.port}`);
  });

  udpServer.bind(global.config.udpPort);
}

async function connectToNode() {
  const ws = new WebSocket(global.config.trustedNode);

  ws.on("open", async () => {
    console.log("Connected to WebSocket server");

    const sequencerDepositMessage = msgpackr.pack({
      event: "subscribe",
      topic: "sequencerDeposit",
    });

    ws.send(sequencerDepositMessage);
  });

  ws.on("message", async (data) => {
    console.log(data);
    const msg = msgpackr.unpack(data);
    await sequencerDeposit(msg);
  });

  ws.on("close", (code, reason) => {
    console.log(`Disconnected from WebSocket server: ${code} - ${reason}`);
  });
  ws.on("error", async (error) => {
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    await connectToNode();
  });
}

function checkHeartbeats() {
  const now = Date.now();
  function processClient(index) {
    if (index < 0) return;
    if (now - clients[index].lastHeartbeat > HEARTBEAT_INTERVAL) {
      console.log(`Client ${clients[index].key} removed due to timeout.`);
      clients.splice(index, 1);
    }
    setImmediate(() => processClient(index - 1));
  }

  processClient(clients.length - 1);
}
