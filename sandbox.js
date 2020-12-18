"use strict"
const fs = require("fs")
const path = require("path")
const vm = require("vm")
const zlib = require("zlib")
const dataPath = path.join(__dirname, "data")
const contextFile = path.join(dataPath, "context")
const fnFile = path.join(dataPath, "context.fn")
const initCodeFile = path.join(__dirname, "sandbox.code.js")
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, {recursive: true, mode: 0o755})
}

Function.prototype.view = Function.prototype.toString
Function.prototype.constructor = new Proxy(Function, {
    apply: ()=>{
        throw Error("What do you want to do?")
    },
    constructor: ()=>{
        throw Error("What do you want to do?")
    }
})
Object.freeze(Object)
Object.freeze(Object.prototype)
Object.freeze(Function)
Object.freeze(Function.prototype)

let context = {}
if (fs.existsSync(contextFile)) {
    context = JSON.parse(String(zlib.unzipSync(fs.readFileSync(contextFile))))
}

vm.createContext(context, {
    codeGeneration: {
        strings: false,
        wasm: false
    }
})

if (fs.existsSync(fnFile)) {
    let fn = JSON.parse(String(zlib.unzipSync(fs.readFileSync(fnFile))))
    const restoreFunctions = (o, name)=>{
        for (let k in o) {
            let key = name + `["${k}"]`
            if (typeof o[k] === "string") {
                try {
                    vm.runInContext(`${key}=` + o[k], context)
                } catch(e) {}
            } else if (typeof o[k] === "object") {
                restoreFunctions(o[k], key)
            }
        }
    }
    restoreFunctions(fn, "this")
}

vm.runInContext(fs.readFileSync(initCodeFile), context)

const internal_properties = [
    'Object',             'Function',       'Array',
    'Number',             'parseFloat',     'parseInt',
    'Boolean',            'String',         'Symbol',
    'Date',               'RegExp',         'eval',
    'Error',              'EvalError',      'RangeError',
    'ReferenceError',     'SyntaxError',    'TypeError',
    'URIError',           'JSON',           //'Promise',
    'Math',               'Intl',
    'ArrayBuffer',        'Uint8Array',     'Int8Array',
    'Uint16Array',        'Int16Array',     'Uint32Array',
    'Int32Array',         'Float32Array',   'Float64Array',
    'Uint8ClampedArray',  'BigUint64Array', 'BigInt64Array',
    'DataView',           'Map',            'BigInt',
    'Set',                'WeakMap',        'WeakSet',
    'Proxy',              'Reflect',        'decodeURI',
    'decodeURIComponent', 'encodeURI',      'encodeURIComponent',
    'escape',             'unescape',
    'isFinite',           'isNaN',          'SharedArrayBuffer',
    'Atomics',            'WebAssembly'
]
for (let v of internal_properties) {
    vm.runInContext(`this.Object.freeze(this.${v})
this.Object.freeze(this.${v}.prototype)
const ${v} = this.${v}`, context)
}

let fn
const saveFunctions = (o, mp)=>{
    for (let k in o) {
        if (typeof o[k] === "function") {
            mp[k] = o[k].toString()
        } else if (typeof o[k] === "object" && o[k] !== null) {
            if (o === context) {
                try {
                    if (JSON.stringify(o[k]).length > 1048576)
                        o[k] = undefined
                } catch (e) {
                    o[k] = undefined
                }
            }
            if (o[k] === undefined)
                continue
            mp[k] = {}
            saveFunctions(o[k], mp[k])
        }
    }
}
const beforeSaveContext = ()=>{
    fn = {}
    saveFunctions(context, fn)
}
process.on("exit", (code)=>{
    beforeSaveContext()
    fs.writeFileSync(fnFile, zlib.deflateSync(JSON.stringify(fn)))
    fs.writeFileSync(contextFile, zlib.deflateSync(JSON.stringify(context)))
})
setInterval(()=>{
    beforeSaveContext()
    fs.writeFile(fnFile, zlib.deflateSync(JSON.stringify(fn)), (err)=>{})
    fs.writeFile(contextFile, zlib.deflateSync(JSON.stringify(context)), (err)=>{})
}, 300000)

class Never {}

let timeout = 500
module.exports.run = (code, env)=>{
    code = String(code).trim()
    let debug = ["\\","＼"].includes(code.substr(0, 1))
    if (debug)
        code = code.substr(1)
    try {
        if (code.match(/([^\w]|^)+(this|async|const|let){1}([^\w]|$)+/))
            throw new Error(`Don't use "this,async,const,let"`)
        vm.runInContext(`this.env=`+JSON.stringify(env), context)
        let res = vm.runInContext(code, context, {timeout: timeout})
        if (res === undefined && !debug)
            return new Never()
        return res
    } catch(e) {
        if (debug) {
            let line = e.stack.split("\n")[0].split(":").pop()
            return e.name + ": " + e.message + " (line: " + parseInt(line) + ")"
        }
        return new Never()
    }
}
module.exports.Never = Never
