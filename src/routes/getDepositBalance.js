const msgpackr = require("msgpackr");
module.exports = {
  path: "/depositBalance/:address",
  method: "get",
  handler: async (res, req) => {
    try {
      const address = req.getParameter(0);

      const balance = await global.databases.balances.get(address);

      if (balance) {
        res.writeHeader("Content-Type", "text/plain");
        return res.tryEnd(
          msgpackr.encode({
            balance: balance.toString("utf8"),
          })
        );
      } else {
        // console.warn("TX does not exist with that number");
        res.writeStatus("404 Not Found");
        return res.tryEnd(
          msgpackr.encode({
            Error: "Requested Address does not have a Sequencer balance",
          })
        );
      }
    } catch (error) {
      console.log(error);
      res.writeStatus("500 Internal Server Error");
      return res.tryEnd("Internal Server Error");
    }
  },
};
