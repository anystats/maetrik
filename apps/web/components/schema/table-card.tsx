"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SchemeTable } from "@/lib/api";

interface TableCardProps {
  table: SchemeTable;
  onDescriptionEdit: (tableName: string, columnName: string | null) => void;
}

export function TableCard({ table, onDescriptionEdit }: TableCardProps) {
  const hasFooter =
    (table.indexes && table.indexes.length > 0) ||
    (table.foreignKeys && table.foreignKeys.length > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="font-mono font-medium">{table.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDescriptionEdit(table.name, null)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        {table.description ? (
          <p className="text-sm text-muted-foreground">{table.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No description</p>
        )}
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Nullable</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.columns.map((column) => (
              <TableRow key={column.name}>
                <TableCell className="font-mono">{column.name}</TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {column.type}
                </TableCell>
                <TableCell>
                  {column.nullable ? (
                    <Badge variant="outline">NULL</Badge>
                  ) : (
                    <Badge variant="secondary">NOT NULL</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {column.description ? (
                      <span className="text-sm">{column.description}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">&mdash;</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => onDescriptionEdit(table.name, column.name)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {hasFooter && (
        <CardFooter>
          <div className="space-y-1 text-xs text-muted-foreground">
            {table.indexes?.map((index) => {
              const cols = index.columns.join(", ");
              let prefix = "IDX";
              if (index.primaryKey) prefix = "PK";
              else if (index.unique) prefix = "UNIQUE";
              return (
                <div key={index.name}>
                  {prefix}: {cols}
                </div>
              );
            })}
            {table.foreignKeys?.map((fk) => (
              <div key={`${fk.column}-${fk.referencesTable}-${fk.referencesColumn}`}>
                FK: {fk.column} &rarr; {fk.referencesTable}.{fk.referencesColumn}
              </div>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
