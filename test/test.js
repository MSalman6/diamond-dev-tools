const assert = require('assert');
const index = require('../src/index');

describe('The function imported from index.js', () => {
  describe('called "add"', () => {
    it('should return 2 if provided with 1, 1 as argument', () => {
      assert.equal(index.add(1, 1), 2);
    });
  });
});
