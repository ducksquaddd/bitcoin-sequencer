async function iterateData(database) {
  let iteration = 0;
  for await (let _ of await database.getRange({})) {
    iteration++;
  }

  return iteration;
}

module.exports = { iterateData };
