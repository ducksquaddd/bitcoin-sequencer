const msgpackr = require("msgpackr");

module.exports = {
  path: "/sequencerPrices",
  method: "get",
  handler: async (res, req) => {
    try {
      res.writeHeader("Content-Type", "application/json");
      return res.tryEnd(
        msgpackr.encode({
          feePerByte: global.config.feePerByte.toString(),
        })
      );
    } catch (error) {
      console.log(error);
      res.writeStatus("500 Internal Server Error");
      return res.tryEnd("Internal Server Error");
    }
  },
};
