const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generate = require('@babel/generator').default;
const beautify = require('js-beautify');
const { readFileSync, writeFile, write } = require('fs');
const crypto = require('crypto');

const getMixedStrings = (ast) => {
  let found = [false, false, false];
  let mixTimes, seperator, rawStrings;

  let findStrings = {
    StringLiteral(p) {
      if (p.node.value.length > 200) {
        rawStrings = p.node.value;
        p.node.value = '';
        // p.remove();
        found[0] = true;
      }
      if (p.node.value.length == 1 && ',;{}[]'.includes(p.node.value)) {
        seperator = p.node.value;
        p.remove();
        found[1] = true;
      }
      if (found[0] && found[1] && found[2]) {
        p.stop();
      }
    },
    CallExpression(p) {
      if (p.node.arguments.length == 2) {
        // if (
        //   p.node.arguments[0].name == 'c' ||
        //   p.node.arguments[0].name == 'b'
        // ) {
        // console.log(p.node.arguments[1]);
        mixTimes = p.node.arguments[1].value + 1;
        p.remove();
        found[2] = true;
        // }
      }
      if (found[0] && found[1] && found[2]) {
        p.stop();
      }
    },
  };
  traverse(ast, findStrings);

  // Mix the strings around
  // OG name: d
  function mixStrings(a, times) {
    for (; --times; a.push(a.shift()));
    return a;
  }
  const splitted = rawStrings.split(seperator);
  return mixStrings(splitted, mixTimes);
};

const getAllVariableValues = (ast) => {
  const variables = {};
  const specialVariables = {};
  const deob = {
    AssignmentExpression(p) {
      let name;

      value = p.node.right.value;
      if (value === undefined) value = p.node.right.name;
      if (value === undefined) value = p.node.right.callee?.name;

      if (
        value === undefined &&
        p.node.right.type == 'CallExpression' &&
        p.node.right.callee.type == 'MemberExpression'
      ) {
        // a = b.c()
        if (p.node.right.callee.object.type == 'MemberExpression') {
          // a = b.c.d()
          value = p.node.right.callee.object.object.name + '.';
          value += p.node.right.callee.object.property.name + '.';
          value += p.node.right.callee.property.name;
        } else if (p.node.right.callee.object.type == 'Identifier') {
          // a = b.c()
          value = p.node.right.callee.object.name + '.';
          value += p.node.right.callee.property.name;
        } else if (p.node.right.callee.object.type == 'CallExpression') {
          // a = b().c()
          value = p.node.right.callee.object.callee.name + '().';
          value += p.node.right.callee.property.name;
        } else if (p.node.right.callee.object.type == 'ThisExpression') {
          // a = this.c()
          value = 'this.';
          value += p.node.right.callee.property.name;
        } else if (p.node.right.callee.object.type == 'StringLiteral') {
          // a = 'b'.c()
          value = p.node.right.callee.object.value + '.';
          value += p.node.right.callee.property.name;
        }
      }

      const hash = crypto
        .createHash('md5')
        .update(generate(p.parent).code)
        .digest('hex');

      if (t.isIdentifier(p.node.left)) {
        // a = 123
        name = p.node.left.name;
      } else if (t.isMemberExpression(p.node.left)) {
        // a.b.c = 123
        part1 = p.node.left.object?.object?.name;
        part2 = p.node.left.object?.name;

        if (part2 === undefined) part2 = p.node.left.object?.property?.name;
        if (part1) part2 = part1 + '.' + part2;

        part3 = p.node.left.property.name;
        if (part3 === undefined) part3 = p.node.left.property.value;
        name = part2 + '.' + part3;
      } else {
        // console.log('Unknown variable type');
        return;
      }
      if ((value + '').includes('|') || (value + '').includes('split')) {
        if (value.includes('|')) {
          variables[name.split('.')[1]] = value;
          if (value.split('.')[0].includes('|'))
            specialVariables[hash.substr(0, 5) + '.' + name] =
              value.split('.')[0];
          return;
        }
        if (value.includes('split')) {
          value = variables[value.split('.')[1]];
          if (value) {
            specialVariables[hash.substr(0, 5) + '.' + name] = value;
          }
          return;
        }
      }
      // }
    },
  };

  traverse(ast, deob);
  // console.log(specialVariables);
  return specialVariables;
};

const deobfuscate_mixed_strings = (ast) => {
  const strings = getMixedStrings(ast);
  let deob = {
    CallExpression(p) {
      if (p.node.callee && p.node.callee.name) {
        if (p.node.callee.name === 'c' || p.node.callee.name === 'b') {
          val = p.node.arguments[0].value;
          string = strings[val - 0];
          p.replaceWith(t.stringLiteral(string));
        }
      }
    },
  };

  traverse(ast, deob);
};

const unroll_switch_statements = (ast) => {
  vars = getAllVariableValues(ast);
  // console.log(vars);

  const deob = {
    ForStatement(p) {
      if (!t.isBlockStatement(p.node.body)) return;
      if (!t.isSwitchStatement(p.node.body.body[0])) return;
      hash = crypto
        .createHash('md5')
        .update(generate(p.node.init).code)
        .digest('hex');
      node = p.node.body.body[0];
      if (!t.isMemberExpression(node.discriminant)) return;
      if (!t.isUpdateExpression(node.discriminant.property)) return;

      let value = vars[hash.substr(0, 5) + '.' + node.discriminant.object.name];
      if (!value) return;
      if (value.split('|').length !== node.cases.length) {
        console.log(
          'Not unrolling switch statement - cases do not match order length'
        );
        return;
      }

      currentCases = node.cases;
      shouldBe = [];

      p.node.init.expressions.forEach((elem) => {
        shouldBe.push(t.toStatement(elem));
      });

      value.split('|').forEach((elem, index) => {
        shouldBe[index + p.node.init.expressions.length] =
          currentCases[parseInt(elem)].consequent[0];
      });
      if (p.parent.type === 'BlockStatement') {
        p.parent.body = [...p.parent.body, ...shouldBe];
        p.remove();
      } else {
        p.replaceWith(t.blockStatement(shouldBe));
      }
    },
  };
  traverse(ast, deob);
};

const remove_helper_functions = (ast) => {
  /*
  function a(a, b) {
	  return a == b
  }

  a("stringa", "stringb")
  =>

  "stringa" == "stringb"

  */

  let functions = new Map();

  traverse(ast, {
    'FunctionDeclaration|FunctionExpression'(path) {
      const { node } = path;
      if (
        path.node.body.body.length !== 1 ||
        !t.isReturnStatement(node.body.body[0]) ||
        !(
          t.isBinaryExpression(node.body.body[0].argument) ||
          t.isLogicalExpression(node.body.body[0].argument) ||
          t.isCallExpression(node.body.body[0].argument)
        )
      )
        return;

      const parent = path.parentPath.node;
      if (t.isFunctionDeclaration(node)) id = node.id.name;
      else id = t.isIdentifier(parent.left) ? parent.left.name : parent.left;

      const type = node.body.body[0].argument.type;

      // get the displayed name, for example a.b.c = function() {}
      chain = [];
      if (t.isMemberExpression(id)) {
        while (true) {
          chain.push(id.property.name);
          if (t.isIdentifier(id.object)) {
            chain.push(id.object.name);
            break;
          } else {
            id = id.object;
          }
        }
        id = chain.reverse().join('.');
      }

      functions.set(id, {
        argumentsLen: node.params.length,
        type,
        operator: node.body.body[0].argument?.operator,
      });
      // path.remove();
    },
  });

  // console.log(functions);
  traverse(ast, {
    CallExpression(path) {
      const { node } = path;

      if (t.isIdentifier(node.callee)) id = node.callee.name;
      else id = node.callee;

      // get the displayed name, for example a.b.c = function() {}
      chain = [];
      if (t.isMemberExpression(id)) {
        while (true) {
          try {
            chain.push(id.property?.name);
          } catch (e) {
            console.log(node, e, id);
            return;
          }
          if (t.isIdentifier(id.object)) {
            chain.push(id.object.name);
            break;
          } else {
            id = id.object;
          }
        }
        id = chain.reverse().join('.');
      }
      if (!functions.has(id)) return;
      entry = functions.get(id);

      try {
        // if (entry.type == 'BinaryExpression') {
        //   path.replaceWith(
        //     t.binaryExpression(
        //       entry.operator,
        //       node.arguments[0],
        //       node.arguments[1]
        //     )
        //   );
        // } else if (entry.type == 'LogicalExpression') {
        //   path.replaceWith(
        //     t.logicalExpression(
        //       entry.operator,
        //       node.arguments[0],
        //       node.arguments[1]
        //     )
        //   );
        // } else
        if (entry.type == 'CallExpression') {
          callee = node.arguments.shift();
          path.replaceWith(t.callExpression(callee, node.arguments));
        }
      } catch (e) {
        console.log(e);
      }
    },
  });
};

const deobfuscate_cloudflare = (ast) => {
  try {
    deobfuscate_mixed_strings(ast);
  } catch {}
  try {
    unroll_switch_statements(ast);
  } catch {}
};

module.exports = { deobfuscate_cloudflare, remove_helper_functions };
