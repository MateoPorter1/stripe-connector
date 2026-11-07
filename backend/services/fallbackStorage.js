// Called only after MongoDB is connected. Do not reuse Model.init(): its cached
// startup promise may have rejected while request buffering was disabled.
async function prepareFallbackStorage(Attempt, Lease, Recovery) {
  for (const model of [Attempt, Lease, Recovery]) await model.createCollection();
  await Attempt.createIndexes();
  await Recovery.createIndexes();
}
module.exports = { prepareFallbackStorage };
