export type UserRole = 'Donor' | 'Receiver';

export interface UserProfile {
  id: string;
  role: UserRole;
  organization_name?: string;
  full_name: string;
  phone?: string;
  createdAt: any;
}

export type PostStatus = 'pending' | 'claimed' | 'delivered' | 'expired';

export interface FoodPost {
  id: string;
  donorId: string;
  donorName?: string;
  foodType: string;
  category: string;
  quantity: number;
  latitude?: number;
  longitude?: number;
  preparationTime?: any;
  expiryTime: any;
  pickupAddress: string;
  notes?: string;
  status: PostStatus;
  claimedBy?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Claim {
  id: string;
  foodPostId: string;
  receiverId: string;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
