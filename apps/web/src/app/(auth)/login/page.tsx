"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/schemas";
import type { z } from "zod";

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("No se pudo ingresar: " + error.message);
  });

  const magicLink = async () => {
    if (!(await trigger("email"))) return;
    setBusy(true);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const { error } = await createClient().auth.signInWithOtp({
      email: getValues("email"),
      options: { emailRedirectTo: `${window.location.origin}${base}/proyectos/` },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Te enviamos un enlace de acceso por email.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" className="h-11" {...register("email")} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            <Input
              type="password"
              autoComplete="current-password"
              className="h-11"
              {...register("password")}
            />
          </Field>
          <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
            Ingresar
          </Button>
          <Button type="button" variant="outline" className="h-12 text-base" onClick={magicLink} disabled={busy}>
            Recibir enlace por email
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿No tenés cuenta?{" "}
            <Link href="/register" className="font-medium text-foreground underline">
              Registrate
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
