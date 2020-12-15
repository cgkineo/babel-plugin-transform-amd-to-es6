'use strict'

const PathHelpers = require('./PathHelpers');

const isDefineWithDependencies = require('../lib/isDefineWithDependencies')
const getDefineDependencies = require('../lib/getDefineDependencies')
const generateImports = require('../lib/generateImports')
const getImportDeclaration = require('../lib/getImportDeclaration')
const isRequireCallExpression = require('../lib/isRequireCallExpression')
const isRequireSugarVariableDeclarator = require('../lib/isRequireSugarVariableDeclarator')
const isRequireSugarVariableDeclaratorWithMemberExpression = require('../lib/isRequireSugarVariableDeclaratorWithMemberExpression')
const isRequireMemberCallExpression = require('../lib/isRequireMemberCallExpression')
const isRequireMemberExpressionAssignment = require('../lib/isRequireMemberExpressionAssignment')
const isRequireReturnStatement = require('../lib/isRequireReturnStatement')

module.exports = class Importer extends PathHelpers {

  constructor (path, options) {
    super(path);
    this.analyzer = options.analyzer
    this.options = options || {};
  }

  harvest () {
    const node = this.first('CallExpression[callee.name="define"]')
    if (!isDefineWithDependencies(node)) { return [] }
    return this.getDefineDependencies(node).concat(
      this.getRequireSugarDependencies()
    )
  }

  getDefineDependencies (node) {
    return generateImports(getDefineDependencies(node))
  }

  getRequireSugarDependencies () {
    const rootBlock = this.first('BlockStatement');
    const nodes = []
    this.walk((node, parent, parents) => {
      // Option to only import var Name = require(); and require(); from the root of the module body
      const grandParent = parents[parents.length - 2];
      const isNotInRootBlock = (grandParent !== rootBlock && parent !== rootBlock);
      if (this.options.ignoreNestedRequires && isNotInRootBlock) {
        return;
      }
      if (isRequireSugarVariableDeclarator(node)) {
        nodes.push(this.getVariableDeclaratorRequire(node))
      } else if (isRequireSugarVariableDeclaratorWithMemberExpression(node)) {
        nodes.push(this.getVariableDeclaratorWithMemberExpressionRequire(node))
      } else if (isRequireCallExpression(node)) {
        nodes.push(this.getExpressionStatementRequire(node))
      } else if (isRequireMemberCallExpression(node)) {
        nodes.push(this.getMemberExpressionRequire(node))
      } else if (isRequireMemberExpressionAssignment(node)) {
        nodes.push(this.getAssignmentExpressionRequire(node))
      } else if (isRequireReturnStatement(node)) {
        nodes.push(this.getReturnStatementRequire(node))
      }
    })
    return nodes
  }

  getExpressionStatementRequire (node) {
    return getImportDeclaration(node.expression.arguments[0].value)
  }

  getVariableDeclaratorRequire (node) {
    var param = node.id.type === 'ObjectPattern' ? node.id : node.id.name
    var element = node.init && node.init.arguments && node.init.arguments[0].value
    return getImportDeclaration(element, param)
  }

  getVariableDeclaratorWithMemberExpressionRequire (node) {
    const identifier = this.analyzer.createIdentifier()
    let expression = node.init
    while (expression.object && expression.object.type === 'MemberExpression') {
      expression = expression.object
    }
    const element = expression && expression.object && expression.object.arguments && expression.object.arguments[0].value
    expression.object.replacement = {
      parent: 'object',
      child: { type: 'Identifier', name: identifier }
    }
    return getImportDeclaration(element, identifier)
  }

  getMemberExpressionRequire (node) {
    const identifier = this.analyzer.createIdentifier()
    node.callee.object.replacement = {
      parent: 'object',
      child: { type: 'Identifier', name: identifier }
    }
    return getImportDeclaration(node.callee.object.arguments[0].value, identifier)
  }

  getAssignmentExpressionRequire (node) {
    const identifier = this.analyzer.createIdentifier()
    node.right.replacement = {
      parent: 'right',
      child: { type: 'Identifier', name: identifier }
    }
    return getImportDeclaration(node.right.arguments[0].value, identifier)
  }

  getReturnStatementRequire (node) {
    const identifier = this.analyzer.createIdentifier()
    node.argument.replacement = {
      parent: 'declaration',
      child: { type: 'Identifier', name: identifier }
    }
    return getImportDeclaration(node.argument.arguments[0].value, identifier)
  }
}
