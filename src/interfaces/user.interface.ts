export interface IUser {
  username: string;
  email:string,
  password: string;
  role: string;
  approval_status: "approved" | "dismissed" | "pending";
  status: "active" | "deactive";
}