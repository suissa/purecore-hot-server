/**
 * Um mini-validador type-safe inspirado no Zod.
 * Garante que nossa configuração de entrada seja válida sem importar bibliotecas externas.
 */
export class Schema {
    validator;
    constructor(validator) {
        this.validator = validator;
    }
    parse(value) {
        return this.validator(value);
    }
}
export const z = {
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
export const configSchema = z.object({
    port: z.number(),
    root: z.string(),
    open: z.string(), // boolean as string 'true'/'false' simplificado para CLI
    spa: z.string(), // boolean as string 'true'/'false' para suporte SPA
    https: z.string() // boolean as string 'true'/'false' para modo HTTPS
});
