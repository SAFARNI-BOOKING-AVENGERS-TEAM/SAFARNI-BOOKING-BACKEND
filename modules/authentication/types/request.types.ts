export interface ForgetPasswordRequest {
  body: {
    email: string;
  };
}



export interface LoginRequest {
    email: string;
    password:string;
}