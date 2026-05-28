export function convertZodSchemaToParameters(schema: Record<string, any>) {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schema)) {
    const zodValue = value as any;
    let propDef: any = { description: zodValue?._def?.description || '' };

    const isOptional = zodValue?._def?.typeName === 'ZodOptional';
    const baseType = isOptional ? zodValue._def?.schema : zodValue;
    const typeName = baseType?._def?.typeName;

    if (typeName === 'ZodNumber') {
      propDef.type = 'number';
    } else if (typeName === 'ZodBoolean') {
      propDef.type = 'boolean';
    } else if (typeName === 'ZodEnum') {
      propDef.type = 'string';
      propDef.enum = baseType?._def?.values || [];
    } else if (typeName === 'ZodString') {
      propDef.type = 'string';
      // ZodEmail is represented as ZodString with an email check
      const checks = baseType?._def?.checks || [];
      if (checks.some((c: any) => c.kind === 'email')) propDef.format = 'email';
    } else {
      propDef.type = 'string';
    }

    properties[key] = propDef;
    if (!isOptional) required.push(key);
  }

  return { type: 'object' as const, properties, required };
}
