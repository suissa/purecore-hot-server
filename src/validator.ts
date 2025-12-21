/**
 * Um mini-validador type-safe inspirado no Zod.
 * Garante que nossa configuração de entrada seja válida sem importar bibliotecas externas.
 */

export class Schema<T> {
  constructor(private validator: (value: unknown) => T) {}

  parse(value: unknown): T {
      return this.validator(value);
  }
}

export const z = {
  string: () => new Schema<string>((val) => {
      if (typeof val !== 'string') throw new Error(`Expected string, received ${typeof val}`);
      return val;
  }),
  
  number: () => new Schema<number>((val) => {
      const num = Number(val);
      if (isNaN(num)) throw new Error(`Expected number, received ${val}`);
      return num;
  }),

  object: <T extends Record<string, Schema<any>>>(shape: T) => new Schema<{ [K in keyof T]: ReturnType<T[K]['parse']> }>((val) => {
      if (typeof val !== 'object' || val === null) throw new Error("Expected object");
      const result: any = {};
      const obj = val as any;
      
      for (const key in shape) {
          try {
              result[key] = shape[key].parse(obj[key]);
          } catch (e: any) {
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
  spa: z.string() // boolean as string 'true'/'false' para suporte SPA
});

export type Config = ReturnType<typeof configSchema.parse>;