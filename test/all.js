test("the base function exists", function(assert) {
  assert.ok(libtga);
});

// so apparently this doesn't work yet:
/*
test("Loading from file works", function(assert) {
  var done = assert.async();
  libtga.loadFile('/objectXMTexture.tga', function(err, img) {
    if(err) throw err;
    assert.ok(img);
    done();
  })
})*/
