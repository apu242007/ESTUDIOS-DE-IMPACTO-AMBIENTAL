"use client";

import { useConfirm } from "@/components/confirm";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type DefaultValues } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { catalogErrorMessage } from "@/lib/data/catalogos";

export type CatalogValues = Record<string, string | number | boolean | null>;

export type CatalogItem = {
  id: string;
  title: string;
  detail?: string;
  badge?: string;
  values: CatalogValues;
};

type Option = { value: string; label: string };
export type CatalogField = {
  name: string;
  label: string;
  kind?: "text" | "number" | "textarea" | "select" | "checkbox";
  options?: Option[];
  placeholder?: string;
  help?: string;
  wide?: boolean;
};

type FilterConfig = { field: string; label: string; allLabel: string; labels?: Record<string, string> };

function EditorDialog({
  open,
  title,
  description,
  schema,
  fields,
  initial,
  busy,
  warning,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  schema: z.ZodType<CatalogValues, CatalogValues>;
  fields: CatalogField[];
  initial: CatalogValues;
  busy: boolean;
  warning?: (values: CatalogValues) => string | null;
  onClose: () => void;
  onSave: (values: CatalogValues) => void;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CatalogValues>({
    resolver: zodResolver(schema),
    defaultValues: initial as DefaultValues<CatalogValues>,
  });
  const values = watch();
  const warningText = warning?.(values) ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(onSave)} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => {
              const error = errors[field.name]?.message;
              const errorText = typeof error === "string" ? error : undefined;
              const kind = field.kind ?? "text";
              return (
                <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
                  {kind === "checkbox" ? (
                    <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-medium">
                      <input type="checkbox" className="size-5 accent-primary" {...register(field.name)} />
                      {field.label}
                    </label>
                  ) : (
                    <Field label={field.label} error={errorText}>
                      {kind === "select" ? (
                        <NativeSelect {...register(field.name)}>
                          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </NativeSelect>
                      ) : kind === "textarea" ? (
                        <Textarea className="min-h-32" placeholder={field.placeholder} {...register(field.name)} />
                      ) : (
                        <Input
                          className="h-11"
                          type={kind}
                          placeholder={field.placeholder}
                          step={kind === "number" ? "any" : undefined}
                          {...register(field.name, kind === "number" ? {
                            setValueAs: (value: unknown) => value === "" ? null : Number(value),
                          } : undefined)}
                        />
                      )}
                      {field.help && <span className="text-xs font-normal text-muted-foreground">{field.help}</span>}
                    </Field>
                  )}
                </div>
              );
            })}
          </div>
          {warningText && <p role="status" className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{warningText}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CrudCatalog({
  orgId,
  canEdit,
  title,
  singular,
  queryKey,
  load,
  create,
  update,
  remove,
  schema,
  fields,
  blank,
  search,
  filter,
  groupField,
  groupLabels,
  warning,
  headerExtra,
}: {
  orgId: string;
  canEdit: boolean;
  title: string;
  singular: string;
  queryKey: string;
  load: () => Promise<CatalogItem[]>;
  create: (values: CatalogValues) => Promise<unknown>;
  update: (id: string, values: CatalogValues) => Promise<unknown>;
  remove: (id: string) => Promise<void>;
  schema: z.ZodType<CatalogValues, CatalogValues>;
  fields: CatalogField[];
  blank: CatalogValues;
  search?: boolean;
  filter?: FilterConfig;
  groupField?: string;
  groupLabels?: Record<string, string>;
  warning?: (values: CatalogValues) => string | null;
  headerExtra?: (items: CatalogItem[]) => React.ReactNode;
}) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const key = [queryKey, orgId];
  const { data: items = [], isLoading, error } = useQuery({ queryKey: key, queryFn: load });
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [term, setTerm] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const fail = (error: unknown) => toast.error(catalogErrorMessage(error));
  const save = useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: CatalogValues }) => id ? update(id, values) : create(values),
    onSuccess: () => {
      toast.success("Catálogo guardado");
      setEditing(null);
      refresh();
    },
    onError: fail,
  });
  const del = useMutation({ mutationFn: remove, onSuccess: refresh, onError: fail });
  const options = useMemo(() => filter ? [...new Set(items.map((item) => String(item.values[filter.field] ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")) : [], [filter, items]);
  const visible = useMemo(() => {
    const normalized = term.trim().toLocaleLowerCase("es-AR");
    return items.filter((item) => {
      const matchesTerm = !normalized || `${item.title} ${item.detail ?? ""}`.toLocaleLowerCase("es-AR").includes(normalized);
      const matchesFilter = !filter || !filterValue || item.values[filter.field] === filterValue;
      return matchesTerm && matchesFilter;
    });
  }, [filter, filterValue, items, term]);
  const groups = useMemo(() => {
    if (!groupField) return [["", visible] as const];
    const keys = [...new Set(visible.map((item) => String(item.values[groupField] ?? "")))];
    return keys.map((group) => [group, visible.filter((item) => item.values[groupField] === group)] as const);
  }, [groupField, visible]);
  const current = editing === "new" ? null : editing;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          {canEdit && <Button className="min-h-11" onClick={() => setEditing("new")}>Agregar {singular}</Button>}
        </div>
        {headerExtra?.(items)}
        {(search || filter) && (
          <div className="flex flex-wrap gap-3">
            {search && <Input className="h-11 max-w-sm" aria-label={`Buscar en ${title}`} placeholder="Buscar..." value={term} onChange={(event) => setTerm(event.target.value)} />}
            {filter && (
              <NativeSelect className="max-w-xs" aria-label={filter.label} value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
                <option value="">{filter.allLabel}</option>
                {options.map((option) => <option key={option} value={option}>{filter.labels?.[option] ?? option}</option>)}
              </NativeSelect>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? <p role="alert" className="text-destructive">{catalogErrorMessage(error)}</p> : isLoading ? <p>Cargando...</p> : visible.length === 0 ? <p className="text-muted-foreground">No hay registros para mostrar.</p> : groups.map(([group, groupItems]) => (
          <section key={group || "all"} className="grid gap-2">
            {group && <h3 className="text-base font-semibold">{groupLabels?.[group] ?? group}</h3>}
            <ul className="grid gap-2">
              {groupItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
                    </div>
                    {item.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.detail}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button className="min-h-11" variant="outline" onClick={() => setEditing(item)}>Editar</Button>
                      <Button
                        className="min-h-11"
                        variant="outline"
                        disabled={del.isPending}
                        onClick={() => {
                          void confirm({ title: `¿Eliminar ${singular} “${item.title}”?`, details: ["Esta acción no se puede deshacer."], confirmLabel: "Eliminar", danger: true }).then((ok) => ok && del.mutate(item.id));
                        }}
                      >Eliminar</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
      {editing && (
        <EditorDialog
          key={current?.id ?? "new"}
          open
          title={current ? `Editar ${singular}` : `Agregar ${singular}`}
          description="Completá los datos y guardá los cambios."
          schema={schema}
          fields={fields}
          initial={current?.values ?? blank}
          busy={save.isPending}
          warning={warning}
          onClose={() => setEditing(null)}
          onSave={(values) => save.mutate({ id: current?.id ?? null, values })}
        />
      )}
    </Card>
  );
}
