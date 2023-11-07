const transformations = require(".");

const code = `
function _aegh(){debugger;};const z = "l";const zz = "o"
const zzz = "g"
;;function _0x1uz(){;;debugger;};if (!![])  {
window["c"+zz+"ns"+zz+z+"e"][z+zz+zzz](z+zz+z);;
};;
const OO00OO11II = {}
const OO00OO11I1 = 1
OO00OO11II[OO00OO11I1] = OO00OO11I1
if (OO00OO11II[OO00OO11I1]) window["c"+zz+"ns"+zz+z+"e"][z+zz+zzz](z+zz+zz+z);;
`;

const ast = transformations.code_to_ast(code);

transformations.delete_unused(ast);
transformations.replace_with_actual_val(ast);
transformations.constant_folding(ast);
transformations.deobfuscate_object_calls(ast);
transformations.deobfuscate_hidden_false(ast);
transformations.remove_useless_if(ast);
transformations.remove_empty_statements(ast);
transformations.rename_identifiers(ast);

const deobbed = transformations.ast_to_code(ast);
console.log(transformations.beautify_code(deobbed));
