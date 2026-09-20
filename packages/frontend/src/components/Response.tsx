import { Streamdown } from "streamdown";

/** Streaming-safe markdown for assistant replies. */
export function Response({ children }: { children: string }) {
  return <Streamdown className="md">{children}</Streamdown>;
}
