'use strict';

// dependencies - core-public-internal
var crypto = require('crypto');
var _ = require('lodash');
var log = require('./log');

// expect to be called with '10minutes','minute','second' or no param (millis)
// return an iso-8601 string
function stamp(grain) {
  var now = new Date();
  if (grain === 'minute') {
    now.setSeconds(0);
  }
  if (grain === '10minutes') {
    now.setSeconds(0);
    now.setMinutes(Math.floor(now.getMinutes() / 10) * 10);
  }
  if (!grain) {
    // iso8601, keep millis
    return now.toJSON();
  }
  // iso8601, remove millis
  return now.toJSON().replace(/\.\d{3}Z$/, 'Z');
}

// TODO: pubsub would be good
function logStamp(message) {
  // console.log('deprecated: use log.info(\'info\',...)');
  log.info(message);
}

// parse a stamp from a file/path
function stampFromFile(file) {
  var stamp = file.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  if (stamp && stamp.length) {
    stamp = new Date(stamp[0]);
    stamp.setSeconds(0);
    stamp = stamp.toJSON().replace(/\.\d{3}Z$/, 'Z');
  }
  return stamp;
}

function isEqualWithoutPrototypes(a, b) {
  if (_.isEqual(a, b)) {
    return true;
  }
  // removes prototype stuff
  a = JSON.parse(JSON.stringify(a));
  b = JSON.parse(JSON.stringify(b));
  return _.isEqual(a, b);
}

function md5(str) {
  var hash = crypto.createHash('md5').update(str).digest('hex');
  return hash;
}

exports = module.exports = {
  stamp: stamp,
  logStamp: logStamp,
  stampFromFile: stampFromFile,
  isEqualWithoutPrototypes: isEqualWithoutPrototypes,
  md5: md5
};
