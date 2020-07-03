const { declare } = require("@babel/helper-plugin-utils");
const Module = require("./class/Module");

module.exports = declare((api, options) => {
  api.assertVersion(7);

  return {
    name: "transform-amd-to-es6",

    visitor: {
      Program: function (path, file) {
        const m = new Module(path, file);
        m.amdToES6Modules(options)
        m.amdDefineES6Modules(options)
      }
    }

  };
});
