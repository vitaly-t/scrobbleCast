'use strict';

// Usage:
// Accumulator = new require(...delta.js).Accumulator
// var a = new Accuumulator()
// for (i in inputs) a.merge(i);
// --> a.merged, a.changes,

var _ = require('lodash');

// This is to remove noise from comparison
//  -destructive if not cloned...(param?)
// Some fields:
// * is_deleted, starred, (is_video ?) number<->boolean
// * duration, played_up_to, playing_status null <-> number
// Conclusion:
// cast boolean fiels to their truthy value
// omit null values from comparison
//   which means that we may not have a merged value for these (duration)
function normalize(thing) {
  // clone thing - or NOT
  // if (param.clone)
  // thing = _.merge({}, thing);
  // thing = _.clone(thing);

  // cast to boolean if !undefined
  var booleanFields = ['is_deleted', 'starred', 'is_video'];
  booleanFields.forEach(function(field) {
    if (!_.isUndefined(thing[field])) {
      if (!_.isBoolean(thing[field])) {
        // console.log('*** normalized !!',field,thing[field],!!thing[field]);
        thing[field] = !!thing[field];
      }
    }
  });

  // omit field if null
  var nullableFields = ['duration', 'played_up_to', 'playing_status'];
  nullableFields.forEach(function(field) {
    // cast to boolean if !undefined
    if (_.isNull(thing[field])) {
      // console.log('*** normalized --',field,thing[field]);
      delete thing[field];
    }
  });
  // return normalized modified object
  return thing;
}

// utility - exposed
// returns a changeset
function compare(from, to) {
  // TODO: shortcut for: from.uuid !== to.uuid
  // TODO: actually this could use the changeset stuff from level too.(later)

  // first normalize the operands (booleans and nullables)
  // from = normalize(from);
  // to = normalize(to);

  var changes = [];
  if (!_.isEqual(from, to)) {
    var toKeys = _.keys(to);
    var fromKeys = _.keys(from);
    var allKeys = _.union(fromKeys, toKeys);

    allKeys.forEach(function(key) {
      var f = from[key];
      var t = to[key];
      var op;
      if (_.isUndefined(f)) { // new key
        op = 'new';
        // console.log('--new key', key);
      } else if (_.isUndefined(t)) { // deleted key
        op = 'del';
        // console.log('--del key', key);
      } else if (!_.isEqual(f, t)) {
        op = 'chg';
        // console.log('--chg:', key, f, t)
      }

      // ignore deletions...
      // or maybe specific ones? (podcast_id)
      // if (op) {
      // if (op && 'chg' === op) { // only op:chg
      if (op && 'del' !== op) { // op in {new,chg}
        changes.push({
          op: op,
          key: key,
          from: f,
          to: t
        });
      }
    });
  }
  return changes;
}

// Constructor
function Accumulator() {
  // this.options = _.merge({},defaultOptions,options);
  this.meta = {
    __firstSeen: false,
    __lastUpdated: false
  };
  this.history = {}; // array of changesets
}

Accumulator.prototype.appendHistory = function(changes, __stamp, __sourceType) {
  if (!changes || !changes.length) {
    return;
  }
  var self = this;
  var h = this.history;
  // var ignoredChangeKeys = ['url']; // for sure: too much dns noise
  //  other noisy fields
  // var ignoredChangeKeys = ['url', 'uuid', 'title', 'published_at', 'size', 'duration', 'file_type', 'podcast_id', 'id', 'podcast_uuid'];
  // could also include thumbnail_url for __type:podcast
  var ignoredChangeKeys = ['url', 'uuid', 'title', 'published_at', 'size', 'duration', 'file_type', 'podcast_id', 'id', 'podcast_uuid','thumbnail_url'];

  changes.forEach(function(change) { // op,key,from,to
    if (_.contains(ignoredChangeKeys, change.key)) {
      return;
    }
    // this is here because we only record __lastUpdated if we record the history
    self.meta.__lastUpdated = __stamp; // unless some keys are excluded... like url!

    // log the sourceType for the change
    h.__sourceType = h.__sourceType || {};
    h.__sourceType[__stamp] = __sourceType;

    // log the actual change for key.
    h[change.key] = h[change.key] || {};
    h[change.key][__stamp] = change.to;
  });
  this.meta.__changeCount = _.keys(h.__sourceType).length;
};

// class methods
// Accumulates (merges) and returns changes
Accumulator.prototype.merge = function(item) {
  // assume the objects are all shallow... (no nested properties for now)
  // -clone item,
  // -normalize attributes,
  // -delete __stamp,__sourceType property for compare

  var from = this;
  var to = normalize(_.clone(item));
  // no need to delete __user, and __type, but will make compare faster.
  delete to.__type;
  delete to.__sourceType;
  delete to.__user;
  delete to.__stamp;

  // old sanity check, from a previous format.
  if (item.__type === 'episode' && !to.podcast_uuid) {
    console.log('Accumulator.merge: no podcast_uuid for episode:', item);
    throw (new Error('Accumulator.merge: no podcast_uuid for episode:' + JSON.stringify(item)));
  }
  // end of special fix check

  // update meta on first sight
  if (!this.meta.__firstSeen) {
    _.merge(this.meta, {
      __type: item.__type,
      __user: item.__user,
      __firstSeen: item.__stamp,
      __lastUpdated: item.__stamp
    });
  }

  var changes = compare(from, to);
  // rewrite compare to make this smoother
  this.appendHistory(changes, item.__stamp, item.__sourceType);

  // accumulate new values
  _.merge(this, to);

  // delete and re-attach the history attribute: makes it appear at the end of the object (usualy)
  var h = this.history;
  delete this.history;
  this.history = h;

  return changes;
};

// need a new name:
// options may include : uuid, ignoreDelete, ..
function AccumulatorByUuid( /*options*/ ) {
  this.accumulators = {}; // by uuid
}

AccumulatorByUuid.prototype.getAccumulator = function(uuid) {
  if (!this.accumulators[uuid]) {
    this.accumulators[uuid] = new Accumulator({
      uuid: uuid
    });
  }
  return this.accumulators[uuid];
};

AccumulatorByUuid.prototype.merge = function(item) {

  var acc = this.getAccumulator(item.uuid);
  var changes = acc.merge(item);
  var changeCount = changes.length;
  return changeCount;
};

exports = module.exports = {
  normalize: normalize,
  compare: compare,
  Accumulator: Accumulator,
  AccumulatorByUuid: AccumulatorByUuid
};
