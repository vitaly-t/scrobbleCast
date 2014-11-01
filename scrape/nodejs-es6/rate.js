var Promise = require('bluebird');
var RateLimiter = require('limiter').RateLimiter;
var limiter = new RateLimiter(1, 100);

function pad(len) {
  return new Array(len + 1).join(' ');
}

function vsine(value, amplitude) {
  // return value % mod;
  var speed = 10;
  var angle = speed * Math.PI*2*((value % amplitude) / amplitude)
  return Math.round(  (1+Math.sin(angle))/2 * amplitude);
}

function padByClock() {
  var secs = +new Date() / 1000;
  // round to the 50'th of a second
  // var len = Math.round(50*secs) % 60;
  var len = vsine(secs, 60);
  return pad(len);
}

function rateLimitThing(input) {
  var pad =  padByClock();
  return new Promise(function(resolve, reject) {
      console.log(pad + '-' + input);
      limiter.removeTokens(1, function() {
        return resolve(input);
      });
    }).delay(500).then(function(output) {
        console.log(pad + '+' + input);
        return output
  });
}
function makeWork(len) {
  var work = [];
  for (var i = 0; i < len; i++) {
    work.push(i);
  }
  return work;
}

function Level0(l0) {
  return rateLimitThing('' + l0 + '.');
}

Promise.map(makeWork(100), Level0, { concurrency: 2 })
  .then(function(result) {
    console.log('result');
  });