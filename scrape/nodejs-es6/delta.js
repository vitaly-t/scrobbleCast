"use strict";

// High level,
// load podcasts/episodes (as needed)
// for each file in (new_releases, then in_progress)
//   for each episode in file.episodes
//     compare episode with known podcats/episode (if exists)

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var utils = require('./lib/utils');
var srcFile = require('./lib/source/file');
var delta = require('./lib/delta');

// Target Key (path) definitions
// - /podcast/<podast_uuid>/<stamp>/01-podcasts <-source type (url)
// - /podcast/<podast_uuid>/episode/<episode_uuid_uuid>/<stamp>/0[234]-type <-source type 
// - /episode/<episode_uuid_uuid>/<stamp>/0[234]-type <-source type

// example file input patterns
// data/byDate/2014-11-07T08:34:00Z/02-podcasts/2cfd8eb0-58b1-012f-101d-525400c11844.json
// data/byDate/2014-11-05T07:40:00Z/03-new_releases.json
// data/byDate/2014-11-05T07:40:00Z/04-in_progress.json

// @param file(name)
// @param thingsToMerge: [{podcast|episode}]
// return  [{key:{type,[podcast_uuid],uuid,stamp,sourceType} values:[things]}]
function readByDate(file) {
  var thingsToMerge = srcFile.loadJSON(file);
  if (thingsToMerge.length === 0) {
    // throw new Error('readByDate: no things to split by keys: ' + file);
    return [];
  }

  var stamp = utils.stampFromFile(file);
  // match the sourceType and optionally the podcast_uuid for 02-podcasts (old)
  var match = file.match(/(01-podcasts|02-podcasts|03-new_releases|04-in_progress)(\/(.*))?\.json/);
  var sourceType = match[1];
  var podcast_uuid = match[3]

  // extra assert (02- fix)
  if (sourceType === '02-podcasts' && !podcast_uuid) {
    throw (new Error('readByDate: no podcast_uuid for 02-podcasts: ' + file));
  }
  var keyedThings = thingsToMerge.map(function(thing) {
    if (!thing.uuid) {
      throw (new Error('readByDate: no uuid in thing!'))
    }
    var key = {
      // type: 'podcast|episode',
      uuid: thing.uuid,
      stamp: stamp,
      sourceType: sourceType,
      // decorate with source file - for debugging
      source: file,
    };
    // decorate with titles - for debugging
    if (thing.title) {
      key.title = thing.title;
    }
    if (sourceType === '01-podcasts') {
      // assert stuff
      key.type = 'podcast';
    } else {

      if (!thing.podcast_uuid) {
        if (!podcast_uuid) {
          console.log('XXXX', file, sourceType, match);
          throw (new Error('readByDate: no podcast_uuid! for file:' + file));
        }
        // perform the fix
        thing.podcast_uuid = podcast_uuid;
      }
      key.type = 'episode';
      key.podcast_uuid = podcast_uuid;
    }
    return {
      key: key,
      value: thing
    };
  });
  return keyedThings;
}

// srcFile.find('byDate/**/*.json')
srcFile.findByDate()
  .then(function(stamps) {
    utils.logStamp('Starting:Delta ');
    // console.log('stamps', stamps);
    console.log('-|stamps|', stamps.length);
    // stamps = stamps.slice(0, 3000);
    console.log('+|stamps|', stamps.length);

    var uuidProperty = 'uuid'; // common to all: podcasts/episodes
    var podcastHistory = new delta.AccumulatorByUuid();
    var episodeHistory = new delta.AccumulatorByUuid();

    // should have a version without aggregation
    utils.serialPromiseChainMap(stamps, function(stamp) {
        console.log('--iteration stamp:', stamp);
        return srcFile.find(path.join('byDate', stamp, '**/*.json'))
          .then(function(files) {

            files.forEach(function(file) {

              console.log('---file:', file);

              var keyedThings = readByDate(file);

              if (file.match(/01-/)) {
                // console.log('|podcasts|', thingsToMerge.length,file);
                podcastHistory.mergeMany(keyedThings);
              } else {
                // console.log('|episodes|', thingsToMerge.length,file);
                episodeHistory.mergeMany(keyedThings);
              }
            });
          });
      })
      .then(function(dontCare) {
        function sortAndSave(outfile, history) {
          console.log('|' + outfile + '|=', _.size(history.accumulators));
          // just write out the accumulators dictionary, it is the only attribute!
          var sorted = _.sortBy(history.accumulators, 'lastUpdated').reverse();
          fs.writeFileSync(outfile, JSON.stringify(sorted, null, 2));
        }
        sortAndSave('podcast-history.json', podcastHistory);
        sortAndSave('episode-history.json', episodeHistory);

        var oneEpisode = '5e112290-5038-0132-cfbf-5f4c86fd3263';
        fs.writeFileSync('one-episode-history.json', JSON.stringify(episodeHistory.accumulators[oneEpisode], null, 2));
        utils.logStamp('Done:Delta |e|:' + _.size(episodeHistory.accumulators));
        return stamps;
      });

  })
  .catch(function(error) {
    console.error('Error:Delta', error);
    utils.logStamp('Error:Delta ' + error);
  });