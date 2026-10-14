import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { copyShortcut, copyText, selectContents } from "../lib/clipboard";
import { Button } from "./ui";

/** Copies a Claude Code request, falling back to selecting it when the browser blocks the clipboard. */
export function useCopyRequest(request: string) {
  const [copied, setCopied] = useState(false);
  const requestRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setCopied(false), [request]);

  async function copyRequest() {
    const ok = await copyText(request);
    setCopied(ok);
    if (ok) {
      toast.success("Request copied. Paste it into Claude Code.");
    } else {
      setTimeout(() => selectContents(requestRef.current), 0);
      toast.info(`Your browser blocked copying. The request is selected, so press ${copyShortcut} to copy it.`);
    }
  }

  return { copied, copyRequest, requestRef };
}

/** The request box plus the three steps for handing work to Claude Code. */
export function ClaudeCodeRequest({
  request,
  copied,
  onCopy,
  requestRef,
  whatHappens,
  onDone,
}: {
  request: string;
  copied: boolean;
  onCopy: () => void;
  requestRef: React.RefObject<HTMLTextAreaElement | null>;
  whatHappens: string;
  onDone: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-white/80 p-4">
      <p className="text-xs font-medium text-muted">{copied ? "Your request (copied)" : `Your request: click inside, then press ${copyShortcut}`}</p>
      <div className="mt-1.5 flex items-start gap-2 rounded-md bg-pink-50 p-2 text-sm text-ink">
        <textarea
          ref={requestRef}
          readOnly
          value={request}
          rows={Math.min(8, Math.max(3, Math.ceil(request.length / 70)))}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Request for Claude Code"
          className="thin-scroll min-w-0 flex-1 resize-none border-0 bg-transparent p-1 text-sm leading-relaxed text-ink focus:outline-none"
        />
        <Button size="sm" onClick={onCopy}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
      </div>
      <ol className="mt-3 space-y-1.5 text-sm text-muted">
        <li>
          <span className="font-medium text-ink">1.</span> Open Claude Code in your{" "}
          <code className="rounded bg-[rgb(55_53_47/0.06)] px-1 text-xs">business-outreach-board</code> folder.
        </li>
        <li>
          <span className="font-medium text-ink">2.</span> Paste the request and send it. {whatHappens}
        </li>
        <li>
          <span className="font-medium text-ink">3.</span> When Claude says it's done, refresh the board.
        </li>
      </ol>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" size="sm" onClick={onDone}>
          <RefreshCw className="h-3.5 w-3.5" /> Claude's done, refresh board
        </Button>
      </div>
    </div>
  );
}
