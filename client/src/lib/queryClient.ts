import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const urlParts = queryKey.filter(part => part !== null && part !== undefined);
    const url = urlParts.join('/');
    
    console.log(`[getQueryFn] Constructed URL: ${url} from Key:`, queryKey);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`[getQueryFn] Received 401 for ${url}, returning null.`);
      return null;
    }

    await throwIfResNotOk(res);
    
    try {
      const jsonData = await res.json();
      console.log(`[getQueryFn] Successfully fetched JSON for ${url}:`, jsonData);
      return jsonData;
    } catch (error) {
        console.error(`[getQueryFn] Failed to parse JSON for ${url}:`, error);
        try {
          const textResponse = await res.text();
          console.error(`[getQueryFn] Response text for ${url}:`, textResponse);
        } catch (textError) {
          console.error(`[getQueryFn] Failed to read response text for ${url}:`, textError);
        }
        throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
