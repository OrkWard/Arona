import { Prisma } from "@prisma/client";

export class DBError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "Prisma Client Error";
  }
}

export function handleDBError(e: unknown): DBError {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return new DBError(`Known Error, code ${e.code}, message ${e.message}`);
  } else if (e instanceof Error) {
    return new DBError(e.message, { cause: e.cause });
  }
  return new DBError(`DB Unknown Error: ${Error.prototype.toString.call(e)}`);
}
