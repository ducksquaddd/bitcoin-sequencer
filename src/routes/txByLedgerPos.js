const { HighlayerTx } = require("../structs/transaction");
const msgpackr = require("msgpackr");
module.exports = {
  path: "/ledger/:num",
  method: "get",
  handler: async (res, req) => {
    try {
      const num = req.getParameter(0);

      const hash = await global.databases.sequencerTxIndex.get(num);

      if (hash) {
        let data = await global.databases.transactions.get(hash);

        return res.tryEnd(data);
      } else {
        res.writeStatus("404 Not Found");
        res.writeHeader("Content-Type", "application/vnd.msgpack");
        return res.tryEnd(
          msgpackr.encode({
            Error: "TX does not exist with that number",
          })
        );
      }
    } catch (error) {
      res.writeStatus("500 Internal Server Error");
      res.writeHeader("Content-Type", "application/vnd.msgpack");
      return res.tryEnd(msgpackr.encode({ Error: "Internal Server Error" }));
    }
  },
};
