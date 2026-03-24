export enum Role {
  Admin = 999,
  Chair = 200,
  ViceChair = 150,
  Secretary = 100,
  OtherDepartment = 25,
  ClassRep = 50,
  Anonymous = 0,
}

export interface UserClaims {
  role: number;
  schoolNumber: string;
  clazz: string;
  seatNumber: string;
}

export interface User {
  uid?: string;
  name: string;
  email: string;
  role: number;
  schoolNumber: string;
  clazz: string;
  seatNumber: string;
}
