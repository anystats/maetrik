"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { setSchemeEnrichment, deleteSchemeEnrichment } from "@/lib/api";

interface DescriptionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  tableName: string;
  columnName: string | null;
  currentDescription: string;
  onSaved: () => void;
}

export function DescriptionEditDialog({
  open,
  onOpenChange,
  connectionId,
  tableName,
  columnName,
  currentDescription,
  onSaved,
}: DescriptionEditDialogProps) {
  const [description, setDescription] = useState(currentDescription);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setDescription(currentDescription);
    }
  }, [open, currentDescription]);

  const targetLabel = columnName
    ? `${tableName}.${columnName}`
    : tableName;

  async function handleSave() {
    setSaving(true);
    try {
      await setSchemeEnrichment(connectionId, tableName, columnName, description);
      onSaved();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save description",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteSchemeEnrichment(connectionId, tableName, columnName);
      onSaved();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove description",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit description</DialogTitle>
          <DialogDescription>
            Editing description for{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
              {targetLabel}
            </code>
          </DialogDescription>
        </DialogHeader>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
          disabled={saving || removing}
          placeholder="Add a description to help the LLM understand this schema element..."
        />
        <DialogFooter>
          {currentDescription && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={saving || removing}
            >
              {removing ? "Removing..." : "Remove"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || removing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || removing}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
