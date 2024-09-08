const msgpackr = require("msgpackr");
const crypto = require("crypto");

class HighlayerTx {
  constructor({
    address,
    signature,
    nonce,
    actions,
    bundlePosition,
    sequencerTxIndex,
    trueTxIndex,
    parentBundleHash,
    sequencerSignature,
  }) {
    this.address = address || "";
    this.signature = signature || null;
    this.nonce = nonce || crypto.randomBytes(4).readUInt32BE(0);
    this.actions = actions || [];
    this.bundlePosition = bundlePosition || null;
    this.sequencerTxIndex = sequencerTxIndex || null;
    this.trueTxIndex = trueTxIndex || null;
    this.parentBundleHash = parentBundleHash || null;
    this.sequencerSignature = sequencerSignature || null;
  }

  encode() {
    return msgpackr.encode({
      address: this.address,
      signature: this.signature,
      nonce: this.nonce,
      actions: this.actions,
      bundlePosition: this.bundlePosition,
      sequencerTxIndex: this.sequencerTxIndex,
      trueTxIndex: this.trueTxIndex,
      parentBundleHash: this.parentBundleHash,
      sequencerSignature: this.sequencerSignature,
    });
  }

  extractPrototype() {
    return msgpackr.encode({
      address: this.address,
      signature: null,
      nonce: this.nonce,
      actions: this.actions,
      bundlePosition: null,
      sequencerTxIndex: null,
      trueTxIndex: null,
      parentBundleHash: null,
      sequencerSignature: null,
    });
  }

  txID() {
    return crypto
      .createHash("blake2s256")
      .update(
        msgpackr.encode({
          address: this.address,
          signature: this.signature,
          nonce: this.nonce,
          actions: this.actions,
          bundlePosition: null,
          sequencerTxIndex: null,
          trueTxIndex: null,
          parentBundleHash: null,
          sequencerSignature: null,
        })
      )
      .digest("hex");
  }

  extractedRawTxID() {
    return crypto
      .createHash("blake2s256")
      .update(
        msgpackr.encode({
          address: this.address,
          signature: null,
          nonce: this.nonce,
          actions: this.actions,
          bundlePosition: null,
          sequencerTxIndex: null,
          trueTxIndex: null,
          parentBundleHash: null,
          sequencerSignature: null,
        })
      )
      .digest();
  }

  rawTxID() {
    return crypto
      .createHash("blake2s256")
      .update(
        msgpackr.encode({
          address: this.address,
          signature: this.signature,
          nonce: this.nonce,
          actions: this.actions,
          bundlePosition: this.bundlePosition,
          sequencerTxIndex: this.sequencerTxIndex,
          trueTxIndex: null,
          parentBundleHash: this.parentBundleHash,
          sequencerSignature: this.sequencerSignature,
        })
      )
      .digest();
  }

  static decode(buffer) {
    const decodedObject = msgpackr.decode(buffer);

    return new HighlayerTx({
      address: decodedObject.address,
      signature: decodedObject.signature,
      nonce: decodedObject.nonce,
      actions: decodedObject.actions,
      bundlePosition: decodedObject.bundlePosition,
      sequencerTxIndex: decodedObject.sequencerTxIndex,
      trueTxIndex: decodedObject.trueTxIndex,
      parentBundleHash: decodedObject.parentBundleHash,
      sequencerSignature: decodedObject.sequencerSignature,
    });
  }
}

module.exports = { HighlayerTx };
