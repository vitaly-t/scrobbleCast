'use strict';

// There are three scraping tasks:
// -quick (only 03-new-releases/04-in_progress)
// -shallow: implies quick
// -deep : implies shallow, and threfore quick

// dependencies - core-public-internal
var Promise = require('bluebird');
var _ = require('lodash');
// mine
var PocketAPI = require('./pocketAPI');
var log = require('./log');
var utils = require('./utils');
var sinkFile = require('./sink/file');
var dedupTask = require('./dedup').dedupTask;
var detectMismatchTask = require('./logcheck').detectMismatchTask;

// Exported API
exports = module.exports = {
  logcheck: logcheck,
  dedup: dedup,
  quick: quick,
  shallow: shallow,
  deep: deep
};

function logcheck() {
  lifecycle('logcheck', 'start', 'admin');
  return detectMismatchTask()
    .then(function() {
      lifecycle('logcheck', 'done', 'admin');
    });
}

function dedup(credentials) {
  var start = +new Date();
  lifecycle('dedup', 'start', credentials.name);
  return dedupTask(credentials)
    .then(function() {
      var elapsed = Number(((+new Date() - start) / 1000).toFixed(1));
      lifecycle('dedup', 'done', credentials.name, elapsed);
    });
}

function quick(credentials) {
  lifecycle('quick', 'start', credentials.name);
  var apiSession = new PocketAPI({
    stamp: utils.stamp('minute')
  });
  return apiSession.sign_in(credentials)
    .then(quickWithSession(apiSession))
    .then(function() {
      lifecycle('quick', 'done', credentials.name);
    })
    .catch(function(error) {
      console.log('tasks.quick:error:', error);
      lifecycle('quick', 'done with error', credentials.name);
      return false;
      // throw error;
    });
}

function shallow(credentials) {
  var isDeep = false;
  return scrape(credentials, isDeep);
}

function deep(credentials) {
  var isDeep = true;
  return scrape(credentials, isDeep);
}

// -- Implementation functions
function quickWithSession(apiSession) {
  return function() {
    // lifecycle('.quick', 'start', apiSession.user);
    return Promise.resolve(42)
      .then(apiSession.new_releases())
      .then(function(response) {
        progress('03-new_releases', response);
        sinkFile.writeByUserStamp(response);
      })
      .then(apiSession.in_progress())
      .then(function(response) {
        progress('04-in_progress', response);
        sinkFile.writeByUserStamp(response);
      })
      // .then(function() {
      //   lifecycle('.quick', 'done', apiSession.user);
      // })
      .catch(function(error) {
        console.log('tasks.quick:error', error);
        lifecycle('.quick', 'done: with error', apiSession.user);
        return false;
        // throw error;
      });
  };
}

// get podcasts then foreach: podcastPages->file
function scrape(credentials, isDeep) {
  // this shoulbe isolated/shared in Session: return by sign_in.
  var apiSession = new PocketAPI({
    stamp: utils.stamp('minute')
  });
  var mode = isDeep ? 'deep' : 'shallow';
  lifecycle(mode, 'start', credentials.name); // ? apiSession.stamp

  return apiSession.sign_in(credentials)
    .then(apiSession.podcasts())
    .then(function(response) {
      sinkFile.writeByUserStamp(response);
      progress('01-podcasts', response);
      return response;
    })
    .then(function(podcasts) {
      // just for lookupFun
      var podcastByUuid = _.groupBy(podcasts, 'uuid');

      return Promise.map(_.pluck(podcasts, 'uuid'), function(uuid) {
        return Promise.resolve(42)
          .then(apiSession.podcastPages({
            uuid: uuid,
            maxPage: isDeep ? 0 : 1,
          }))
          .then(function(response) {
            sinkFile.writeByUserStamp(response);
            progress('02-podcasts', response, {
              title: podcastByUuid[uuid][0].title
            });
            return response;
          });
      }, {
        concurrency: 1
      });
    })
    .then(function() {
      lifecycle(mode, 'done', apiSession.user);
    })
    // Now call quick
    .then(quickWithSession(apiSession))
    .catch(function(error) {
      console.log('tasks.' + mode + ':error:', error);
      lifecycle(mode, 'done with error', credentials.name);
      return false;
      // throw error;
    });
}

//--- Utility functions
// Task quick: start for daniel
function lifecycle(task, verb, user, elapsed) {
  var meta = {
    task: task,
    user: user,
  };
  if (elapsed){
    meta.elapsed = elapsed;
  }
  log.info('Task %s', verb, meta);
}

function progress(msg, response, meta) {
  log.verbose('|%s|: %d', msg, response.length, meta);
}
