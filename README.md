# Bitcoin Sequencer

This is the Sequencer implemented on the Highlayer network.

This sequencer implements the following features:

- HTTP routes for
  - Transaction submission
  - Fetching sequencer TX fees
  - fetching transaction by ledger index
- UDP client
  - Batch Transaction Requesting
  - Live Transaction feed
- Creating transaction bundles that are hashed and uploaded onto Bitcoin periodically

## Sequencer UDP

All UDP requests must be encoded using msgpack and decoded using msgpack

### Batch Transaction Requesting

In order to recieve many transaction at the same time you must send the UDP client this request

```json5
{
  op: 30, // Request identifier
  startingPoint: 0, // Starting point in the sequencerTxIndex
  amount: 1000, // Max transactions is 1000
}
```

You will then recieve UDP messages

```json5
{
  op: 31,
  transaction: encodedData,
  sequencerTxIndex: number,
}
```

### Heartbeat

You will be removed from the Sequencer's UDP client list if you dont send a heartbeat atleast every 3 minutes

```json
{
  "op": 10
}
```

The sequencer will then respond with OP 11 ACK

```json
{
  "op": 11
}
```

### Transaction

Aslong as you are connected to the Sequencer's UDP client list, it will send you every new transaction

```json
{
    "op": 21,
    "transaction": encodedData
}
```

## Notice

The Highlayer Sequencer main repo can be found [here](https://github.com/highlayer-team/sequencer).

Small contributions were made by [Angrymouse](https://github.com/Angrymouse). Which can be found in the repo above.

This repo was uploaded here as I officially _left_ the Highlayer team. Code was not licensed and I wasnt compensated for my work they in no way shape or form own it.

This repo is not maintained and is only for reference of my work.
