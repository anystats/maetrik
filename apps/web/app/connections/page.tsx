"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Pencil, Trash2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { listConnections, deleteConnection, type Connection } from "@/lib/api";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listConnections();
      setConnections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    // Optimistic update
    const previousConnections = connections;
    setConnections((prev) => prev.filter((c) => c.id !== deleteId));
    setDeleting(true);

    try {
      await deleteConnection(deleteId);
      toast({
        title: "Connection deleted",
        description: `Successfully deleted "${deleteName || deleteId}"`,
        variant: "success",
      });
    } catch (err) {
      // Rollback on error
      setConnections(previousConnections);
      toast({
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteId(null);
      setDeleteName(null);
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type.toLowerCase()) {
      case "postgres":
        return "default";
      case "mysql":
        return "secondary";
      default:
        return "outline";
    }
  };

  const openDeleteDialog = (connection: Connection) => {
    setDeleteId(connection.id);
    setDeleteName(connection.name || connection.id);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Connections</h1>
          <p className="text-sm text-muted-foreground">Manage your data source connections</p>
        </div>
        <Button asChild size="sm">
          <Link href="/connections/new">
            <Plus className="mr-2 h-4 w-4" />
            New Connection
          </Link>
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchConnections}>
            Try again
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : connections.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={4} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Database className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground">No connections</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Get started by adding a new connection.
                    </p>
                    <Button asChild size="sm" className="mt-4">
                      <Link href="/connections/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Connection
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Connection rows
              connections.map((connection) => (
                <TableRow key={connection.id}>
                  <TableCell>
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {connection.name || connection.id}
                      </p>
                      {connection.description && (
                        <p className="text-sm text-muted-foreground">{connection.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getTypeBadgeVariant(connection.type)}>
                      {connection.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/connections/${connection.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => openDeleteDialog(connection)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteName(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
