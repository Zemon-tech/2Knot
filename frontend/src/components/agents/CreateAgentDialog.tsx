import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CreateAgentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string | null;
  onCreated: (agent: { _id: string; name: string; slug: string; description?: string; systemPrompt: string }) => void;
  createAgent: (body: { name: string; description?: string; systemPrompt: string }) => Promise<{ agent: any }>;
};

export default function CreateAgentDialog({ open, onOpenChange, initialName, onCreated, createAgent }: CreateAgentDialogProps) {
  const [name, setName] = useState<string>(initialName || "");
  const [description, setDescription] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(initialName || "");
    setDescription("");
    setSystemPrompt("");
    setError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className={cn("sm:max-w-md")}
        onOpenAutoFocus={(e) => {
          // prevent focusing outside inputs
          e.preventDefault();
        }}
      >
        <DialogTitle>Create new agent</DialogTitle>
        <DialogDescription>Provide details for your agent.</DialogDescription>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              placeholder="e.g. Research Assistant"
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              placeholder="Short description"
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">System prompt</label>
            <textarea
              value={systemPrompt}
              placeholder="Explain the agent's behavior and goals..."
              onChange={(e) => setSystemPrompt(e.currentTarget.value)}
              className="w-full min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <div className="text-xs text-red-500">{error}</div>
          )}
          <div className="pt-1 flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={loading || !name.trim() || !systemPrompt.trim()}
              onClick={async () => {
                if (!name.trim() || !systemPrompt.trim()) return;
                setLoading(true);
                setError(null);
                try {
                  const { agent } = await createAgent({ name: name.trim(), description: description.trim() || undefined, systemPrompt: systemPrompt.trim() });
                  onCreated(agent as any);
                  onOpenChange(false);
                  reset();
                } catch (e: any) {
                  setError(e?.message || "Failed to create agent");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
