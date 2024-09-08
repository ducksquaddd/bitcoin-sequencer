const msgpackr = require("msgpackr");

class HighlayerBundle {
  constructor(parentBundle, txids, sequencerSignature) {
    this.parentBundle = parentBundle || "";
    this.txids = txids || [];
    this.sequencerSignature = sequencerSignature || null;
  }

  encode() {
    return msgpackr.encode({
      parentBundle: this.parentBundle,
      txids: this.txids,
      sequencerSignature: this.sequencerSignature,
    });
  }

  static decode(buffer) {
    const decodedObject = msgpackr.decode(buffer);
    return {
      parentBundle: decodedObject.parentBundle,
      txids: decodedObject.txids,
      sequencerSignature: decodedObject.sequencerSignature,
    };
  }
}

module.exports = { HighlayerBundle };
