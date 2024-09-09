export enum Role {
  Admin = 999,
  Chair = 200,
  ViceChair = 150,
  Secretary = 100,
  ClassRep = 50,
  Anonymous = 0,
}

export interface User {
  name: string;
  email: string;
  role: number;
  schoolNumber: string;
  clazz: string; // class, but to avoid internal keyword conflict
}
