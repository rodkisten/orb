"use client";

import * as React from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Command,
  Copy,
  FileText,
  Heart,
  LayoutGrid,
  LifeBuoy,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Accordion as RadixAccordion,
  Checkbox as RadixCheckbox,
  Dialog as RadixDialog,
  Select as RadixSelect,
  Switch as RadixSwitch,
  Tabs as RadixTabs,
  Tooltip as RadixTooltip,
} from "radix-ui";

const radixPrimitives = [
  "Accordion",
  "Alert Dialog",
  "Aspect Ratio",
  "Avatar",
  "Checkbox",
  "Collapsible",
  "Context Menu",
  "Dialog",
  "Direction",
  "Dropdown Menu",
  "Form",
  "Hover Card",
  "Label",
  "Menubar",
  "Navigation Menu",
  "Popover",
  "Portal",
  "Progress",
  "Radio Group",
  "Scroll Area",
  "Select",
  "Separator",
  "Slider",
  "Slot",
  "Switch",
  "Tabs",
  "Toast",
  "Toggle",
  "Toggle Group",
  "Toolbar",
  "Tooltip",
];

const components = [
  "Accordion",
  "Alert",
  "Alert Dialog",
  "Aspect Ratio",
  "Attachment",
  "Avatar",
  "Badge",
  "Breadcrumb",
  "Bubble",
  "Button",
  "Button Group",
  "Calendar",
  "Card",
  "Carousel",
  "Chart",
  "Checkbox",
  "Code Block",
  "Collapsible",
  "Combobox",
  "Command",
  "Context Menu",
  "Dialog",
  "Direction",
  "Drawer",
  "Dropdown Menu",
  "Empty",
  "Field",
  "Hover Card",
  "Input",
  "Input Group",
  "Input OTP",
  "Item",
  "Kbd",
  "Label",
  "Marker",
  "Menubar",
  "Message",
  "Message Scroller",
  "Native Select",
  "Navigation Menu",
  "Pagination",
  "Popover",
  "Progress",
  "Questionnaire",
  "Radio Group",
  "Resizable",
  "Scroll Area",
  "Select",
  "Separator",
  "Sheet",
  "Sidebar",
  "Skeleton",
  "Slider",
  "Sonner",
  "Spinner",
  "Switch",
  "Table",
  "Tabs",
  "Textarea",
  "Toast",
  "Toggle",
  "Toggle Group",
  "Tooltip",
  "Trace",
];

const sections = [
  {
    id: "fundamentos",
    title: "Fundamentos",
    description: "Ações, estados, feedback e navegação básica.",
    items: [
      "Button",
      "Button Group",
      "Badge",
      "Toggle",
      "Toggle Group",
      "Kbd",
      "Tooltip",
      "Alert",
      "Progress",
      "Spinner",
      "Skeleton",
      "Sonner",
      "Toast",
      "Separator",
    ],
  },
  {
    id: "formularios",
    title: "Formulários",
    description: "Controles acessíveis para entrada e seleção de dados.",
    items: [
      "Field",
      "Label",
      "Input",
      "Input Group",
      "Textarea",
      "Checkbox",
      "Radio Group",
      "Switch",
      "Slider",
      "Select",
      "Native Select",
      "Combobox",
      "Input OTP",
      "Calendar",
    ],
  },
  {
    id: "navegacao",
    title: "Navegação e layout",
    description: "Estruturas para organizar conteúdo e orientar o usuário.",
    items: [
      "Breadcrumb",
      "Tabs",
      "Accordion",
      "Collapsible",
      "Pagination",
      "Scroll Area",
      "Aspect Ratio",
      "Resizable",
      "Sidebar",
      "Navigation Menu",
      "Menubar",
    ],
  },
  {
    id: "sobreposicoes",
    title: "Sobreposições e menus",
    description: "Diálogos, painéis, menus de ação e superfícies contextuais.",
    items: [
      "Dialog",
      "Alert Dialog",
      "Sheet",
      "Drawer",
      "Dropdown Menu",
      "Context Menu",
      "Popover",
      "Hover Card",
      "Command",
    ],
  },
  {
    id: "dados",
    title: "Dados e conteúdo",
    description: "Componentes para apresentar informação, atividade e mídia.",
    items: [
      "Card",
      "Table",
      "Chart",
      "Avatar",
      "Item",
      "Empty",
      "Carousel",
      "Code Block",
    ],
  },
  {
    id: "conversa",
    title: "Conversas e feedback",
    description: "Primitivos para mensagens, tarefas e atividade do sistema.",
    items: [
      "Message Scroller",
      "Message",
      "Bubble",
      "Attachment",
      "Marker",
      "Questionnaire",
      "Trace",
      "Direction",
    ],
  },
  {
    id: "radix",
    title: "Radix UI",
    description:
      "Primitivas acessíveis e sem estilo, personalizadas aqui com as mesmas classes e tokens do projeto.",
    items: radixPrimitives,
  },
];

function SectionHeading({
  title,
  description,
  id,
}: {
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 border-b pb-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Specimen({
  name,
  children,
  className = "",
}: {
  name: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`min-w-0 shadow-none ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-20 flex-wrap items-center gap-3">
        {children}
      </CardContent>
    </Card>
  );
}

function FoundationExamples() {
  const [progress, setProgress] = React.useState(64);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Specimen name="Button">
        <Button>
          Continuar <ArrowRight data-icon="inline-end" />
        </Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="outline">Contorno</Button>
        <Button variant="ghost" size="icon" aria-label="Mais opções">
          <MoreHorizontal />
        </Button>
      </Specimen>
      <Specimen name="Button Group">
        <ButtonGroup>
          <Button variant="outline">Salvar</Button>
          <Button variant="outline" size="icon" aria-label="Mais opções">
            <ChevronDown />
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="secondary">
            <Plus data-icon="inline-start" /> Criar
          </Button>
          <Button variant="secondary">Duplicar</Button>
        </ButtonGroup>
      </Specimen>
      <Specimen name="Badge">
        <Badge>Publicado</Badge>
        <Badge variant="secondary">Rascunho</Badge>
        <Badge variant="outline">Beta</Badge>
        <Badge variant="destructive">Falhou</Badge>
      </Specimen>
      <Specimen name="Toggle">
        <Toggle aria-label="Favoritar">
          <Heart />
        </Toggle>
        <Toggle aria-label="Ativar favorito" defaultPressed>
          <Heart /> Favorito
        </Toggle>
      </Specimen>
      <Specimen name="Toggle Group">
        <ToggleGroup defaultValue={["grid"]} aria-label="Modo de visualização">
          <ToggleGroupItem value="grid" aria-label="Grade">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Lista">
            <Menu />
          </ToggleGroupItem>
        </ToggleGroup>
      </Specimen>
      <Specimen name="Kbd">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <span className="text-sm text-muted-foreground">Abrir busca</span>
      </Specimen>
      <Specimen name="Tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="outline">Passe o cursor</Button>}
            />
            <TooltipContent>Atalho: ⌘ + K</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Specimen>
      <Specimen name="Alert">
        <Alert>
          <ShieldCheck />
          <AlertTitle>Tudo certo</AlertTitle>
          <AlertDescription>Suas alterações foram salvas.</AlertDescription>
        </Alert>
      </Specimen>
      <Specimen name="Progress" className="md:col-span-2">
        <div className="flex w-full items-center gap-4">
          <Progress
            value={progress}
            className="flex-1"
            aria-label="Progresso da tarefa"
          />
          <span className="w-10 text-right text-sm tabular-nums">
            {progress}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProgress((progress + 10) % 110)}
          >
            Avançar
          </Button>
        </div>
      </Specimen>
      <Specimen name="Spinner">
        <div
          className="size-4 animate-spin rounded-full border-2 border-primary border-r-transparent"
          role="status"
          aria-label="Carregando"
        />
        <span className="text-sm text-muted-foreground">Carregando dados…</span>
      </Specimen>
      <Specimen name="Skeleton">
        <div className="flex w-full items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </Specimen>
      <Specimen name="Sonner / Toast">
        <Button
          variant="outline"
          onClick={() => toast.success("Alterações salvas com sucesso")}
        >
          Mostrar notificação
        </Button>
      </Specimen>
      <Specimen name="Separator">
        <div className="flex h-8 items-center gap-4 text-sm">
          <span>Visão geral</span>
          <Separator orientation="vertical" />
          <span className="text-muted-foreground">Atividade</span>
        </div>
      </Specimen>
    </div>
  );
}

function FormExamples() {
  const [slider, setSlider] = React.useState<number[]>([35]);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Specimen name="Field + Input">
        <FieldGroup className="w-full">
          <Field>
            <FieldLabel htmlFor="name">Nome completo</FieldLabel>
            <Input id="name" placeholder="Ada Lovelace" />
            <FieldDescription>Como devemos chamar você?</FieldDescription>
          </Field>
        </FieldGroup>
      </Specimen>
      <Specimen name="Input Group">
        <InputGroup className="w-full">
          <InputGroupInput placeholder="Buscar componentes…" />
          <InputGroupAddon>
            <InputGroupText>
              <Search />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <Kbd>⌘ K</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </Specimen>
      <Specimen name="Textarea">
        <Textarea
          className="min-h-20"
          placeholder="Escreva uma mensagem…"
          aria-label="Mensagem"
        />
      </Specimen>
      <Specimen name="Checkbox">
        <Field className="flex-row items-center">
          <Checkbox id="terms" defaultChecked />
          <FieldLabel htmlFor="terms">Aceito os termos de uso</FieldLabel>
        </Field>
      </Specimen>
      <Specimen name="Radio Group">
        <RadioGroup defaultValue="pro">
          <Field className="flex-row items-center">
            <RadioGroupItem value="free" id="free" />
            <FieldLabel htmlFor="free">Grátis</FieldLabel>
          </Field>
          <Field className="flex-row items-center">
            <RadioGroupItem value="pro" id="pro" />
            <FieldLabel htmlFor="pro">Pro</FieldLabel>
          </Field>
        </RadioGroup>
      </Specimen>
      <Specimen name="Switch">
        <div className="flex items-center gap-3">
          <Switch id="notifications" defaultChecked />
          <Label htmlFor="notifications">Notificações por e-mail</Label>
        </div>
      </Specimen>
      <Specimen name="Slider">
        <div className="flex w-full items-center gap-4">
          <Slider
            value={slider}
            onValueChange={(v) =>
              setSlider(typeof v === "number" ? [v] : [...v])
            }
            max={100}
            step={1}
            aria-label="Intensidade"
          />
          <span className="w-8 text-right text-sm tabular-nums">
            {slider[0]}
          </span>
        </div>
      </Specimen>
      <Specimen name="Select">
        <Select defaultValue="design">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Escolha uma equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Equipes</SelectLabel>
              <SelectItem value="design">Design</SelectItem>
              <SelectItem value="engineering">Engenharia</SelectItem>
              <SelectItem value="product">Produto</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Specimen>
      <Specimen name="Native Select">
        <select
          aria-label="Prioridade"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option>Normal</option>
          <option>Alta</option>
          <option>Urgente</option>
        </select>
      </Specimen>
      <Specimen name="Combobox">
        <Select defaultValue="react">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Framework" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="next">Next.js</SelectItem>
              <SelectItem value="vue">Vue</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Specimen>
      <Specimen name="Input OTP">
        <InputOTP maxLength={4} aria-label="Código de confirmação">
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
      </Specimen>
      <Specimen name="FieldSet">
        <FieldSet className="w-full">
          <FieldLegend>Preferências</FieldLegend>
          <FieldDescription>
            Escolha como receber atualizações.
          </FieldDescription>
          <Field className="flex-row items-center">
            <Checkbox id="weekly" />
            <FieldLabel htmlFor="weekly">Resumo semanal</FieldLabel>
          </Field>
        </FieldSet>
      </Specimen>
    </div>
  );
}

function NavigationExamples() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Specimen name="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#fundamentos">Início</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#navegacao">Biblioteca</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Componentes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Specimen>
      <Specimen name="Tabs">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="activity">Atividade</TabsTrigger>
          </TabsList>
          <TabsContent
            value="overview"
            className="pt-3 text-sm text-muted-foreground"
          >
            Resumo do projeto e atualizações recentes.
          </TabsContent>
          <TabsContent
            value="activity"
            className="pt-3 text-sm text-muted-foreground"
          >
            Você está em dia com as novidades.
          </TabsContent>
        </Tabs>
      </Specimen>
      <Specimen name="Accordion">
        <Accordion defaultValue={[]} className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Como os exemplos funcionam?</AccordionTrigger>
            <AccordionContent>
              Os controles são componentes reais e alguns têm estado interativo.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Specimen>
      <Specimen name="Collapsible">
        <Collapsible className="w-full">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
            Detalhes do projeto <ChevronDown className="size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 text-sm text-muted-foreground">
            Última atualização há 2 minutos.
          </CollapsibleContent>
        </Collapsible>
      </Specimen>
      <Specimen name="Pagination">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#navegacao" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#navegacao" isActive>
                1
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#navegacao">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#navegacao" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Specimen>
      <Specimen name="Scroll Area">
        <ScrollArea className="h-24 w-full rounded-md border p-3">
          <div className="flex flex-col gap-3 text-sm">
            {components.slice(0, 10).map((item) => (
              <div key={item} className="text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Specimen>
      <Specimen name="Aspect Ratio">
        <div className="w-full max-w-48">
          <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              16:9
            </div>
          </div>
        </div>
      </Specimen>
      <Specimen name="Resizable">
        <div className="flex w-full overflow-hidden rounded-md border text-xs">
          <div className="flex-1 p-3">Painel principal</div>
          <Separator orientation="vertical" />
          <div className="w-1/3 bg-muted/50 p-3">Painel lateral</div>
        </div>
      </Specimen>
      <Specimen name="Sidebar">
        <div className="flex w-full items-center gap-3 rounded-md border p-3">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <LayoutGrid className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Workspace</p>
            <p className="text-xs text-muted-foreground">
              Navegação e contexto
            </p>
          </div>
          <ChevronRight className="ml-auto size-4 text-muted-foreground" />
        </div>
      </Specimen>
      <Specimen name="Navigation Menu">
        <nav
          aria-label="Navegação de exemplo"
          className="flex flex-wrap items-center gap-4 text-sm"
        >
          <a href="#formularios" className="font-medium">
            Produto
          </a>
          <a
            href="#dados"
            className="text-muted-foreground hover:text-foreground"
          >
            Recursos
          </a>
          <a
            href="#fundamentos"
            className="text-muted-foreground hover:text-foreground"
          >
            Preços
          </a>
        </nav>
      </Specimen>
      <Specimen name="Menubar">
        <div className="flex items-center gap-4 rounded-md border px-4 py-2 text-sm">
          <span>Arquivo</span>
          <span>Editar</span>
          <span>Exibir</span>
          <span>Ajuda</span>
          <MoreHorizontal className="ml-auto size-4" />
        </div>
      </Specimen>
    </div>
  );
}

function OverlayExamples() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Specimen name="Dialog">
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline">Abrir diálogo</Button>}
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Compartilhar projeto</DialogTitle>
              <DialogDescription>
                Convide alguém para colaborar com você.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
              <Input id="invite-email" placeholder="nome@exemplo.com" />
            </Field>
            <Button>Enviar convite</Button>
          </DialogContent>
        </Dialog>
      </Specimen>
      <Specimen name="Alert Dialog">
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive">Excluir projeto</Button>}
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente e não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Specimen>
      <Specimen name="Sheet">
        <Sheet>
          <SheetTrigger
            render={<Button variant="outline">Abrir painel</Button>}
          />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Preferências</SheetTitle>
              <SheetDescription>
                Gerencie as configurações da sua conta.
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-center justify-between py-5">
              <Label htmlFor="sheet-notifications">Notificações</Label>
              <Switch id="sheet-notifications" defaultChecked />
            </div>
          </SheetContent>
        </Sheet>
      </Specimen>
      <Specimen name="Drawer">
        <Sheet>
          <SheetTrigger
            render={<Button variant="outline">Abrir drawer</Button>}
          />
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Ações rápidas</SheetTitle>
              <SheetDescription>
                Escolha uma ação para continuar.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap gap-2 py-4">
              <Button variant="outline">Editar</Button>
              <Button variant="outline">Compartilhar</Button>
            </div>
          </SheetContent>
        </Sheet>
      </Specimen>
      <Specimen name="Dropdown Menu">
        <Button variant="outline" onClick={() => toast("Menu de exemplo")}>
          Ações <ChevronDown data-icon="inline-end" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Mais ações">
          <MoreHorizontal />
        </Button>
      </Specimen>
      <Specimen name="Context Menu">
        <Button
          variant="outline"
          onContextMenu={(event) => {
            event.preventDefault();
            toast("Menu contextual: editar · duplicar · excluir");
          }}
        >
          Clique com o botão direito
        </Button>
      </Specimen>
      <Specimen name="Popover">
        <Button
          variant="outline"
          onClick={() => toast("Popover: preferências e filtros")}
        >
          Abrir popover
        </Button>
      </Specimen>
      <Specimen name="Hover Card">
        <Button variant="ghost" className="gap-2">
          <Avatar className="size-6">
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          Ada Lovelace
        </Button>
        <span className="text-xs text-muted-foreground">Prévia do perfil</span>
      </Specimen>
      <Specimen name="Command">
        <Button
          variant="outline"
          onClick={() => toast("Paleta de comandos aberta")}
        >
          <Command data-icon="inline-start" />
          Abrir comandos<Kbd>⌘ K</Kbd>
        </Button>
      </Specimen>
    </div>
  );
}

function DataExamples() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Specimen name="Card">
        <Card className="w-full shadow-none">
          <CardHeader>
            <CardTitle>Plano Pro</CardTitle>
            <CardDescription>Para equipes em crescimento.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              $24{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / mês
              </span>
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Escolher plano</Button>
          </CardFooter>
        </Card>
      </Specimen>
      <Specimen name="Table" className="md:col-span-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Função</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Ada Lovelace</TableCell>
              <TableCell>Admin</TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary">Ativa</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Grace Hopper</TableCell>
              <TableCell>Designer</TableCell>
              <TableCell className="text-right">
                <Badge variant="outline">Convite enviado</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Specimen>
      <Specimen name="Chart">
        <div className="flex h-28 w-full items-end gap-2">
          {[42, 68, 51, 82, 58, 94, 72, 100, 63, 85, 56, 76].map(
            (height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-sm bg-primary/80"
                style={{ height: `${height}%` }}
                aria-label={`Barra ${index + 1}: ${height}%`}
              />
            ),
          )}
        </div>
      </Specimen>
      <Specimen name="Avatar">
        <Avatar>
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>GH</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>+3</AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground">Equipe de produto</span>
      </Specimen>
      <Specimen name="Item">
        <Item variant="outline" className="w-full">
          <ItemContent>
            <ItemTitle>Verificação em duas etapas</ItemTitle>
            <ItemDescription>
              Proteja sua conta com um código adicional.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="secondary">
              Ativar
            </Button>
          </ItemActions>
        </Item>
      </Specimen>
      <Specimen name="Empty">
        <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-5 text-center">
          <div className="grid size-9 place-items-center rounded-full bg-muted">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nenhum arquivo ainda</p>
          <p className="text-xs text-muted-foreground">
            Adicione arquivos para vê-los aqui.
          </p>
          <Button size="sm" variant="outline">
            <Plus data-icon="inline-start" />
            Adicionar arquivo
          </Button>
        </div>
      </Specimen>
      <Specimen name="Carousel">
        <div className="flex w-full items-center gap-3">
          <Button variant="outline" size="icon" aria-label="Anterior">
            <ArrowDown className="rotate-90" />
          </Button>
          <div className="flex flex-1 items-center justify-center rounded-md bg-muted p-5 text-sm">
            Slide 1 de 3
          </div>
          <Button variant="outline" size="icon" aria-label="Próximo">
            <ArrowRight />
          </Button>
        </div>
      </Specimen>
      <Specimen name="Code Block">
        <pre className="w-full overflow-x-auto rounded-md bg-muted p-3 text-xs">
          <code>{'const design = "shadcn/ui"'}</code>
        </pre>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toast.success("Código copiado")}
        >
          <Copy data-icon="inline-start" />
          Copiar
        </Button>
      </Specimen>
    </div>
  );
}

function ConversationExamples() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Specimen name="Message Scroller">
        <div className="flex w-full flex-col gap-3 rounded-md border p-3">
          <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
            Olá! Como posso ajudar?
          </div>
          <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
            Quero explorar os componentes.
          </div>
        </div>
      </Specimen>
      <Specimen name="Message + Bubble">
        <div className="flex w-full items-start gap-2">
          <Avatar className="size-8">
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            Posso mostrar exemplos para cada componente.
          </div>
        </div>
      </Specimen>
      <Specimen name="Attachment">
        <Button variant="outline" size="sm">
          <FileText data-icon="inline-start" />
          design-system.pdf<Badge variant="secondary">2.4 MB</Badge>
        </Button>
      </Specimen>
      <Specimen name="Marker">
        <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" />
          <span>Hoje · 10:42</span>
          <Separator className="flex-1" />
        </div>
      </Specimen>
      <Specimen name="Questionnaire">
        <FieldSet className="w-full">
          <FieldLegend>Como foi sua experiência?</FieldLegend>
          <RadioGroup defaultValue="great">
            <Field className="flex-row items-center">
              <RadioGroupItem value="great" id="great" />
              <FieldLabel htmlFor="great">Muito boa</FieldLabel>
            </Field>
            <Field className="flex-row items-center">
              <RadioGroupItem value="ok" id="ok" />
              <FieldLabel htmlFor="ok">Pode melhorar</FieldLabel>
            </Field>
          </RadioGroup>
        </FieldSet>
      </Specimen>
      <Specimen name="Trace">
        <div className="flex w-full items-center gap-3 text-sm">
          <Activity className="size-4 text-muted-foreground" />
          <span>Executando tarefa</span>
          <Badge variant="secondary">Concluído</Badge>
          <span className="ml-auto text-xs text-muted-foreground">1.2 s</span>
        </div>
      </Specimen>
      <Specimen name="Direction">
        <div dir="ltr" className="flex items-center gap-2 text-sm">
          <span>Esquerda para direita</span>
          <ArrowRight className="size-4" />
        </div>
      </Specimen>
    </div>
  );
}

function RadixExamples() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Specimen name="Accordion · Radix">
        <RadixAccordion.Root
          type="single"
          collapsible
          defaultValue="details"
          className="w-full"
        >
          <RadixAccordion.Item value="details" className="border-b">
            <RadixAccordion.Header>
              <RadixAccordion.Trigger className="group flex w-full items-center justify-between py-2 text-left text-sm font-medium">
                Como funciona?
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </RadixAccordion.Trigger>
            </RadixAccordion.Header>
            <RadixAccordion.Content className="pb-3 text-sm text-muted-foreground">
              O Radix cuida do comportamento acessível; o projeto define a
              aparência.
            </RadixAccordion.Content>
          </RadixAccordion.Item>
        </RadixAccordion.Root>
      </Specimen>
      <Specimen name="Checkbox · Radix">
        <label className="flex items-center gap-2 text-sm">
          <RadixCheckbox.Root
            id="radix-terms"
            defaultChecked
            className="grid size-4 place-items-center rounded border border-input bg-background text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary"
          >
            <RadixCheckbox.Indicator>
              <Check className="size-3.5" />
            </RadixCheckbox.Indicator>
          </RadixCheckbox.Root>{" "}
          Aceito os termos
        </label>
      </Specimen>
      <Specimen name="Switch · Radix">
        <label className="flex items-center gap-3 text-sm">
          <RadixSwitch.Root
            defaultChecked
            className="relative h-5 w-9 rounded-full bg-muted outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary"
          >
            <RadixSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
          </RadixSwitch.Root>{" "}
          Notificações
        </label>
      </Specimen>
      <Specimen name="Select · Radix">
        <RadixSelect.Root defaultValue="design">
          <RadixSelect.Trigger
            aria-label="Equipe"
            className="flex h-9 min-w-40 items-center justify-between gap-3 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RadixSelect.Value />
            <RadixSelect.Icon>
              <ChevronDown className="size-4" />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>
          <RadixSelect.Portal>
            <RadixSelect.Content
              className="z-50 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              position="popper"
            >
              <RadixSelect.Viewport>
                <RadixSelect.Item
                  value="design"
                  className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                >
                  Design
                </RadixSelect.Item>
                <RadixSelect.Item
                  value="engineering"
                  className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                >
                  Engenharia
                </RadixSelect.Item>
                <RadixSelect.Item
                  value="product"
                  className="cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
                >
                  Produto
                </RadixSelect.Item>
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
      </Specimen>
      <Specimen name="Tabs · Radix">
        <RadixTabs.Root defaultValue="overview" className="w-full">
          <RadixTabs.List
            aria-label="Seções do exemplo"
            className="flex border-b"
          >
            <RadixTabs.Trigger
              value="overview"
              className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Visão geral
            </RadixTabs.Trigger>
            <RadixTabs.Trigger
              value="activity"
              className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Atividade
            </RadixTabs.Trigger>
          </RadixTabs.List>
          <RadixTabs.Content
            value="overview"
            className="pt-3 text-sm text-muted-foreground"
          >
            Conteúdo da visão geral.
          </RadixTabs.Content>
          <RadixTabs.Content
            value="activity"
            className="pt-3 text-sm text-muted-foreground"
          >
            Conteúdo de atividade.
          </RadixTabs.Content>
        </RadixTabs.Root>
      </Specimen>
      <Specimen name="Dialog · Radix">
        <RadixDialog.Root>
          <RadixDialog.Trigger asChild>
            <Button variant="outline">Abrir diálogo</Button>
          </RadixDialog.Trigger>
          <RadixDialog.Portal>
            <RadixDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out" />
            <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
              <RadixDialog.Title className="text-lg font-semibold">
                Compartilhar projeto
              </RadixDialog.Title>
              <RadixDialog.Description className="mt-2 text-sm text-muted-foreground">
                Convide alguém para colaborar com você.
              </RadixDialog.Description>
              <div className="mt-5 flex justify-end">
                <RadixDialog.Close asChild>
                  <Button>Entendi</Button>
                </RadixDialog.Close>
              </div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>
      </Specimen>
      <Specimen name="Tooltip · Radix">
        <RadixTooltip.Provider>
          <RadixTooltip.Root>
            <RadixTooltip.Trigger asChild>
              <Button variant="outline">Passe o cursor</Button>
            </RadixTooltip.Trigger>
            <RadixTooltip.Portal>
              <RadixTooltip.Content
                sideOffset={6}
                className="z-50 rounded-md bg-foreground px-3 py-1.5 text-xs text-background"
              >
                Atalho: ⌘ + K<RadixTooltip.Arrow className="fill-foreground" />
              </RadixTooltip.Content>
            </RadixTooltip.Portal>
          </RadixTooltip.Root>
        </RadixTooltip.Provider>
      </Specimen>
    </div>
  );
}

export function DesignShowcase() {
  const [query, setQuery] = React.useState("");
  const filtered = components.filter((name) =>
    name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
            <a
              href="#top"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              Base Rhea{" "}
              <span className="font-normal text-muted-foreground">
                / Design
              </span>
            </a>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" /> shadcn/ui
              · Radix UI
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast("Catálogo atualizado com o inventário do projeto")
              }
            >
              Inventário <ArrowDown data-icon="inline-end" />
            </Button>
          </div>
        </header>
        <div
          id="top"
          className="mx-auto grid max-w-[1440px] lg:grid-cols-[220px_minmax(0,1fr)]"
        >
          <aside className="hidden border-r lg:block">
            <div className="sticky top-14 flex max-h-[calc(100vh-3.5rem)] flex-col gap-5 overflow-y-auto p-5">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar componente"
                  aria-label="Buscar componente"
                  className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="flex flex-col gap-5">
                {sections.map((section) => (
                  <div key={section.id}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </p>
                    <nav className="flex flex-col gap-1">
                      {section.items
                        .filter(
                          (item) =>
                            !query ||
                            item.toLowerCase().includes(query.toLowerCase()),
                        )
                        .map((item) => (
                          <a
                            key={item}
                            href={`#${section.id}`}
                            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {item}
                          </a>
                        ))}
                    </nav>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
            <div className="mx-auto max-w-5xl">
              <div className="mb-10 flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Biblioteca</span>
                    <ChevronRight className="size-3.5" />
                    <span>Componentes</span>
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Componentes shadcn/ui
                  </h1>
                  <p className="mt-3 max-w-2xl text-muted-foreground">
                    Uma coleção prática dos componentes instalados no projeto.
                    Explore estados, combinações e exemplos interativos do
                    preset base-rhea.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit shrink-0">
                  <Code2 data-icon="inline-start" />
                  {components.length} componentes
                </Badge>
              </div>
              <div className="mb-10 grid gap-3 sm:grid-cols-3">
                <Card className="shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid size-9 place-items-center rounded-md bg-muted">
                      <LayoutGrid className="size-4" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold">
                        {components.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        componentes disponíveis
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid size-9 place-items-center rounded-md bg-muted">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{sections.length}</p>
                      <p className="text-xs text-muted-foreground">
                        categorias de uso
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid size-9 place-items-center rounded-md bg-muted">
                      <LifeBuoy className="size-4" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold">base-rhea</p>
                      <p className="text-xs text-muted-foreground">
                        preset shadcn/ui
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="flex flex-col gap-12">
                <section className="flex flex-col gap-4">
                  <SectionHeading
                    id="fundamentos"
                    title="Fundamentos"
                    description={sections[0].description}
                  />
                  <FoundationExamples />
                </section>
                <section className="flex flex-col gap-4">
                  <SectionHeading
                    id="formularios"
                    title="Formulários"
                    description={sections[1].description}
                  />
                  <FormExamples />
                </section>
                <section className="flex flex-col gap-4">
                  <SectionHeading
                    id="navegacao"
                    title="Navegação e layout"
                    description={sections[2].description}
                  />
                  <NavigationExamples />
                </section>
                <section className="flex flex-col gap-4">
                  <SectionHeading
                    id="sobreposicoes"
                    title="Sobreposições e menus"
                    description={sections[3].description}
                  />
                  <OverlayExamples />
                </section>
                <section className="flex flex-col gap-4">
                  <SectionHeading
                    id="dados"
                    title="Dados e conteúdo"
                    description={sections[4].description}
                  />
                  <DataExamples />
                </section>
                <section className="flex flex-col gap-4">
                  <SectionHeading
                    id="conversa"
                    title="Conversas e feedback"
                    description={sections[5].description}
                  />
                  <ConversationExamples />
                </section>
                <section
                  id="radix"
                  className="scroll-mt-24 flex flex-col gap-4 border-t pt-8"
                >
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                      Radix UI
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sections[6].description}
                    </p>
                  </div>
                  <RadixExamples />
                  <div>
                    <h3 className="mb-3 text-sm font-medium">
                      Inventário de primitivas
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {radixPrimitives.map((name) => (
                        <div
                          key={name}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <Check className="size-3.5 text-muted-foreground" />
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
              <section className="mt-12 border-t pt-8">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Inventário completo
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Todos os componentes atualmente instalados neste projeto.
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {filtered.length} / {components.length}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Check className="size-3.5 text-muted-foreground" />
                      {name}
                    </div>
                  ))}
                </div>
                {filtered.length === 0 && (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum componente encontrado para “{query}”.
                  </div>
                )}
              </section>
              <footer className="mt-10 flex flex-col gap-2 border-t py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Design system local · base-rhea · shadcn/ui + Radix UI
                </span>
                <span>Construído com componentes do projeto</span>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
