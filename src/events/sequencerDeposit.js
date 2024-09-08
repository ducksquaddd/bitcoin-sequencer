module.exports = async (transaction) => {
  console.log(transaction);
  console.log(`Sequencer Deposit Verified: ${transaction.depositId}`);

  if (await global.databases.depositsIndexed.get(transaction.depositId)) return;

  let balances = await global.databases.balances.get(transaction.account);

  if (!balances) {
    await Promise.all([
      global.databases.depositsIndexed.put(
        transaction.depositId,
        transaction.depositId
      ),
      global.databases.balances.put(transaction.account, transaction.amount),
    ]);
    return;
  }

  let balance = BigInt(balances);
  balance += BigInt(transaction.amount);

  await global.databases.balances.put(transaction.account, balance.toString());
};
