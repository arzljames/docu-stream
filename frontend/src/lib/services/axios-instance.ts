import axios, { AxiosHeaders } from "axios";
import { readStoredSessionToken } from "./session-token";

const axiosInstance = axios.create({
  headers: {
    Accept: "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  const sessionToken = readStoredSessionToken();

  if (!sessionToken) {
    return config;
  }

  config.headers = AxiosHeaders.from(config.headers);

  if (!config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  return config;
});

export default axiosInstance;
