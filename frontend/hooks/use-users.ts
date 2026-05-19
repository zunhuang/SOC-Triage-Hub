import useSWR from "swr";
import { apiClient } from "@/lib/api-client";
import { UserProfile } from "@/contexts/auth-context";

interface UsersResponse {
  users: UserProfile[];
  total: number;
  skip: number;
  limit: number;
}

const fetcher = <T,>(url: string) => apiClient.get<T>(url);

export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR<UsersResponse>(
    "/api/users",
    fetcher,
    { revalidateOnFocus: false }
  );
  return { data, error, isLoading, mutate };
}

export async function createUser(body: {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: "admin" | "analyst";
}): Promise<UserProfile> {
  return apiClient.post<UserProfile>("/api/users", body);
}

export async function patchUser(
  id: string,
  body: Partial<{ first_name: string; last_name: string; role: "admin" | "analyst"; is_active: boolean }>
): Promise<UserProfile> {
  return apiClient.patch<UserProfile>(`/api/users/${id}`, body);
}

export async function toggleUserActive(id: string): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/api/users/${id}`);
}
