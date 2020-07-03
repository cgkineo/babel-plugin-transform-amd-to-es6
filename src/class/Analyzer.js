'use strict'

const PathHelpers = require('./PathHelpers');

function getIdentifier (array) {
  let alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('')
  let index = 0
  while (array.indexOf(alphabet[index]) !== -1) {
    index += 1
    if (index === alphabet.length) {
      index = 0
      alphabet = alphabet.map(character => '_' + character)
    }
  }
  return alphabet[index]
}

module.exports = class Analyzer extends PathHelpers {

  constructor (path) {
    super(path);
    this.identifiers = this.getIdentifiers();
  }

  getIdentifiers () {
    const identifiers = [];
    this.path.traverse({ Identifier: function(path) {
      identifiers.push(path.node);
    }});
    return [...new Set(identifiers.map(identifier => identifier.name))];
  }

  createIdentifier () {
    const identifier = getIdentifier(this.identifiers)
    this.identifiers.push(identifier)
    return identifier
  }
}
