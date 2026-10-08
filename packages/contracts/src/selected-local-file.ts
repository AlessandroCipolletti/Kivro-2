import { z } from 'zod';

const reference = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);

/** Private Worker-only binding. The public permission manifest contains IDs, never paths. */
export const SelectedLocalBindingSchema = z.strictObject({
  resourceId: reference,
  kind: z.enum(['FILE', 'DIRECTORY']),
  absolutePath: z.string().min(2).max(4096).startsWith('/'),
  device: z.number().int().nonnegative(),
  inode: z.number().int().positive(),
  files: z.array(z.strictObject({
    fileId: reference,
    relativePath: z.string().min(1).max(1024),
    device: z.number().int().nonnegative(),
    inode: z.number().int().positive(),
    sizeBytes: z.number().int().nonnegative().max(16_000_000),
    sha256: digest,
  })).min(1).max(64),
}).superRefine((binding, context) => {
  if (binding.kind === 'FILE' && (binding.files.length !== 1 ||
    binding.files[0]?.relativePath !== '.')) {
    context.addIssue({ code: 'custom', message: 'File binding must name only itself' });
  }
  if (new Set(binding.files.map((file) => file.fileId)).size !== binding.files.length ||
    new Set(binding.files.map((file) => file.relativePath)).size !== binding.files.length) {
    context.addIssue({ code: 'custom', message: 'Duplicate selected file binding' });
  }
});

export type SelectedLocalBinding = z.infer<typeof SelectedLocalBindingSchema>;
