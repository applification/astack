import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { StreamableHTTPClientTransportOptions } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/** SDK 1.32's optional sessionId getter conflicts with its own Transport under exactOptionalPropertyTypes.
 * Keep the real transport and proxy only the required wire/callback interface; no type assertions. */
export class HttpTransport implements Transport {
  onclose?: NonNullable<Transport["onclose"]>;
  onerror?: NonNullable<Transport["onerror"]>;
  onmessage?: NonNullable<Transport["onmessage"]>;
  private readonly transport: StreamableHTTPClientTransport;
  constructor(url: URL, options?: StreamableHTTPClientTransportOptions) {
    this.transport = new StreamableHTTPClientTransport(url, options);
    this.transport.onclose = () => {
      this.onclose?.();
    };
    this.transport.onerror = (error) => {
      this.onerror?.(error);
    };
    this.transport.onmessage = (message) => {
      this.onmessage?.(message);
    };
  }
  start(): Promise<void> {
    return this.transport.start();
  }
  send(...args: Parameters<Transport["send"]>): Promise<void> {
    return this.transport.send(...args);
  }
  close(): Promise<void> {
    return this.transport.close();
  }
}
