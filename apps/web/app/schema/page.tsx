"use client";

import { useEffect, useState, useCallback } from "react";
import { TableProperties, RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TableCard } from "@/components/schema/table-card";
import {
  listConnections,
  getConnectionScheme,
  syncConnectionScheme,
  ApiError,
  type Connection,
  type EnrichedSchema,
} from "@/lib/api";

export default function SchemaPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheme, setScheme] = useState<EnrichedSchema | null>(null);
  const [loadingScheme, setLoadingScheme] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    tableName: string;
    columnName: string | null;
    currentDescription: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchConnections() {
      try {
        const data = await listConnections();
        setConnections(data);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load connections",
          variant: "destructive",
        });
      } finally {
        setLoadingConnections(false);
      }
    }
    fetchConnections();
  }, [toast]);

  const loadScheme = useCallback(
    async (id: string) => {
      setLoadingScheme(true);
      setScheme(null);
      try {
        const data = await getConnectionScheme(id);
        setScheme(data);
      } catch (err) {
        if (err instanceof ApiError && err.code === "SCHEME_NOT_FOUND") {
          setScheme(null);
        } else {
          toast({
            title: "Error",
            description: "Failed to load schema",
            variant: "destructive",
          });
        }
      } finally {
        setLoadingScheme(false);
      }
    },
    [toast]
  );

  const handleSelectConnection = useCallback(
    (id: string) => {
      setSelectedId(id);
      loadScheme(id);
    },
    [loadScheme]
  );

  const handleSync = useCallback(async () => {
    if (!selectedId) return;
    setSyncing(true);
    try {
      await syncConnectionScheme(selectedId);
      await loadScheme(selectedId);
      toast({
        title: "Schema synced",
        description: "Schema has been re-introspected successfully",
        variant: "success",
      });
    } catch {
      toast({
        title: "Sync failed",
        description: "Failed to sync schema",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [selectedId, loadScheme, toast]);

  const handleDescriptionEdit = useCallback(
    (tableName: string, columnName: string | null) => {
      // Find current description for the edit target
      const table = scheme?.tables.find((t) => t.name === tableName);
      let currentDescription = "";
      if (columnName && table) {
        const col = table.columns.find((c) => c.name === columnName);
        currentDescription = col?.description ?? "";
      } else if (table) {
        currentDescription = table.description ?? "";
      }
      setEditTarget({ tableName, columnName, currentDescription });
    },
    [scheme]
  );

  const selectedConnection = connections.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left panel */}
      <div className="w-72 border-r border-border overflow-y-auto">
        <div className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Connections
          </p>
          <div className="space-y-1">
            {loadingConnections ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              connections.map((conn) => (
                <button
                  key={conn.id}
                  className={`w-full text-left rounded-md px-3 py-2 transition-colors hover:bg-accent ${
                    selectedId === conn.id ? "bg-accent" : ""
                  }`}
                  onClick={() => handleSelectConnection(conn.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">
                      {conn.name || conn.id}
                    </span>
                    <Badge variant="secondary" className="ml-2 text-[10px] shrink-0">
                      {conn.type}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <TableProperties className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-medium text-foreground">
                Select a connection
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a connection to view its schema
              </p>
            </div>
          </div>
        ) : loadingScheme ? (
          <div className="p-6 space-y-4">
            <Card>
              <div className="p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </Card>
          </div>
        ) : !scheme ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <RefreshCw className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-medium text-foreground">
                No schema synced
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sync to introspect this connection&apos;s schema
              </p>
              <Button onClick={handleSync} className="mt-4" size="sm">
                Sync Schema
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                {selectedConnection?.name || selectedId}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  v{scheme.version}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshCw
                    className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing..." : "Sync Schema"}
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              {scheme.tables.map((table) => (
                <TableCard
                  key={table.name}
                  table={table}
                  onDescriptionEdit={handleDescriptionEdit}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
