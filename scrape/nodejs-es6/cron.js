'use strict';

// dependencies - core-public-internal
var Promise = require('bluebird');
var cron = require('cron');
var CronJob = cron.CronJob;
var log = require('./lib/log');
var tasks = require('./lib/tasks');

// globals
var allCredentials = require('./credentials.json');

// TODO: this should become cronRunner, move to lib, receive/inject config
// e.g. fomr index.js:
//   require('./lib/cronRunner').run(config)

// cron crash course:
//  */5 :== 0-59/5, and
//  1-59/5 :== 1,6,11,16,21
//  4-59/10 :== 4,14,24,34
// example
// every 10 minutes
//   cronTime: '0 */10 * * * *', // seconds included 6 params - standard 5 params supported
// Every recurrence pattern is offset by 10 seconds to avoid timestamping in previous minute!
var recurrence = {
  everyDayAtMidnight: '10 0 0 * * *',
  everyHourExceptMidnight: '10 0 1-23/1 * * *',
  everyTenExceptOnTheHour: '10 10-59/10 * * * *',
  // everyHourOnTheHour: '10 0 * * * *',
  // everyTenMinutesOffsetByThree: '10 3-59/10 * * * *',
  // everyTenMinutesOffsetByFour: '10 4-59/10 * * * *',
  everyMinute: '10 * * * * *'
};

// serial execution of <task> for each credentialed user
// perform dedup task on all users, after main tasks are completed
// returns a function
function forEachUser(task) {
  return function() {
    return Promise.each(allCredentials, task)
      .then(function() {
        return Promise.each(allCredentials, tasks.dedup);
      })
      .catch(function(error) {
        // TODO, might want to catch before tasks.dedup is called, to make sure dedup always runs...
        console.error('cron:error', error);
      });
  };
}
// auto-starts
function runJob(task, when) {
  var message = 'Starting CronJob:';
  if (task.name) { // depends on the finction having been defined non-anonymously
    message += ' ' + task.name;
  }
  message += ' ' + when;

  log.info(message);

  var job = new CronJob({
    // timeZone: "America/Montreal" // npm install time, if you want to use TZ
    cronTime: when,
    onTick: forEachUser(task),
    start: true // default is true, else, if start:false, use job.start()
  });
  return job; // if you ever want to stop it.
}

log.info('Starting Cron');
// auto-start all three
runJob(tasks.deep, recurrence.everyDayAtMidnight); // var deep = ...
runJob(tasks.shallow, recurrence.everyHourExceptMidnight); // var shallow =
runJob(tasks.quick, recurrence.everyTenExceptOnTheHour); // var quick =
// runJob(tasks.quick,   recurrence.everyMinute); // var quick =

// make this process hang around
// closing stdin (^D/EOF) will exit.
process.stdin.resume();
