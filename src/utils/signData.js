const bcrypto = require("bcrypto/lib/ed25519");
const crypto = require("crypto");
const secret = require("../../.secret/sequencer-secret.json");
function signData(data) {
  const dataHash = crypto.createHash("blake2s256").update(data).digest();
  const signature = bcrypto.sign(
    dataHash,
    Buffer.from(secret.sequencer_privkey, "hex")
  );

  return signature;
}

module.exports = { signData };
