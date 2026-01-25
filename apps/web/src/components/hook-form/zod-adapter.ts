import type * as z4 from 'zod/v4/core';
import type { FieldValues } from 'react-hook-form';

import { zodResolver as baseZodResolver } from '@hookform/resolvers/zod';

// ----------------------------------------------------------------------

/**
 * Type-safe zodResolver adapter for Zod 4.x schemas
 *
 * This wraps @hookform/resolvers zodResolver to handle the type mismatch
 * between Zod 4's main export and the zod/v4/core types expected by the resolver.
 *
 * Usage:
 *   import { zodResolver } from 'src/components/hook-form';
 *   const methods = useForm({ resolver: zodResolver(MySchema) });
 */
export function zodResolver<
  TSchema extends { _zod: z4.$ZodTypeInternals<unknown, FieldValues> },
  TOutput = TSchema extends z4.$ZodType<infer O, unknown> ? O : unknown,
  TInput extends FieldValues = TSchema extends z4.$ZodType<unknown, infer I extends FieldValues>
    ? I
    : FieldValues,
>(schema: TSchema) {
  // Cast to any to bypass the type mismatch between zod and zod/v4/core
  // The runtime behavior is identical - this is purely a TS declaration issue
  return baseZodResolver(schema as any) as ReturnType<
    typeof baseZodResolver<TInput, unknown, TOutput>
  >;
}
