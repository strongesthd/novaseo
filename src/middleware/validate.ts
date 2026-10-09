import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export function validate(schema: { body?: AnyZodObject; query?: AnyZodObject; params?: AnyZodObject }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.params) Object.assign(req.params, schema.params.parse(req.params));
      if (schema.query) {
        const parsed = schema.query.parse(req.query);
        for (const key of Object.keys(req.query)) delete req.query[key];
        Object.assign(req.query, parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(Object.assign(new Error('VALIDATION_ERROR'), { statusCode: 400, details: err.issues }));
        return;
      }
      next(err);
    }
  };
}
