import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { copyShortcut, copyText } from "../lib/clipboard";
import type { Business, BusinessInput } from "../lib/types";
import { ClaudeCodeRequest, useCopyRequest } from "./ClaudeCodeRequest";
import { Button, formatDate } from "./ui";

/** Draft, edit and copy the cold email pitch for one business. */
export function EmailPitch({
  business,
  aiEnabled,
  onSave,
  onChange,
  onRefresh,
}: {
  business: Business;
  aiEnabled: boolean;
  onSave: (patch: BusinessInput) => Promise<void>;
  onChange: (b: Business) => void;
  onRefresh: () => void;
}) {
  const [subject, setSubject] = useState(business.pitchSubject ?? "");
  const [body, setBody] = useState(business.pitchEmail ?? "");
  const [drafting, setDrafting] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => setSubject(business.pitchSubject ?? ""), [business.pitchSubject]);
  useEffect(() => setBody(business.pitchEmail ?? ""), [business.pitchEmail]);

  const request = `Draft an email pitch for "${business.name}" (lead id ${business._id}) on my Business Outreach Board. Read its research notes, audit and activity, write a short personal pitch signed with my info from Settings, and save it to the lead's Email pitch.`;
  const { copied, copyRequest, requestRef } = useCopyRequest(request);
  const hasPitch = Boolean(subject.trim() || body.trim());

  async function draft() {
    if (!aiEnabled) {
      setShowRequest(true);
      await copyRequest();
      return;
    }
    setDrafting(true);
    const t = toast.loading("Claude is writing your pitch…");
    try {
      const updated = await api.post<Business>(`/ai/pitch/${business._id}`);
      onChange(updated);
      toast.success("Pitch drafted. Read it over before sending.", { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't draft the pitch", { id: t });
    } finally {
      setDrafting(false);
    }
  }

  async function copy(text: string, what: string) {
    if (await copyText(text)) toast.success(`${what} copied`);
    else toast.error(`Your browser blocked copying. Select the text and press ${copyShortcut}.`);
  }

  const mailto = business.email
    ? `mailto:${encodeURIComponent(business.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "";

  return (
    <div className="rounded-lg border border-line bg-white/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Mail className="h-4 w-4 text-pink-700" /> Email pitch
          </p>
          {business.pitchUpdatedAt && <p className="text-xs text-faint">Last drafted {formatDate(business.pitchUpdatedAt)}</p>}
        </div>
        <Button size="sm" variant="primary" onClick={draft} loading={drafting}>
          <Sparkles className="h-3.5 w-3.5" /> {hasPitch ? "Redraft with Claude" : "Draft with Claude"}
        </Button>
      </div>

      {!aiEnabled && showRequest && (
        <div className="mb-3">
          <ClaudeCodeRequest
            request={request}
            copied={copied}
            onCopy={copyRequest}
            requestRef={requestRef}
            whatHappens="Claude reads this business's notes and audit, writes the pitch and saves it here (about a minute)."
            onDone={() => {
              setShowRequest(false);
              onRefresh();
            }}
          />
        </div>
      )}

      {!hasPitch && !showRequest ? (
        <p className="rounded-md bg-[rgb(55_53_47/0.04)] px-3 py-2.5 text-sm text-muted">
          Once your research notes and website audit are filled in, click <strong className="font-medium text-ink">Draft with Claude</strong>. Claude writes a short,
          personal pitch based on what you found. You can edit it here before sending.
        </p>
      ) : (
        <div className="space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => subject !== (business.pitchSubject ?? "") && onSave({ pitchSubject: subject })}
            placeholder="Subject line"
            aria-label="Email subject"
            className="field h-8 w-full rounded-md px-2.5 text-sm font-medium"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={() => body !== (business.pitchEmail ?? "") && onSave({ pitchEmail: body })}
            rows={12}
            placeholder="Email body"
            aria-label="Email body"
            className="field thin-scroll w-full rounded-md px-2.5 py-2 text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={() => copy(subject, "Subject")} disabled={!subject.trim()}>
              <Copy className="h-3.5 w-3.5" /> Copy subject
            </Button>
            <Button size="sm" onClick={() => copy(body, "Email")} disabled={!body.trim()}>
              <Copy className="h-3.5 w-3.5" /> Copy email
            </Button>
            {mailto ? (
              <a
                href={mailto}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-white px-2.5 text-xs font-medium text-ink hover:bg-[#f7f7f5]"
              >
                <Mail className="h-3.5 w-3.5" /> Open in Mail
              </a>
            ) : (
              <span className="text-xs text-faint">Add their email above to open this in your mail app.</span>
            )}
          </div>
          <p className="text-xs text-faint">Edits save automatically. Always read it over before sending.</p>
        </div>
      )}
    </div>
  );
}
