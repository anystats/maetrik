import { ConnectionForm } from "@/components/connections/connection-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewConnectionPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/connections">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Connections
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">New Connection</h1>
        <p className="text-sm text-muted-foreground">Add a new data source connection</p>
      </div>

      <ConnectionForm mode="create" />
    </div>
  );
}
