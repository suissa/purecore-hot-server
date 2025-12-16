"use strict";
/**
 * Um mini-validador type-safe inspirado no Zod.
 * Garante que nossa configuração de entrada seja válida sem importar bibliotecas externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.configSchema = exports.z = exports.Schema = void 0;
class Schema {
    validator;
    constructor(validator) {
        this.validator = validator;
    }
    parse(value) {
        return this.validator(value);
    }
}
exports.Schema = Schema;
exports.z = {
    string: () => new Schema((val) => {
        if (typeof val !== 'string')
            throw new Error(`Expected string, received ${typeof val}`);
        return val;
    }),
    number: () => new Schema((val) => {
        const num = Number(val);
        if (isNaN(num))
            throw new Error(`Expected number, received ${val}`);
        return num;
    }),
    object: (shape) => new Schema((val) => {
        if (typeof val !== 'object' || val === null)
            throw new Error("Expected object");
        const result = {};
        const obj = val;
        for (const key in shape) {
            try {
                result[key] = shape[key].parse(obj[key]);
            }
            catch (e) {
                throw new Error(`In field '${key}': ${e.message}`);
            }
        }
        return result;
    })
};
// Configuração Schema para o nosso servidor
exports.configSchema = exports.z.object({
    port: exports.z.number(),
    root: exports.z.string(),
    open: exports.z.string() // boolean as string 'true'/'false' simplificado para CLI
});
