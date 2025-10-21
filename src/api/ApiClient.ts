import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig
} from "axios";
import https from "https";
import { AgenticService } from "./services/AgenticService";
import { AuthenticationService } from "./services/AuthenticationService";
import { SpacesService } from "./services/SpacesService";
import { EnvironmentsService } from "./services/EnvironmentsService";
import type { UserSession } from "./services/types";

export class ApiClient {
  private instance: AxiosInstance;
  private session?: UserSession;
  private isRefreshing = false;
  private readonly authEndpoints = [
    "/Authentication/login",
    "/Authentication/refresh-token"
  ];

  public readonly authentication: AuthenticationService;
  public readonly agentic: AgenticService;
  public readonly spaces: SpacesService;
  public readonly environments: EnvironmentsService;

  constructor(baseURL: string, token: string) {
    this.instance = axios.create({
      baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    this.authentication = new AuthenticationService(this);
    this.agentic = new AgenticService(this);
    this.spaces = new SpacesService(this);
    this.environments = new EnvironmentsService(this);

    this.setupInterceptors();
  }

  private isAuthenticationRequired(url: string): boolean {
    return this.authEndpoints.some((endpoint) => !url.endsWith(endpoint));
  }

  private setupInterceptors(): void {
    // Request interceptor to check token expiry
    this.instance.interceptors.request.use(
      async (config) => {
        // Skip token check for authentication endpoints
        if (config.url && !this.isAuthenticationRequired(config.url)) {
          return config;
        }

        if (this.session && this.isTokenExpired(this.session)) {
          await this.handleTokenRefresh();
        }
        return config;
      },
      (error) => {
        if (error instanceof Error) {
          return Promise.reject(error);
        }
        return Promise.reject(new Error(String(error)));
      }
    );

    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest:
          | (InternalAxiosRequestConfig & {
              _retry?: boolean;
            })
          | undefined = error.config;

        // Skip retry for authentication endpoints to avoid loops
        if (
          originalRequest?.url &&
          !this.isAuthenticationRequired(originalRequest.url)
        ) {
          return Promise.reject(error);
        }

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          try {
            await this.handleTokenRefresh();
            // Retry the original request with new token
            return this.instance(originalRequest);
          } catch (refreshError) {
            // If refresh fails, clear session
            this.clearSession();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private isTokenExpired(session: UserSession): boolean {
    const expiration = new Date(session.expiration).valueOf();
    return expiration <= Date.now();
  }

  private async handleTokenRefresh(): Promise<void> {
    if (this.isRefreshing) {
      while (this.isRefreshing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    if (!this.session?.refreshToken) {
      throw new Error("No refresh token available");
    }

    this.isRefreshing = true;

    try {
      const session = await this.authentication.refreshToken({
        accessToken: this.session.accessToken,
        refreshToken: this.session.refreshToken
      });

      this.session = session;
      this.instance.defaults.headers.authorization = `Bearer ${session.accessToken}`;
    } finally {
      this.isRefreshing = false;
    }
  }

  get client(): AxiosInstance {
    return this.instance;
  }

  setSession(session: UserSession): void {
    this.session = session;
    this.instance.defaults.headers.authorization = `Bearer ${session.accessToken}`;
  }

  clearSession(): void {
    this.session = undefined;
    delete this.instance.defaults.headers.authorization;
  }

  updateConfig(baseURL: string, token?: string): void {
    this.instance.defaults.baseURL = baseURL;

    if (token) {
      this.instance.defaults.headers.Authorization = `Bearer ${token}`;
    }

    this.clearSession();
  }
}
