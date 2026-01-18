"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ConnectionForm } from "@/components/connections/connection-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getConnection, type Connection } from "@/lib/api";

export default function EditConnectionPage() {
  const params = useParams();
  const id = params.id as string;

  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConnection() {
      try {
        const data = await getConnection(id);
        setConnection(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load connection");
      } finally {
        setLoading(false);
      }
    }

    fetchConnection();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="mb-2 h-8 w-32" />
          <Skeleton className="mb-1 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/connections">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Connections
            </Link>
          </Button>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
          <h2 className="text-lg font-medium text-red-800 dark:text-red-200">Connection not found</h2>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error || `Could not find connection "${id}"`}</p>
          <Button asChild className="mt-4">
            <Link href="/connections">Back to Connections</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Connections
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">Edit Connection</h1>
        <p className="text-sm text-muted-foreground">
          Modify <span className="font-medium">{connection.name || id}</span>
        </p>
      </div>

      <ConnectionForm mode="edit" initialData={connection} />
    </div>
  );
}
