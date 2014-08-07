var q = require('q');
var assert = require('assert');
var qs = require('./q-stream');
var Transform = require('readable-stream/transform');


describe("q-stream", function() {
  function call(fn) {
    fn();
  }

  function identity(d, enc, next) {
    next(null, d);
  }

  function tr(transform, flush) {
    var t = new Transform({objectMode: true});
    t._flush = flush || call;
    t._transform = transform || identity;
    return t;
  }

  function err(message) {
    return function() {
      throw new Error(message);
    };
  }


  it("should create a transform stream", function(done) {
    var results = [];
    var r = tr();
    var t = new tr(transform, flush);

    function transform(d, enc, next) {
      results.push(d);
      next();
    }

    function flush() {
      assert.deepEqual(results, [2, 3, 4]);
      done();
    }

    r.pipe(qs(function(d) { return d + 1; }))
     .pipe(t);

    r.push(1);
    r.push(2);
    r.push(3);
    r.push(null);
  });

  it("should fall back to creating an identity transform stream", function(done) {
    var results = [];
    var r = tr();
    var t = new tr(transform, flush);

    function transform(d, enc, next) {
      results.push(d);
      next();
    }

    function flush() {
      assert.deepEqual(results, [1, 2, 3]);
      done();
    }

    r.pipe(qs())
     .pipe(qs({}))
     .pipe(t);

    r.push(1);
    r.push(2);
    r.push(3);
    r.push(null);
  });

  it("should allow its transform functions to return promises", function(done) {
    var results = [];
    var r = tr();
    var t = new tr(transform, flush);

    function transform(d, enc, next) {
      results.push(d);
      next();
    }

    function flush() {
      assert.deepEqual(results, [2, 3, 4]);
      done();
    }

    r.pipe(qs(function(d) {
      return q()
        .delay(0)
        .then(function() { return d + 1; });
    }))
     .pipe(t);

    r.push(1);
    r.push(2);
    r.push(3);
    r.push(null);
  });

  it("should use the stream as the transform function's context", function(done) {
    var r = tr();

    var s = qs(function(d) {
      assert.strictEqual(this, s);
      return d;
    });

    var t = tr(null, function() {
      done();
    });

    r.pipe(s)
     .pipe(t);

    r.push(1);
    r.push(2);
    r.push(null);
  });

  it("should use object mode by default", function() {
    var s = qs();
    assert(s._readableState.objectMode);
    assert(s._writableState.objectMode);

    s = qs({objectMode: false});
    assert(!s._readableState.objectMode);
    assert(!s._writableState.objectMode);
  });

  it("should fail its promise if an error occurs", function() {
    var r = qs();

    var p = r
      .pipe(qs(err(':(')))
      .promise()
      .then(err('promise should not have been fulfilled'), errback);

    function errback(e) {
      assert(e instanceof Error);
      assert.equal(e.message, ':(');
    }

    r.push(1);
    r.push(null);
    return p;
  });

  it("should fulfill its promise once all data has been consumed", function() {
    var r = qs();
    var s = r.pipe(qs());

    return q()
      .then(function() { r.push(1); })
      .delay(0)
      .then(function() { assert(!s.promise().isFulfilled()); })
      .then(function() { r.push(null); })
      .delay(0)
      .then(function() { assert(s.promise().isFulfilled()); });
  });
});
