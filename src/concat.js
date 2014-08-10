var qs = require('./qs');
var domain = require('domain');
var _concat = require('concat-stream');
module.exports = concat;


function concat(s, opts) {
  var result;
  var t = qs(opts);
  opts = opts || {};

  contain(t, function() {
    t.flush(function() { return result; });

    s.pipe(_concat(opts, function(d) {
      result = d;
      t.write(d);
      t.end();
    }));
  });

  return t;
}


function contain(t, fn) {
  return domain
    .create()
    .on('error', function(e) { t.emit('error', e); })
    .run(fn);
}
