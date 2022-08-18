const { declare } = require("@babel/helper-plugin-utils");
const Module = require("./class/Module");
const minimatch = require('minimatch');

module.exports = declare((api, options) => {
  api.assertVersion(7);

  return {
    name: "transform-amd-to-es6",

    visitor: {
      Program: function (path, file) {
        if (options && options.excludes) {
          if (options.excludes.find(pattern => minimatch(file.filename, pattern))) {
            return;
          }
        }
        if (options && options.includes) {
          if (!options.includes.find(pattern => minimatch(file.filename, pattern))) {
            return;
          }
        }
        const m = new Module(path, file, options);
        m.amdToES6Modules(options)
        m.amdDefineES6Modules(options)
      }
    }

  };
});
