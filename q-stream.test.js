var q = require('q');
var assert = require('assert');
var domain = require('domain');
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

  function badFulfill() {
    return err('promise should not have been fulfilled');
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
      .then(badFulfill, errback);

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

  it("should fulfill its promise with its flush function's result", function() {
    var r = qs();

    var p = r
      .pipe(qs())
      .flush(function() {
        return q()
          .delay(0)
          .then(function() { return 23; });
      })
      .promise()
      .then(function(v) {
        assert.equal(v, 23);
      });

    r.push(1);
    r.push(null);
    return p;
  });

  it("should use the stream as the flush function's context", function(done) {
    var t = qs()
      .flush(function() {
        assert.strictEqual(t, this);
        done();
      });

    t.end();
  });

  it("should fail its promise if a flush error occurs", function() {
    var r = qs();

    var p = r
      .pipe(qs())
      .flush(err(':('))
      .promise()
      .then(badFulfill, errback);

    function errback(e) {
      assert(e instanceof Error);
      assert.equal(e.message, ':(');
    }

    r.push(1);
    r.push(null);
    return p;
  });

  it("should rethrow errors if no promise was asked for", function(done) {
    domain
      .create()
      .on('error', function(e) {
        assert(e instanceof Error);
        assert.equal(e.message, ':(');
        done();
      })
      .run(function() {
        var r = qs();
        r.pipe(qs(err(':(')));
        r.push(1);
        r.push(null);
      });
  });

  it("should keep 'error' listeners working on their own", function(done) {
    var r = qs();

    r.pipe(qs(err(':(')))
     .on('error', function(e) {
       assert(e instanceof Error);
       assert.equal(e.message, ':(');
       done();
     });

    r.push(1);
    r.push(null);
  });

  it("should keep 'error' listeners working when a promise is used", function() {
    var r = qs();
    var d1 = q.defer();
    var d2 = q.defer();

    r.pipe(qs(err(':(')))
     .on('error', function(e) {
       check(e);
       d1.resolve();
     })
     .promise()
     .then(badFulfill(), function(e) {
       check(e);
       d2.resolve();
     });

    function check(e) {
      assert(e instanceof Error);
      assert.equal(e.message, ':(');
    }

    r.push(1);
    r.push(null);
    return q.all([d1.promise, d2.promise]);
  });
});
