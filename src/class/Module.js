'use strict'

const PathHelpers = require('./PathHelpers');

const isDefineWithObjectExpression = require('../lib/isDefineWithObjectExpression')
const getDefineCallbackArguments = require('../lib/getDefineCallbackArguments')
const isReturnStatement = require('../lib/isReturnStatement')
const isVariableDeclaration = require('../lib/isVariableDeclaration')
const isRequireCallExpression = require('../lib/isRequireCallExpression')
const changeReturnToExportDefaultDeclaration = require('../lib/changeReturnToExportDefaultDeclaration')
const Analyzer = require('./Analyzer')
const Importer = require('./Importer')
const Exporter = require('./Exporter')

function getImmediatelyInvokedFunctionExpression2 (body) {
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: {
        type: 'FunctionExpression',
        params: [],
        body: {
          type: 'BlockStatement',
          body
        }
      },
      arguments: []
    }
  }
}

function getImmediatelyInvokedFunctionExpression1 (body) {
  return {
      type: 'CallExpression',
      callee: {
        type: 'FunctionExpression',
        params: [],
        body: {
          type: 'BlockStatement',
          body
        }
      },
      arguments: []
    }
  }

class Module extends PathHelpers {

  constructor (path, file, {
    ignoreNestedRequires = false
   } = {}) {
    super(path);
    this.file = file;
    this.analyzer = new Analyzer(this.path)
    this.importer = new Importer(this.path, { analyzer: this.analyzer, ignoreNestedRequires })
    this.exporter = new Exporter(this.path, { analyzer: this.analyzer })
  }

  amdToES6Modules (options = {}) {
    if (options.amdToES6Modules === false) {
      return;
    }
    let define = this.first('CallExpression[callee.name=define]');
    const moduleExports = this.first("MemberExpression[object.name=module][property.name=exports]");
    const isUMD = (define && moduleExports) || ((define && define.arguments && define.arguments[0].type !== "StringLiteral" && (define.arguments[define.arguments.length - 1].type !== 'FunctionExpression' && define.arguments[define.arguments.length - 1].type !== 'ArrowFunctionExpression')));
    if (!define) {
      const require = this.first('CallExpression[callee.name=require]');
      if (!require) {
        return;
      }
      const isInitialRequire = (this.path.node.body[0] && this.path.node.body[0].expression === require);
      if (!isInitialRequire) {
        return;
      }
      // Correct from require to define
      require.callee.name = 'define';
      define = require;
    } else if (isUMD && options.umdToAMDModules === true) {
      // Convert UMD modules to AMD for import
      // Usually a third party library
      const functions = this.find('FunctionExpression');
      const longestFunctions = functions.sort((a, b) => {
        const aLength = a.end - a.start;
        const bLength = b.end - b.start;
        return (bLength - aLength);
      });
      define.arguments[define.arguments.length - 1] = longestFunctions[0];
      this.path.node.body[0].expression = define;
      this.isUMD = true;
    }
    if (isDefineWithObjectExpression(define)) {
      this.path.node.body = [{
        type: 'ExportDefaultDeclaration',
        declaration: define.arguments[0]
      }]
    } else {
      this.prepare(define)
      const imports = this.importer.harvest()
      const exports = this.exporter.harvest()
      const body = this.getBody(define)
      const code = this.getCode(body, options)
      this.path.node.body = imports.concat(code, exports)
      this.clean()
    }
  }

  amdDefineES6Modules(options = {}) {
    if (!options.amdDefineES6Modules) {
      return;
    }
    const node = this.first('ExportDefaultDeclaration');
    if (!node) return;
    const isExportingStringLiteral = (node.declaration && node.declaration.type === "StringLiteral");
    if (isExportingStringLiteral) {
      return; // Rollup preflight checks
    }
    const arg = { ...node.declaration };
    if (arg.type === "ClassDeclaration") {
      // We're going to be wrapping it with a function call
      arg.type = "ClassExpression";
    }
    const defineModuleId = typeof options.defineModuleId === "function" ?
      options.defineModuleId(this.file.filename) :
      this.file.filename;
    const defineFunctionName = typeof options.defineFunctionName === "string" ?
      options.defineFunctionName :
      '__AMD';
    node.declaration = {
      arguments: [{ type: "StringLiteral", value: defineModuleId }, arg],
      callee: { name: defineFunctionName, type: "Identifier" },
      type: "CallExpression"
    };
    return true;
  }

  prepare (define) {
    this.removeTrueIfStatements()
    this.flattenAssignments()
    this.wrapNoExport(define)
  }

  removeTrueIfStatements () {
    let cid = 1
    this.walk(function (node, parent) {
      node.cid = cid
      cid += 1
      if (node.type === 'IfStatement' && node.test.value === true) {
        parent.body = parent.body.reduce((result, item) => {
          return result.concat(node.cid === item.cid ? node.consequent.body : item)
        }, [])
      }
    })
  }

  flattenAssignments () {
    let cid = 1
    this.walk((node, parent) => {
      node.cid = cid
      cid += 1
      if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression') {
        if (node.expression.left.type === 'MemberExpression' &&
            node.expression.left.object.name === 'exports' &&
            node.expression.right.type === 'AssignmentExpression') {
          let cache = [node.expression]
          let right = node.expression.right
          while (right.type === 'AssignmentExpression') {
            cache.push(right)
            right = right.right
          }
          const identifier = this.analyzer.createIdentifier()
          const container = {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: identifier },
                init: right
              }
            ],
            kind: 'var'
          }
          cache = cache.reverse().map(current => {
            return {
              type: 'ExpressionStatement',
              expression: {
                type: 'AssignmentExpression',
                left: current.left,
                right: { type: 'Identifier', name: identifier },
                operator: '='
              }
            }
          })
          cache.unshift(container)
          parent.body = parent.body.reduce((result, item) => {
            return result.concat(node.cid === item.cid ? cache : item)
          }, [])
        }
      }
    })
  }

  hasExportsDefault () {
    return this.find('MemberExpression[object.name="exports"][property.name="default"]').length > 0
  }

  wrapNoExport (node) {
    if (this.hasExportsDefault()) return
    const args = getDefineCallbackArguments(node)
    if (!args.body || args.body.type !== 'BlockStatement') return;
    const types = args.body.body.map(leaf => leaf.type)
    if (this.isUMD) {
    const returnStatements = types.reduce((sum, type) => (sum += type === 'ReturnStatement' ? 1 : 0 ), 0);
    if (returnStatements !== 0 || args.body.body.length === 0) return;
      args.body.body = [{ type: 'ReturnStatement', argument: getImmediatelyInvokedFunctionExpression1(args.body.body) }]
    } else {
      if (!types.includes('ReturnStatement') && types.includes('IfStatement')) {
      args.body.body = [{ type: 'ReturnStatement', argument: getImmediatelyInvokedFunctionExpression2(args.body.body) }]
      return;
    }}
  }

  getBody (node) {
    const args = getDefineCallbackArguments(node)
    if (args.body && args.body.type === 'BlockStatement') {
      return args.body.body
    }
    return [{ type: 'ExportDefaultDeclaration', declaration: args.body }]
  }

  getCode (body, options) {
    return body.map(node => {
      if (isReturnStatement(node)) {
        return changeReturnToExportDefaultDeclaration(node)
      } else if (isRequireCallExpression(node)) {
        return null
      } else if (isVariableDeclaration(node)) {
        node.declarations = node.declarations.filter(declaration => {
          if (declaration.init &&
            declaration.init.type === 'CallExpression' &&
            declaration.init.callee.name === 'require') {
            return false
          }
          return true
        })
        // Filter empty variable declarations
        if (node.declarations.length === 0) {
          return null
        }
        return node
      }
      return node
    }).filter(Boolean)
  }

  transformTree () {
    this.walk((node, parent) => {
      if (node.replacement) {
        parent[node.replacement.parent] = node.replacement.child
      } else if (node.remove) {
        this.remove(node)
      }
    })
  }

  clean () {
    this.transformTree()
    this.removeEsModuleConvention()
  }

  removeEsModuleConvention () {
    var object = '[expression.callee.object.name=Object]'
    var property = '[expression.callee.property.name=defineProperty]'
    var selector = `ExpressionStatement${object}${property}`
    var nodes = this.find(selector)
    nodes.forEach(node => {
      var args = node.expression.arguments
      if (args.length > 2 &&
        args[0].type === 'Identifier' && args[0].name === 'exports' &&
        args[1].type === 'StringLiteral' && args[1].value === '__esModule'
      ) {
        this.remove(node)
      }
    })
  }

}

module.exports = Module
