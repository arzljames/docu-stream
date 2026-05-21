import axiosInstance from "./axios-instance";

export type InstanceUser = {
  email: string;
  id: string;
  name: string;
};

type InstanceUsersResponse = {
  data: {
    users: InstanceUser[];
  };
};

export const instanceUserQueryKeys = {
  all: ["instance-users"] as const,
  list: () => [...instanceUserQueryKeys.all, "list"] as const,
};

export async function listInstanceUsers() {
  const response =
    await axiosInstance.get<InstanceUsersResponse>("/api/instances/users");

  return response.data.data.users;
}
