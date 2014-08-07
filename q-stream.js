var q = require('q');
var util = require('util');
var Transform = require('readable-stream/transform');

module.exports = qs;
qs.isStream = isStream;


function qs(fn, opts) {
  opts = opts || {};
  if (typeof fn != 'function') opts = fn || {}, fn = identity;
  if (!('objectMode' in opts)) opts.objectMode = true;

  var rethrow = true;
  var d = q.defer();
  d.promise.done();

  var flush = noop;
  var t = new QTransform(opts);
  t._transform = transform(t, fn);

  t._flush = function(done) {
    q.try(flush)
     .then(function(result) { d.resolve(result); })
     .nodeify(done);
  };

  t.flush = function(fn) {
    flush = fn || noop;
    return t;
  };

  t.on('error', function(e) {
    d.reject(e);
  });

  t.promise = function() {
    if (rethrow) {
      d = q.defer();
      rethrow = false;
    }
    return d.promise;
  };

  return t;
}


function transform(t, fn) {
  fn = fn.bind(t);

  return function(d, enc, next) {
    q.fcall(fn.bind(this), d, enc)
     .nodeify(next);
  };
}


function isStream(obj) {
  return typeof (obj || 0).pipe == 'function';
}


function identity(v) {
  return v;
}


function noop() {
}


function QTransform() {
  Transform.apply(this, arguments);
}


util.inherits(QTransform, Transform);
