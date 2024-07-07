/**
 * Based on the TSE Fulcrum API client implementation by justinyaodu:
 * https://github.com/TritonSE/TSE-Fulcrum/blob/main/frontend/src/api.ts
 */

/**
 * A custom type defining which HTTP methods we will handle in this file
 */
type Method = "GET" | "POST" | "PUT";

/**
 * The first part of the backend API URL, which we will automatically prepend to
 * every request. This means in the rest of our code, we can write "/api/foo"
 * instead of "http://localhost:3001/api/foo".
 *
 * See https://vitejs.dev/guide/env-and-mode for more info about env variables
 * in Vite projects.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * A wrapper around the built-in `fetch()` function that abstracts away some of
 * the low-level details so we can focus on the important parts of each request.
 * See https://developer.mozilla.org/en-US/docs/Web/API/fetch for information
 * about the Fetch API.
 *
 * @param method The HTTP method to use
 * @param url The URL to request
 * @param body The body of the request, or undefined if there is none
 * @param headers The headers of the request
 * @returns The Response object returned by `fetch()
 */
async function fetchRequest(
  method: Method,
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<Response> {
  const hasBody = body !== undefined;

  const newHeaders = { ...headers };
  if (hasBody) {
    newHeaders["Content-Type"] = "application/json";
  }
  console.log(method, url, body, headers);
  const response = await fetch(url, {
    method,
    headers: newHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  return response;
}

/**
 * Throws an error if the given response's status code indicates an error
 * occurred, else does nothing.
 *
 * @param response A response returned by `fetch()` or `fetchRequest()`
 * @throws An error if the response was not successful (200-299) or a redirect
 * (300-399)
 */
async function assertOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  let message = `${response.status} ${response.statusText}`;

  try {
    const text = await response.text();
    if (text) {
      message += ": " + text;
    }
  } catch (e) {
    // skip errors
  }

  throw new Error(message);
}

/**
 * Sends a GET request to the provided API URL.
 *
 * @param url The URL to request
 * @param headers The headers of the request (optional)
 * @returns The Response object returned by `fetch()`
 */
export async function get(
  url: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  // GET requests do not have a body
  const response = await fetchRequest(
    "GET",
    API_BASE_URL + url,
    undefined,
    headers
  );
  void assertOk(response);
  return response;
}

/**
 * Sends a POST request to the provided API URL.
 *
 * @param url The URL to request
 * @param body The body of the request, or undefined if there is none
 * @param headers The headers of the request (optional)
 * @returns The Response object returned by `fetch()`
 */
export async function post(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  const response = await fetchRequest(
    "POST",
    API_BASE_URL + url,
    body,
    headers
  );
  void assertOk(response);
  return response;
}

/**
 * Sends a PUT request to the provided API URL.
 *
 * @param url The URL to request
 * @param body The body of the request, or undefined if there is none
 * @param headers The headers of the request (optional)
 * @returns The Response object returned by `fetch()`
 */
export async function put(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  const response = await fetchRequest("PUT", API_BASE_URL + url, body, headers);
  void assertOk(response);
  return response;
}

export type APIData<T> = { success: true; data: T };
export type APIError = { success: false; error: string };
/**
 * Utility type for the result of an API request. API client functions should
 * always return an object of this type (without throwing an exception if
 * something goes wrong). This allows users of the functions to perform easier
 * error checking without excessive try-catch statements, making use of
 * TypeScript's type narrowing feature. Specifically, by checking whether the
 * `success` field is true or false, you'll know whether you can access the
 * `data` field with the actual API response or the `error` field with an error
 * message.
 *
 * For example, assume we have some API function with the type definition
 * `doSomeRequest: (parameters: SomeParameters) => Promise<APIResult<SomeData>>`.
 * Then we could use it in a frontend component as follows:
 * ```
 * doSomeRequest(parameters).then((result: APIResult<SomeData>) => {
 *   if (result.success) {
 *     console.log(result.data); // do something with the data, which is of type SomeData
 *   } else {
 *     console.error(result.error); // do something to inform the user of the error
 *   }
 * })
 * ```
 *
 * See `createTask` in `src/api/tasks` and its use in `src/components/TaskForm`
 * for a more concrete example, and see
 * https://www.typescriptlang.org/docs/handbook/2/narrowing.html for more info
 * about type narrowing.
 */
export type APIResult<T> = APIData<T> | APIError;

/**
 * Helper function for API client functions to handle errors consistently.
 * Recommended usage is in a `catch` block--see `createTask` in `src/api/tasks`
 * for an example.
 *
 * @param error An error thrown by a lower-level API function
 * @returns An `APIError` object with a message from the given error
 */
export function handleAPIError(error: unknown): APIError {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  } else if (typeof error === "string") {
    return { success: false, error };
  }
  return { success: false, error: `Unknown error: ${String(error)}` };
}
