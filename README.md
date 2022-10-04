# Useful babel transformations for deobfuscating javascript

This library contains a number of useful babel transformations, that will make nasty javascript code a lot more readable.

## Example


```js
const transformations = require('deob-transformations')

const code = `
function _aegh(){debugger;};const z = "l";const zz = "o"
const zzz = "g"
;;function _0x1uz(){;;debugger;};if (!![])  {
window["c"+zz+"ns"+zz+z+"e"][z+zz+zzz](z+zz+z);;
};;
`


ast = transformations.code_to_ast(code)

transformations.delete_unused(ast)
transformations.replace_with_actual_val(ast)
transformations.constant_folding(ast)
transformations.deobfuscate_object_calls(ast)
transformations.deobfuscate_hidden_false(ast)
transformations.remove_useless_if(ast)
transformations.remove_empty_statements(ast)

deobbed = transformations.ast_to_code(ast)
console.log(transformations.beautify_code(deobbed))
```

This example transforms the nasty input javascript into a very readable `window.console.log('lol')`.
