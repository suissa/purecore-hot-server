// File: test/server.test.ts
import { configSchema, z } from '../validator';

describe('Auto-Server Internals', () => {
    
    test('Validator: should parse valid config', () => {
        const input = {
            port: 3000,
            root: '/usr/www',
            open: 'true'
        };
        const output = configSchema.parse(input);
        expect(output).toEqual(input);
    });

    test('Validator: should fail on invalid types', () => {
        const input = {
            port: "3000", // should be number
            root: '/usr/www',
            open: 'true'
        };
        expect(() => configSchema.parse(input)).toThrow();
    });

    test('Mini-Zod: should handle nested objects', () => {
        const schema = z.object({
            user: z.object({
                name: z.string()
            })
        });
        
        const data = { user: { name: 'Dev' } };
        expect(schema.parse(data)).toEqual(data);
    });

    // Nota: Testes de integração (subir servidor real) em ambiente "zero deps" 
    // costumam ser feitos mockando o módulo 'http', mas foge ao escopo simples aqui.
});