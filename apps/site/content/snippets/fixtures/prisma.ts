export interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
}

export const prisma = {};
