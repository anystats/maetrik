"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import {
  ChevronDown,
  Copy,
  Download,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { useState } from "react";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="p-6 border rounded-lg bg-card">{children}</div>
    </div>
  );
}

export default function DesignKitPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [switchValue, setSwitchValue] = useState(false);

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Design UI Kit</h1>
        <p className="text-muted-foreground">
          Component showcase and design system reference for the Maetrik application.
        </p>
      </div>

      {/* Theme Switcher */}
      <Section
        title="Theme Switcher"
        description="Switch between light, dark, and system themes"
      >
        <div className="flex flex-wrap gap-4">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            onClick={() => setTheme("light")}
            className="gap-2"
          >
            <Sun className="h-4 w-4" />
            Light
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            onClick={() => setTheme("dark")}
            className="gap-2"
          >
            <Moon className="h-4 w-4" />
            Dark
          </Button>
          <Button
            variant={theme === "system" ? "default" : "outline"}
            onClick={() => setTheme("system")}
            className="gap-2"
          >
            <Monitor className="h-4 w-4" />
            System
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Current theme: <span className="font-medium">{theme}</span> (resolved:{" "}
          <span className="font-medium">{resolvedTheme}</span>)
        </p>
      </Section>

      {/* Color Palette */}
      <Section
        title="Color Palette"
        description="Brand and semantic colors used throughout the app"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Brand Gradient</h3>
            <div className="flex gap-4">
              <div className="space-y-2">
                <div className="h-16 w-32 rounded-lg bg-gradient-accent" />
                <p className="text-xs text-muted-foreground">Primary Gradient</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 w-32 rounded-lg bg-[#f97316]" />
                <p className="text-xs text-muted-foreground">Orange #f97316</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 w-32 rounded-lg bg-[#eab308]" />
                <p className="text-xs text-muted-foreground">Yellow #eab308</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Semantic Colors</h3>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <div className="h-12 w-24 rounded-lg bg-background border" />
                <p className="text-xs text-muted-foreground">Background</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-24 rounded-lg bg-foreground" />
                <p className="text-xs text-muted-foreground">Foreground</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-24 rounded-lg bg-card border" />
                <p className="text-xs text-muted-foreground">Card</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-24 rounded-lg bg-muted" />
                <p className="text-xs text-muted-foreground">Muted</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-24 rounded-lg bg-destructive" />
                <p className="text-xs text-muted-foreground">Destructive</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography" description="Text styles and hierarchy">
        <div className="space-y-4">
          <div>
            <span className="text-xs text-muted-foreground">H1</span>
            <h1 className="text-4xl font-bold">The quick brown fox</h1>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">H2</span>
            <h2 className="text-3xl font-semibold">The quick brown fox</h2>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">H3</span>
            <h3 className="text-2xl font-semibold">The quick brown fox</h3>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">H4</span>
            <h4 className="text-xl font-semibold">The quick brown fox</h4>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Body</span>
            <p className="text-base">
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Small</span>
            <p className="text-sm text-muted-foreground">
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Gradient Text</span>
            <p className="text-2xl font-bold text-gradient-accent">
              The quick brown fox
            </p>
          </div>
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons" description="Button variants and sizes">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Variants</h3>
            <div className="flex flex-wrap gap-4">
              <Button>Primary (Gradient)</Button>
              <Button variant="default-neutral">Primary (Neutral)</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">Sizes</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">With Icons</h3>
            <div className="flex flex-wrap gap-4">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add New
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button variant="secondary" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button variant="destructive" className="gap-2">
                <Trash className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">States</h3>
            <div className="flex flex-wrap gap-4">
              <Button disabled>Disabled</Button>
              <Button variant="outline" disabled>
                Disabled Outline
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Form Controls */}
      <Section title="Form Controls" description="Inputs, selects, and switches">
        <div className="space-y-6 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="input-default">Default Input</Label>
            <Input id="input-default" placeholder="Enter text..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="input-disabled">Disabled Input</Label>
            <Input id="input-disabled" placeholder="Disabled" disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="input-search">With Icon</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="input-search" className="pl-10" placeholder="Search..." />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="select-default">Select</Label>
            <Select>
              <SelectTrigger id="select-default">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
                <SelectItem value="option2">Option 2</SelectItem>
                <SelectItem value="option3">Option 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="switch-demo">Enable feature</Label>
              <p className="text-sm text-muted-foreground">
                Toggle this setting on or off
              </p>
            </div>
            <Switch
              id="switch-demo"
              checked={switchValue}
              onCheckedChange={setSwitchValue}
            />
          </div>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges" description="Status indicators and labels">
        <div className="flex flex-wrap gap-4">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
        </div>
      </Section>

      {/* Cards */}
      <Section title="Cards" description="Content containers">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>
                This is a description of the card content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Card content goes here. You can add any elements inside.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Action</Button>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle>Highlighted Card</CardTitle>
              <CardDescription>With accent border</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use accent colors for important information.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Table */}
      <Section title="Table" description="Data display with rows and columns">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Production DB</TableCell>
              <TableCell>PostgreSQL</TableCell>
              <TableCell>
                <Badge variant="success">Connected</Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Analytics DB</TableCell>
              <TableCell>MySQL</TableCell>
              <TableCell>
                <Badge variant="warning">Connecting</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Test DB</TableCell>
              <TableCell>SQLite</TableCell>
              <TableCell>
                <Badge variant="destructive">Disconnected</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      {/* Dialogs */}
      <Section title="Dialogs & Modals" description="Overlay content and confirmations">
        <div className="flex flex-wrap gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog Title</DialogTitle>
                <DialogDescription>
                  This is a dialog description. You can put any content here.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  Dialog content goes here. Forms, information, or any other content.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Continue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Item</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  item from the system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>

      {/* Dropdown Menu */}
      <Section title="Dropdown Menu" description="Contextual actions menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              Open Menu
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      {/* Skeleton */}
      <Section title="Skeleton" description="Loading placeholders">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[150px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
              <Skeleton className="h-4 w-[300px]" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
