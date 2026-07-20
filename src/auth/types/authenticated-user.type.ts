export interface AuthenticatedUser {
  id: string;
  email: string;
  companyId: string | null;
  role: 'owner' | 'admin' | 'member' | null;
}
