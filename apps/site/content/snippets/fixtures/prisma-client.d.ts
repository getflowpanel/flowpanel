declare module "@prisma/client" {
  export interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: Date;
  }
  export interface Order {
    id: number;
    number: string;
    status: string;
    totalCents: number;
    customerId: number;
    createdAt: Date;
  }
  export class PrismaClient {
    user: unknown;
    order: unknown;
    $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  }
}
