const equal = require('./equal');
const _ = require('lodash');

class PathHelpers {

  constructor(path) {
    this.path = path;
  }

  find(selector) {
    if (typeof selector === 'string') {
      let str = selector;
      const type = JSON.parse(str.replace(/(^[^\[]*)(.*)/, `{ "type": "$1" }`));
      const noType = str.replace(/(^[^\[]*)/, '');
      const props = noType.match(/(\[)([^\]]*)(\])/g) || [];
      const properties = props.reduce((properties, str) =>{
        const parts = (str.match(/([^\[\"\"\=\]]*)/gm) || []).filter(Boolean);
        properties[parts[0]] = parts[1];
        return properties;
      }, {});
      const obj = Object.assign(
        type,
        properties
      );
      selector = {};
      for (let k in obj) {
        _.set(selector, k, obj[k]);
      }
      //console.log(str, selector);
    }
    const finds = [];
    this.path.traverse({
      enter(path) {
        if (!equal(path.node, selector)) return;
        finds.push(path.node);
      }
    })
    return finds;
  }

  first(selector) {
    return this.find(selector)[0];
  }

  walk(callback) {
    const parents = [];
    this.path.traverse({
      enter(path) {
        callback(path.node, parents[parents.length - 1], parents);
        parents.push(path.node);
      },
      exit() {
        parents.pop();
      }
    });
  }

  remove(selector) {
    const node = this.find(selector);
    if (!node || !node.length) return;
    debugger;
  }

}

module.exports = PathHelpers;
