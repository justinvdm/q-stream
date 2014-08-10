var qs = require('./qs');
var isStream = require('./qs.isStream');
module.exports = streamify;


function streamify(v) {
  if (isStream(v)) return v;
  var t = qs.oneshot();
  t.write(v);
  return t;
}
