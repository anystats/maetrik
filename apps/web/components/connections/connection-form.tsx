"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  type ConnectionOptions,
  type ConnectionDetailsOptions,
  type DataSourceType,
  type OptionsFieldDefinition,
  ApiError,
} from "@/lib/api";
import { Loader2, CheckCircle, XCircle, Zap } from "lucide-react";

interface ConnectionFormProps {
  mode: "create" | "edit";
  initialData?: Connection & { options?: ConnectionDetailsOptions };
}

const CONNECTION_OPTIONS_FIELDS: Record<string, OptionsFieldDefinition> = {
  maxConnections: {
    label: "Max Concurrent Connections",
    type: "number",
    placeholder: "10",
    default: 10,
  },
  timeoutMs: {
    label: "Response Waiting Timeout (ms)",
    type: "number",
    placeholder: "30000",
    default: 30000,
  },
  maxRetries: {
    label: "Max Retries",
    type: "number",
    placeholder: "0",
    default: 0,
    helpText: "Number of times to retry failed connections",
  },
  retryDelayMs: {
    label: "Retry Delay (ms)",
    type: "number",
    placeholder: "1000",
    default: 1000,
    helpText: "Delay between retries in milliseconds",
  },
};

function generateId(): string {
  return `ds-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

function prettifyFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

export function ConnectionForm({ mode, initialData }: ConnectionFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [dataSourceTypes, setDataSourceTypes] = useState<DataSourceType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedType, setSelectedType] = useState<string>(initialData?.type || "");

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [credentials, setCredentials] = useState<Record<string, unknown>>(
    initialData?.options?.credentials || {}
  );
  const [connection, setConnection] = useState<Record<string, unknown>>(
    (initialData?.options?.connection as Record<string, unknown>) || {}
  );

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadTypes() {
      try {
        const types = await listDataSourceTypes();
        setDataSourceTypes(types);
        if (mode === "create" && types.length > 0 && !selectedType) {
          setSelectedType(types[0].type);
        }
      } catch (err) {
        console.error("Failed to load data source types:", err);
        setDataSourceTypes([{ type: "postgres", name: "PostgreSQL" }]);
        if (mode === "create" && !selectedType) {
          setSelectedType("postgres");
        }
      } finally {
        setLoadingTypes(false);
      }
    }
    loadTypes();
  }, [mode]);

  const currentType = dataSourceTypes.find((t) => t.type === selectedType);
  const optionsFields = currentType?.optionsFields || {};

  // Apply defaults when type changes (create mode only)
  useEffect(() => {
    if (mode !== "create" || !currentType?.optionsFields) return;

    const defaults: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(currentType.optionsFields)) {
      if (field.default !== undefined && credentials[key] === undefined) {
        defaults[key] = field.default;
      }
    }
    if (Object.keys(defaults).length > 0) {
      setCredentials((prev) => ({ ...defaults, ...prev }));
    }
  }, [selectedType, currentType]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!selectedType) {
      newErrors.type = "Type is required";
    }

    for (const [key, field] of Object.entries(optionsFields)) {
      if (field.required) {
        const value = credentials[key];
        if (value === undefined || value === null || value === "") {
          newErrors[key] = `${field.label || prettifyFieldName(key)} is required`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCredentialChange = (key: string, value: unknown) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleConnectionChange = (key: string, value: unknown) => {
    setConnection((prev) => {
      if (value === undefined || value === "") {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);

    const connectionId = mode === "create" ? generateId() : initialData?.id || "";

    const input: CreateConnectionInput = {
      id: connectionId,
      type: selectedType,
      options: {
        credentials,
        connection: Object.keys(connection).length > 0
          ? connection as ConnectionOptions
          : undefined,
      },
      name: name || undefined,
      description: description || undefined,
    };

    try {
      if (mode === "create") {
        await createConnection(input);
        toast({
          title: "Connection created",
          description: `Successfully created "${name}"`,
          variant: "success",
        });
      } else {
        await updateConnection(initialData!.id, {
          options: input.options,
          name: input.name,
          description: input.description,
        });
        toast({
          title: "Connection updated",
          description: `Successfully updated "${name}"`,
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
      const result = await testConnection(initialData!.id);
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

  const renderField = (
    key: string,
    field: OptionsFieldDefinition,
    value: unknown,
    onChange: (key: string, value: unknown) => void
  ) => {
    const label = field.label || prettifyFieldName(key);

    if (field.type === "boolean") {
      return (
        <div key={key} className="flex items-center justify-between space-x-2">
          <Label htmlFor={key}>{label}</Label>
          <Switch
            id={key}
            checked={!!value}
            onCheckedChange={(checked) => onChange(key, checked)}
          />
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key}>
          {label}
          {field.required && <span className="text-red-500"> *</span>}
        </Label>
        <Input
          id={key}
          type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
          placeholder={field.placeholder}
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(key, field.type === "number" ? (raw === "" ? undefined : parseInt(raw, 10)) : raw);
          }}
          className={errors[key] ? "border-red-500" : ""}
        />
        {errors[key] && <p className="text-sm text-red-500">{errors[key]}</p>}
        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-3">
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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                  value={selectedType}
                  onValueChange={setSelectedType}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
            <CardDescription>
              {currentType
                ? `Configuration for ${currentType.name}`
                : "Select a data source type"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(optionsFields).length > 0 ? (
              <>
                {Object.entries(optionsFields)
                  .filter(([, field]) =>
                    !field.visibleWhen || field.visibleWhen.every((dep) => !!credentials[dep])
                  )
                  .map(([key, field]) =>
                    renderField(key, field, credentials[key], handleCredentialChange)
                  )}
              </>
            ) : (
              !loadingTypes && (
                <p className="text-sm text-muted-foreground">
                  No configuration fields available for this type.
                </p>
              )
            )}

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

        {/* Connection Pool */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Policy</CardTitle>
            <CardDescription>Pool and retry settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(CONNECTION_OPTIONS_FIELDS).map(([key, field]) =>
              renderField(key, field, connection[key], handleConnectionChange)
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
