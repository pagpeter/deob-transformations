const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const _utils = require("./_utils");

/**
 * Makes the code use the dot notation everywhere.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const deobfuscate_object_calls = (ast) => {
    traverse(ast, {
        MemberExpression(path) {
            let { object, property, computed } = path.node;
            if (!computed) return; // Verify computed property is false
            if (!t.isStringLiteral(property)) return; // Verify property is a string literal
            if (!_utils.isInvalidExpression(property.value)) return; // Verify that the property being accessed is a valid identifier      // If conditions pass:      // Replace the node with a new one
            path.replaceWith(t.MemberExpression(object, t.identifier(property.value), false));
        },
    });
};

/**
 * Execute static, predictable code like string concatenations.
 * https://steakenthusiast.github.io/2022/05/28/Deobfuscating-Javascript-via-AST-Manipulation-Constant-Folding/#Examples
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const constant_folding = (ast) => {
    // Visitor for constant folding
    const foldConstantsVisitor = {
        BinaryExpression(path) {
            const left = path.get("left");
            const right = path.get("right");
            const operator = path.get("operator").node;

            if (t.isStringLiteral(left.node) && t.isStringLiteral(right.node)) {
                // In this case, we can use the old algorithm
                // Evaluate the binary expression
                let { confident, value } = path.evaluate();
                // Skip if not confident
                if (!confident) return;
                // Create a new node, infer the type
                let actualVal = t.valueToNode(value);
                // Skip if not a Literal type (e.g. StringLiteral, NumericLiteral, Boolean Literal etc.)
                if (!t.isStringLiteral(actualVal)) return;
                // Replace the BinaryExpression with the simplified value
                path.replaceWith(actualVal);
            } else {
                // Check if the right side is a StringLiteral. If it isn't, skip this node by returning.
                if (!t.isStringLiteral(right.node)) return;
                //Check if the right sideis a StringLiteral. If it isn't, skip this node by returning.
                if (!t.isStringLiteral(left.node.right)) return;
                // Check if the operator is addition (+). If it isn't, skip this node by returning.
                if (operator !== "+") return;

                // If all conditions are fine:

                // Evaluate the _right-most edge of the left-side_ + the right side;
                let concatResult = t.StringLiteral(left.node.right.value + right.node.value);
                // Replace the _right-most edge of the left-side_ with `concatResult`.
                left.get("right").replaceWith(concatResult);
                //Remove the original right side of the expression as it is now a duplicate.
                right.remove();
            }
        },
        LogicalExpression(path) {
            const { node } = path;
            if (node.operator === "&&") {
                if (t.isStringLiteral(node.left) && t.isStringLiteral(node.right)) {
                    path.replaceWith(t.booleanLiteral(!!node.left.value && !!node.right.value));
                }
            }
        },
    };

    // Execute the visitor
    traverse(ast, foldConstantsVisitor);
};

/**
 * Execute static, predictable code like JSFuck.
 * https://steakenthusiast.github.io/2022/06/14/Deobfuscating-Javascript-via-AST-Deobfuscating-a-Peculiar-JSFuck-style-Case/
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const deobfuscate_jsfuck = (ast) => {
    const fixArrays = {
        ArrayExpression(path) {
            for (elem of path.get("elements")) {
                if (!elem.node) {
                    elem.replaceWith(t.valueToNode(undefined));
                }
            }
        },
    };

    traverse(ast, fixArrays);

    // Visitor for constant folding
    const constantFold = {
        "BinaryExpression|UnaryExpression"(path) {
            const { node } = path;
            if (t.isUnaryExpression(node) && (node.operator == "-" || node.operator == "void")) return;
            let { confident, value } = path.evaluate(); // Evaluate the binary expression
            if (!confident || value == Infinity || value == -Infinity) return; // Skip if not confident

            const newNode = t.valueToNode(value);

            if (t.isBinaryExpression(newNode) || t.isUnaryExpression(newNode)) return;
            path.replaceWith(newNode); // Replace the BinaryExpression with a new node of inferred type
        },
    };

    //Execute the visitor
    traverse(ast, constantFold);
};

/**
 * Change !![] to true and ![] to true and !1 to false.
 * deobfuscate_jsfuck should be used instead!
 * @deprecated
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const deobfuscate_hidden_false = (ast) => {
    // change !![] to true and ![] to true and !1 to false
    const deob = {
        UnaryExpression(p) {
            if (p.node.argument == undefined) return;
            if (p.node.operator != "!") return;

            // get every '!'

            if (t.isUnaryExpression(p.node.argument) && p.node.argument.operator == "!") {
                // get every '!!'
                if (t.isArrayExpression(p.node.argument.argument)) {
                    // get every '!![]'
                    // replace with 'true'
                    p.replaceWith(t.booleanLiteral(true));
                }
            }
            if (t.isArrayExpression(p.node.argument) && JSON.stringify(p.node.argument.elements) == "[]") {
                // get every '![]'
                // replace with 'false'
                p.replaceWith(t.booleanLiteral(false));
            } else if (t.isNumericLiteral(p.node.argument) && p.node.argument.value == 1) {
                // get every '!1'
                // replace with 'false'
                p.replaceWith(t.booleanLiteral(false));
            }
        },
    };

    traverse(ast, deob);
};

/**
 * Remove unused variables and functions.
 * https://steakenthusiast.github.io/2022/06/04/Deobfuscating-Javascript-via-AST-Removing-Dead-or-Unreachable-Code/
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const delete_unused = (ast) => {
    const deob = {
        "VariableDeclarator|FunctionDeclaration"(path) {
            try {
                const { node, scope } = path;
                const { constant, referenced } = scope.getBinding(node.id.name);
                // If the variable is constant and never referenced, remove it.
                if (constant && !referenced) {
                    path.remove();
                }
            } catch {}
        },
    };

    traverse(ast, deob);
};

/**
 * Replace constants with actual value.
 * https://steakenthusiast.github.io/2022/05/31/Deobfuscating-Javascript-via-AST-Replacing-References-to-Constant-Variables-with-Their-Actual-Value/
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const replace_with_actual_val = (ast) => {
    const deob = {
        VariableDeclarator(path) {
            const { id, init } = path.node;
            // Ensure the the variable is initialized to a Literal type.
            if (!t.isLiteral(init)) return;
            let { constant, referencePaths } = path.scope.getBinding(id.name);
            // Make sure it's constant
            if (!constant) return;
            // Loop through all references and replace them with the actual value.
            for (let referencedPath of referencePaths) {
                referencedPath.replaceWith(init);
            }
            // Delete the now useless VariableDeclarator
            path.remove();
        },
    };

    traverse(ast, deob);
};

/**
 * Removes empty else blocks in if statements.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const remove_dead_else = (ast) => {
    // if (something) {} else {}
    //    =>
    // if (something) {}
    const shouldRemove = (node) => {
        if (t.isBlockStatement(node)) {
            if (node.body.length == 0) {
                return true;
            } else if (node.body.every(t.isEmptyStatement) || node.body.every(shouldRemove)) {
                return true;
            }
        } else if (t.isEmptyStatement(node)) {
            return true;
        }
        return false;
    };
    const deob = {
        IfStatement: {
            exit(path) {
                ast;
                let { consequent, alternate, test } = path.node;
                if (shouldRemove(alternate)) {
                    delete path.node.alternate;
                }
                if (shouldRemove(consequent) && alternate != null) {
                    delete path.node.alernate;
                    if (t.isBlockStatement(alternate)) {
                        path.replaceWith(t.ifStatement(t.unaryExpression("!", test), alternate));
                    } else if (t.isIfStatement(alternate)) {
                        path.replaceWith(t.ifStatement(t.unaryExpression("!", test), alternate));
                    }
                } else if (shouldRemove(consequent) && alternate == null) {
                    path.remove();
                }
            },
        },
    };

    traverse(ast, deob);
};

/**
 * Removes sequence epxressions (comma statements).
 * WARNING: can create invalid code in edgecases.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const remove_comma_statements = (ast) => {
    traverse(ast, {
        ReturnStatement(path) {
            const { node } = path;

            if (t.isSequenceExpression(node.argument)) {
                let expressionArr = [];
                const { expressions } = node.argument;
                expressions.forEach((node, indx) => {
                    if (indx !== expressions.length - 1) {
                        if (node.type === "CallExpression" && node.callee.type === "FunctionExpression")
                            expressionArr.push(t.emptyStatement(), t.unaryExpression("!", node), t.emptyStatement());
                        else expressionArr.push(node);
                    } else expressionArr.push(t.returnStatement(node));
                });
                path.replaceWithMultiple(expressionArr);
            }
        },

        IfStatement(path) {
            const { node } = path;
            const { test } = node;
            if (!t.isSequenceExpression(test)) return;
            const { expressions } = test;

            expressions.forEach((expression, index) => {
                if (index !== expressions.length - 1) {
                    path.insertBefore(t.expressionStatement(expression));
                } else {
                    node.test = expression;
                }
            });
        },

        AssignmentExpression(path) {
            const { node } = path;
            if (!t.isSequenceExpression(node.right)) return;
            const { expressions } = node.right;
            expressions.forEach((expression, index) => {
                if (index !== expressions.length - 1) {
                    path.insertBefore(t.expressionStatement(expression));
                } else {
                    path.replaceWith(t.AssignmentExpression("=", node.left, expression));
                }
            });
        },

        FunctionDeclaration(path) {
            if (!t.isBlockStatement(path.node.body)) return;

            const { body } = path.node.body;
            if (body.length !== 1) return;

            const [statement] = body;
            if (!t.isExpressionStatement(statement)) return;
            const { expression } = statement;
            if (!t.isSequenceExpression(expression)) return;

            newExpressions = [];
            expression.expressions.forEach((e) => {
                if (t.isAssignmentExpression(e)) {
                    newExpressions.push(t.expressionStatement(e));
                } else {
                    newExpressions.push(e);
                }
            });

            path.node.body.body = newExpressions;
        },

        ExpressionStatement(path) {
            if (!t.isSequenceExpression(path.node.expression)) return;
            expressions = path.node.expression.expressions;
            expressionsAndStatements = [];
            expressions.forEach((ex) => expressionsAndStatements.push(ex, t.emptyStatement()));
            path.replaceWithMultiple(expressionsAndStatements);
        },

        ForStatement(path) {
            if (!t.isSequenceExpression(path.node.init)) return;
            if (path.node.init.expressions.length < 1) return;
            const expressions = path.node.init.expressions;

            expressions.forEach((e, i) => {
                if (i === expressions.length - 1) return;
                path.insertBefore(t.expressionStatement(e));
            });
            if (!path.node.init) return;
            if (!path.node.init.expressions) return;
            path.node.init.expressions = [expressions[expressions.length - 1]];
        },
    });
};

/**
 * Replaces hexadecimal strings and encoded strings with a readable value.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const replace_hex_encoded = (ast) => {
    traverse(ast, {
        "DirectiveLiteral|StringLiteral|NumericLiteral"(path) {
            if (!path.node.extra) return;
            try {
                if (path.node.extra.expressionValue) path.node.value = path.node.extra.expressionValue;
            } catch (e) {
                console.error(e);
            }
            try {
                if (path.node.extra) delete path.node.extra;
            } catch (e) {
                console.error(e);
            }
        },
    });
};

/**
 * Removes useless if statementes. E.g `if (true) {}`.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const remove_useless_if = (ast) => {
    traverse(ast, {
        IfStatement(path) {
            if (!t.isBooleanLiteral(path.node.test)) return;
            if (path.node.test.value) {
                // if (true)
                if (t.isBlockStatement(path.node.consequent)) path.replaceWithMultiple(path.node.consequent.body);
                else path.replaceWith(path.node.consequent);
            } else {
                // if (false)
                if (path.node.alternate) {
                    if (t.isBlockStatement(path.node.alternate)) path.replaceWithMultiple(path.node.alternate.body);
                    else path.replaceWith(path.node.alternate);
                } else path.remove();
            }
        },
    });
};

/**
 * Rename the arguments of a function to be more uniform and readable.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const rename_function_arguments = (ast) => {
    const names = _utils.getAllNames();

    traverse(ast, {
        "FunctionDeclaration|FunctionExpression"(path) {
            path.node.params.forEach((elem, i) => path.scope.rename(elem.name, `arg_${names[i]}`));
        },
    });
};

/**
 * Renames all identifiers in variable declarators. Also renames function names.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const rename_identifiers = (ast, custom = []) => {
    const names = _utils.getAllNames();
    let c = 0;
    traverse(ast, {
        "VariableDeclarator|FunctionDeclaration"(p) {
            const n = p.node.id.name;
            const newName =
                (p.node.type === "VariableDeclarator" ? "var_" : "func_") +
                (custom?.[c] === undefined ? names[c] : custom?.[c]);
            console.log("RENAMING", n, newName);
            if (p.node.type === "VariableDeclarator") p.scope.rename(n, newName);
            else p.parentPath.scope.rename(n, newName);
            c++;
        },
    });
};

/**
 * Removes empty statements, for example useless semicolons.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const remove_empty_statements = (ast) => {
    traverse(ast, {
        EmptyStatement(path) {
            path.remove();
        },
    });
};

// const simplify_logical_expressions = (ast) => {
//   /*
//     Antibots tend to flatten if statements into logical expressions.
//     This undoes that transformation.
//     e.g: e && e.pageX && e.pageY ? (n = Math.floor(e.pageX), o = Math.floor(e.pageY)) : e && e.clientX && e.clientY && (n = Math.floor(e.clientX), o = Math.floor(e.clientY));
//     turns into:
//     if (e && e.pageX && e.pageY) {
//         n = Math.floor(e.pageX);
//         o = Math.floor(e.pageY);
//     } else {
//         if (e && e.clientX && e.clientY) {
//             n = Math.floor(e.clientX);
//             o = Math.floor(e.clientY);
//         }
//     }
//   */
//   traverse(ast, {
//     ConditionalExpression(path) {
//       if (
//         !t.isLogicalExpression(path.node.alternate) ||
//         !t.isLogicalExpression(path.node.alternate.left) ||
//         !t.isSequenceExpression(path.node.alternate.right) ||
//         !t.isLogicalExpression(path.node.test)
//       ) {
//         // console.log('Cant match conditional expression', path.node);
//       }

//       // make the "consequent" part
//       let consequent;
//       try {
//         if (t.isSequenceExpression(path.node.consequent)) {
//           let tmpstatements = [];
//           path.node.consequent.expressions.forEach((elem) => {
//             if (!t.isCallExpression(elem)) {
//               tmpstatements.push(t.toStatement(elem));
//             } else {
//               tmpstatements.push(elem);
//             }
//           });
//           consequent = t.blockStatement(tmpstatements);
//         } else if (t.isAssignmentExpression(path.node.consequent)) {
//           consequent = t.blockStatement([t.toStatement(path.node.consequent)]);
//         } else {
//           // console.log('Cant deobfuscate', path.node.consequent);
//           return;
//         }
//       } catch (e) {
//         console.log('CONSEQUENT', path.node.consequent, e);
//         return;
//       }

//       // Make the "alternate" part (if not matched)
//       let alternate;
//       try {
//         alternate = t.ifStatement(
//           path.node.alternate.left,
//           t.blockStatement(
//             path.node.alternate.right.expressions.map((elem) =>
//               t.toStatement(elem)
//             )
//           ),
//           null
//         );
//       } catch (e) {
//         console.log('ALTERNATE');
//         return;
//       }

//       path.parentPath.replaceWith(
//         t.ifStatement(path.node.test, consequent, alternate)
//       );
//     },
//   });
// };

/**
 * Rewrites inline ternary operators to use if/else statements.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
const rewrite_inline_if = (ast) => {
    /*
  a.c = a < b ? "a is less than b" : "a is not less than b";

  if (a < b) {
    a = "a is less than b"
  } else {
    a = "a is not less than b"
  }
  */

    traverse(ast, {
        ExpressionStatement(path) {
            let { node } = path;
            if (
                t.isAssignmentExpression(node.expression) &&
                t.isConditionalExpression(node.expression.right) &&
                (t.isIdentifier(node.expression.left) || t.isMemberExpression(node.expression.left)) // &&
                // t.isStringLiteral(node.expression.right.consequent) &&
                // t.isStringLiteral(node.expression.right.alternate)
            ) {
                // Build up the if statement
                ifStatement = t.ifStatement(
                    node.expression.right.test,
                    t.blockStatement([
                        t.toStatement(
                            t.assignmentExpression(
                                node.expression.operator,
                                node.expression.left,
                                node.expression.right.consequent,
                            ),
                        ),
                    ]),
                    t.blockStatement([
                        t.toStatement(
                            t.assignmentExpression(
                                node.expression.operator,
                                node.expression.left,
                                node.expression.right.alternate,
                            ),
                        ),
                    ]),
                );
                path.replaceWith(ifStatement);
            }
        },
    });
};

/**
 * Rewrites inline logical expressions.
 *
 * @param {t.Node} <ast> Babel abstract sytnax tree
 * @returns {t.Node} Babel abstract sytnax tree
 */
function rewrite_inline_logical_expression(ast) {
    /*

  function a() {
	  return g=a, h instanceof g.Function && g.Function.prototype.toString.call(h).indexOf("[native code]") > 0;
  }

  to

  function a() {
    if (h instanceof g.Function) {
      _temp = g.Function.prototype.toString.call(h).indexOf("[native code]") > 0;
    }

    return g = a, _temp;
  }

  */
    traverse(ast, {
        LogicalExpression(path) {
            const { node } = path;
            if (node.operator !== "&&") return;
            let id = path.scope.generateUidIdentifier();
            let body = t.blockStatement([t.toStatement(t.assignmentExpression("=", id, node.right))]);
            let ifStatement = t.ifStatement(node.left, body);

            path.getStatementParent().insertBefore(ifStatement);
            path.replaceWith(id);
        },
    });
}

module.exports = {
    deobfuscate_object_calls,
    deobfuscate_hidden_false,
    delete_unused,
    remove_dead_else,
    replace_with_actual_val,
    remove_comma_statements,
    replace_hex_encoded,
    remove_useless_if,
    rename_function_arguments,
    deobfuscate_jsfuck,
    constant_folding,
    remove_empty_statements,
    rewrite_inline_if,
    rewrite_inline_logical_expression,
    rename_identifiers,
};
