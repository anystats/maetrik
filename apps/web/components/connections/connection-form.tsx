"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  createConnection,
  updateConnection,
  testConnection,
  listDataSourceTypes,
  type Connection,
  type CreateConnectionInput,
  type DataSourceType,
  ApiError,
} from "@/lib/api";
import { Loader2, CheckCircle, XCircle, Zap } from "lucide-react";

interface ConnectionFormProps {
  mode: "create" | "edit";
  initialData?: Connection & { credentials?: Record<string, unknown> };
}

function generateId(): string {
  return `ds-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

export function ConnectionForm({ mode, initialData }: ConnectionFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [dataSourceTypes, setDataSourceTypes] = useState<DataSourceType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const [formData, setFormData] = useState({
    id: initialData?.id || "",
    type: initialData?.type || "",
    name: initialData?.name || "",
    description: initialData?.description || "",
    host: (initialData?.credentials?.host as string) || "localhost",
    port: (initialData?.credentials?.port as number) || 5432,
    database: (initialData?.credentials?.database as string) || "",
    user: (initialData?.credentials?.user as string) || "",
    password: (initialData?.credentials?.password as string) || "",
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadTypes() {
      try {
        const types = await listDataSourceTypes();
        setDataSourceTypes(types);
        // Set default type if creating and types loaded
        if (mode === "create" && types.length > 0 && !formData.type) {
          setFormData((prev) => ({ ...prev, type: types[0].type }));
        }
      } catch (err) {
        console.error("Failed to load data source types:", err);
        // Fallback to default types
        setDataSourceTypes([{ type: "postgres", name: "PostgreSQL" }]);
        if (mode === "create" && !formData.type) {
          setFormData((prev) => ({ ...prev, type: "postgres" }));
        }
      } finally {
        setLoadingTypes(false);
      }
    }
    loadTypes();
  }, [mode]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.type) {
      newErrors.type = "Type is required";
    }

    if (!formData.host.trim()) {
      newErrors.host = "Host is required";
    }

    if (!formData.database.trim()) {
      newErrors.database = "Database name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);

    // Generate ID for new connections
    const connectionId = mode === "create" ? generateId() : formData.id;

    const input: CreateConnectionInput = {
      id: connectionId,
      type: formData.type,
      credentials: {
        host: formData.host,
        port: formData.port,
        database: formData.database,
        user: formData.user,
        password: formData.password,
      },
      name: formData.name || undefined,
      description: formData.description || undefined,
    };

    try {
      if (mode === "create") {
        await createConnection(input);
        toast({
          title: "Connection created",
          description: `Successfully created "${formData.name}"`,
          variant: "success",
        });
      } else {
        await updateConnection(formData.id, {
          credentials: input.credentials,
          name: input.name,
          description: input.description,
        });
        toast({
          title: "Connection updated",
          description: `Successfully updated "${formData.name}"`,
          variant: "success",
        });
      }
      router.push("/connections");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "An error occurred";
      toast({
        title: mode === "create" ? "Failed to create" : "Failed to update",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (mode === "create") {
      toast({
        title: "Save first",
        description: "Create the connection before testing",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(formData.id);
      setTestResult(result.healthy ? "success" : "error");
      toast({
        title: result.healthy ? "Connection successful" : "Connection failed",
        description: result.healthy
          ? "Successfully connected to the database"
          : "Could not connect to the data source",
        variant: result.healthy ? "success" : "destructive",
      });
    } catch (err) {
      setTestResult("error");
      toast({
        title: "Test failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Connection identifier and display settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Production Database"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this connection
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">
                Data Source Type <span className="text-red-500">*</span>
              </Label>
              {loadingTypes ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  disabled={mode === "edit"}
                >
                  <SelectTrigger className={errors.type ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSourceTypes.map((ds) => (
                      <SelectItem key={ds.type} value={ds.type}>
                        {ds.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Main production database for user data"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
            <CardDescription>Connection credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="host">
                  Host <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="host"
                  placeholder="localhost"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className={errors.host ? "border-red-500" : ""}
                />
                {errors.host && <p className="text-sm text-red-500">{errors.host}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="5432"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="database">
                Database <span className="text-red-500">*</span>
              </Label>
              <Input
                id="database"
                placeholder="myapp"
                value={formData.database}
                onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                className={errors.database ? "border-red-500" : ""}
              />
              {errors.database && <p className="text-sm text-red-500">{errors.database}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="user">Username</Label>
              <Input
                id="user"
                placeholder="postgres"
                value={formData.user}
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {mode === "edit" && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="w-full"
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : testResult === "success" ? (
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  ) : testResult === "error" ? (
                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/connections")}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Create Connection" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
