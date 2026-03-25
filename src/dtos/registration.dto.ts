export interface PendingRegistrationResponseDto {
  id: string;
  username: string;
  email: string;
  approval_status: string;
  createdAt?: Date;
}

export interface PaginationMetaDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PendingRegistrationsDto {
  data: PendingRegistrationResponseDto[];
  meta: PaginationMetaDto;
}