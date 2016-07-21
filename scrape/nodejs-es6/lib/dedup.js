'use strict';

// Acculumalte delta history per user, over <data>/byUserStamp
// remove null change files (<data>/dedup/byUserStamp)
// copy original file (when delta>0) to <data>/noredux/byUserStamp
// overwrite minimal changeset to <data>/byUserStamp

// dependencies - core-public-internal
var log = require('./log');
// -- Implementation functions
var store = require('./store');
var delta = require('./delta');

// Exported API
exports = module.exports = {
  dedupTask: dedupTask
};

function dedupTask(credentials) {
  var historyByType = new delta.AccumulatorByTypeByUuid();
  var __user =  credentials.name;
  return Promise.resolve(true)
    .then(function() {
      const opts = {
        filter: {
          __user: __user
        }
      };

      var counts = {
        total:0,
        duplicates:0,
        keepers:0
      }
      var duplicates=[];
      function itemHandler(item) {
        counts.total++;
        var changeCount = historyByType.merge(item);

        if (changeCount === 0) {
          counts.duplicates++;
          duplicates.push(item);
          // log.verbose(`Mark as duplicate: |Δ|:${changeCount} ${JSON.stringify(item)}`);
          // log.verbose(`Mark as duplicate: |Δ|:${changeCount} ${item.__sourceType} ${item.title}`);
        } else {
          counts.keepers++;
          // log.verbose(`Mark as keeper:    |Δ|:${changeCount} ${JSON.stringify(item)}`);
          // log.verbose(`Mark as keeper:    |Δ|:${changeCount} ${item.__sourceType} ${item.title}`);
        }
        return Promise.resolve(true);
      }

      return store.impl.pg.load(opts, itemHandler)
        .then((results) => {
          log.verbose('Deduped', counts);
          return deleteDuplicates(duplicates);
        });
    })
    .then(function(dontCare) {
      console.log('pong');
      historyByType.sortAndSave(__user);
      return true;
    })
    .catch(function(error) { // TODO: might remove this altogether
      log.error('Dedup ', {
        error: error
      });
      throw error;
    });
}

async function deleteDuplicates(duplicates) {
  let i = 0;
  log.verbose('deleting %d duplicates', duplicates.length);
  for (let item of duplicates) {
    // await delay(1000);
    await store.impl.pg.remove(item);
    i++;
    if (i % 1000 == 0) {
      log.verbose('  ... removed', i);

    }
  }
}

// function delay(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

