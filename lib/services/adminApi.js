import axios from "axios";
import { backendUrl } from "../utils/env";

const adminApi = axios.create({
  baseURL: `${backendUrl}/api/admin`,
  timeout: 30000,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});


export default adminApi;
