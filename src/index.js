const { declare, MatchPattern } = require("@babel/helper-plugin-utils");
const Module = require("./class/Module");
const minimatch = require('minimatch');

module.exports = declare((api, options ) => {
  api.assertVersion(7);

  return {
    name: "transform-amd-to-es6",

    visitor: {
      Program: function (path, file) {
        if (options && options.ignore) {
          if (options.ignore.find(pattern => minimatch(file.filename, pattern))) {
            return;
          }
        }
        const m = new Module(path, file);
        m.amdToES6Modules(options)
        m.amdDefineES6Modules(options)
      }
    }

  };
});
